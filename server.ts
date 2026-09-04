import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import webpush from "web-push";

// Initialize Firebase SDK on the backend
const firebaseConfig = {
  projectId: "gen-lang-client-0537336721",
  appId: "1:804857383232:web:fcdf2991ae3e5adf1c12a5",
  apiKey: "AIzaSyAe1uJ-KF3DA5lfsjSWTup5mOGztUM_dlU",
  authDomain: "gen-lang-client-0537336721.firebaseapp.com",
  storageBucket: "gen-lang-client-0537336721.firebasestorage.app",
  messagingSenderId: "804857383232"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "ai-studio-timesheets-73827a6b-bcc0-4d4a-96a4-7fb232ef0f22");

// Configure VAPID Web Push Keys
let activeVapidKeys: { publicKey: string; privateKey: string };
try {
  activeVapidKeys = webpush.generateVAPIDKeys();
  webpush.setVapidDetails(
    'mailto:notifications@workspace.app',
    activeVapidKeys.publicKey,
    activeVapidKeys.privateKey
  );
  console.log('[PUSH SERVER] VAPID keys successfully generated and configured.');
} catch (vapidErr) {
  console.error('[PUSH SERVER] Error initializing VAPID keys:', vapidErr);
}

// In-memory registry of active push subscriptions
interface StoredSubscription {
  id: string;
  username: string;
  subscription: webpush.PushSubscription;
  createdAt: string;
}
const activePushSubscriptions = new Map<string, StoredSubscription>();

async function startServer() {
  const serverApp = express();
  const PORT = 3000;

  // Middleware to parse request body
  serverApp.use(express.json());

  // API Health check route
  serverApp.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Google OAuth Configuration endpoint for Workspace & Google Calendar Integration
  serverApp.get("/api/oauth/config", (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(200).json({
        configured: false,
        clientId: "",
        scopes: [
          "https://www.googleapis.com/auth/calendar.events"
        ],
        message: "GOOGLE_CLIENT_ID environment variable not set. Please configure in Settings."
      });
    }

    return res.json({
      configured: true,
      clientId,
      scopes: [
        "https://www.googleapis.com/auth/calendar.events"
      ]
    });
  });

  // --- Web Push Notifications API ---
  // Return VAPID Public Key for browser pushManager.subscribe()
  serverApp.get("/api/push/vapid-public-key", (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    if (!activeVapidKeys?.publicKey) {
      return res.status(500).json({ error: "VAPID keys not configured." });
    }
    return res.json({ publicKey: activeVapidKeys.publicKey });
  });

  // Store Push Subscription from Client
  serverApp.post("/api/push/subscribe", (req, res) => {
    const { subscription, username } = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: "Valid push subscription object required." });
    }

    const key = subscription.endpoint;
    activePushSubscriptions.set(key, {
      id: key,
      username: username || 'user',
      subscription,
      createdAt: new Date().toISOString()
    });

    console.log(`[PUSH SERVER] Registered push subscription for @${username || 'user'}. Total active subscriptions: ${activePushSubscriptions.size}`);
    return res.status(201).json({ success: true, registered: true });
  });

  // Unsubscribe Endpoint
  serverApp.post("/api/push/unsubscribe", (req, res) => {
    const { endpoint } = req.body;
    if (endpoint && activePushSubscriptions.has(endpoint)) {
      activePushSubscriptions.delete(endpoint);
      console.log(`[PUSH SERVER] Removed subscription for endpoint. Remaining: ${activePushSubscriptions.size}`);
    }
    return res.json({ success: true, removed: true });
  });

  // Trigger 5:00 PM Workday Shift Reminder Push Notification
  serverApp.post("/api/push/trigger-5pm-reminder", async (req, res) => {
    const { username } = req.body;
    console.log(`[PUSH SERVER] Triggering 5:00 PM Workday Shift Reminder push notification${username ? ` for @${username}` : ' to all subscribers'}`);

    const payload = JSON.stringify({
      title: "WORKSPACE • 5:00 PM Shift Reminder",
      body: "Your workday shift has ended! Tap here to open the shift logger and record your hours.",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      url: "/?tab=timesheet&action=log-shift",
      tag: "workday-shift-reminder-5pm"
    });

    let sentCount = 0;
    const errors: any[] = [];

    const sendPromises: Promise<any>[] = [];
    activePushSubscriptions.forEach((sub, key) => {
      if (!username || sub.username === username) {
        sendPromises.push(
          webpush.sendNotification(sub.subscription, payload)
            .then(() => {
              sentCount++;
            })
            .catch((err) => {
              console.warn(`[PUSH SERVER] Failed to send push to ${key.slice(0, 30)}...`, err?.statusCode || err?.message);
              // Clean up expired subscriptions (410 Gone / 404 Not Found)
              if (err?.statusCode === 410 || err?.statusCode === 404) {
                activePushSubscriptions.delete(key);
              }
              errors.push(err?.message || "Send error");
            })
        );
      }
    });

    await Promise.all(sendPromises);

    return res.json({
      success: true,
      sentCount,
      totalSubscribers: activePushSubscriptions.size,
      errors: errors.length > 0 ? errors : undefined
    });
  });

  // Trigger Test Push Alert
  serverApp.post("/api/push/test", async (req, res) => {
    const { username } = req.body;
    const payload = JSON.stringify({
      title: "WORKSPACE • Test Push Notification",
      body: "Push alerts & Service Worker are fully operational! Tap to open the shift logger.",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      url: "/?tab=timesheet&action=log-shift",
      tag: "workspace-push-test"
    });

    let sentCount = 0;
    const sendPromises: Promise<any>[] = [];
    activePushSubscriptions.forEach((sub, key) => {
      if (!username || sub.username === username) {
        sendPromises.push(
          webpush.sendNotification(sub.subscription, payload)
            .then(() => { sentCount++; })
            .catch((err) => {
              if (err?.statusCode === 410 || err?.statusCode === 404) {
                activePushSubscriptions.delete(key);
              }
            })
        );
      }
    });

    await Promise.all(sendPromises);
    return res.json({ success: true, sentCount });
  });

  // Server-side Automated Workday 5:00 PM Dispatcher
  let lastDispatchedDate = "";
  setInterval(async () => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 1-5 = Monday to Friday
    const isWorkday = dayOfWeek >= 1 && dayOfWeek <= 5;
    
    if (isWorkday && now.getHours() === 17 && now.getMinutes() === 0) {
      const todayTag = now.toISOString().slice(0, 10);
      if (lastDispatchedDate !== todayTag) {
        lastDispatchedDate = todayTag;
        console.log(`[PUSH SERVER] Automated 5:00 PM Workday Shift Reminder triggered for ${todayTag}!`);

        const payload = JSON.stringify({
          title: "WORKSPACE • 5:00 PM Shift Reminder",
          body: "Your workday shift has ended! Tap here to open the shift logger and record your hours.",
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          url: "/?tab=timesheet&action=log-shift",
          tag: "workday-shift-reminder-5pm"
        });

        activePushSubscriptions.forEach((sub) => {
          webpush.sendNotification(sub.subscription, payload).catch((err) => {
            console.warn('[PUSH SERVER] Automated push send failure:', err?.message);
          });
        });
      }
    }
  }, 30000);

  // User list API route for manager dashboard
  const getUsersHandler = async (req: express.Request, res: express.Response) => {
    // Prevent aggressive caching / enforce revalidation
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    
    const requesterUsername = (req.body.requesterUsername || req.query.requesterUsername || req.headers["x-requester-username"]) as string;
    
    if (!requesterUsername) {
      return res.status(401).json({ error: "Unauthorized: Requester username is required for verification." });
    }

    try {
      // 1. Verify that the requester is a manager or admin
      const requesterDocRef = doc(db, "users", requesterUsername);
      const requesterSnap = await getDoc(requesterDocRef);
      
      let isAuthorized = false;
      
      // Standard hardcoded fallback for derek_vriens, or if role is manager/admin
      if (requesterUsername === 'derek_vriens') {
        isAuthorized = true;
      } else if (requesterSnap.exists()) {
        const userData = requesterSnap.data();
        const role = userData.role || 'employee';
        if (role === 'manager' || role === 'admin') {
          isAuthorized = true;
        }
      }

      if (!isAuthorized) {
        return res.status(403).json({ error: "Access Denied: Requester does not have manager or admin privileges." });
      }

      // 2. Query pulls ALL active users from the database
      const usersRef = collection(db, "users");
      const usersSnap = await getDocs(usersRef);
      
      const usersList: any[] = [];
      usersSnap.forEach(docSnap => {
        const u = docSnap.data();
        usersList.push({
          id: docSnap.id,
          username: u.username || docSnap.id,
          firstName: u.firstName || '',
          lastName: u.lastName || '',
          fullName: u.fullName || '',
          role: u.role || 'employee',
          department: u.department || 'Operations',
          hourlyRate: u.hourlyRate || 45,
          email: u.email || '',
          phone: u.phone || '',
          bio: u.bio || ''
        });
      });

      // 3. Make sure it returns an array of users to the frontend
      return res.json(usersList);
    } catch (error: any) {
      console.error("[BACKEND] Error fetching users list:", error);
      return res.status(500).json({ error: error.message || "Failed to retrieve registered users." });
    }
  };

  // User signup/registration endpoint
  serverApp.post("/api/signup", async (req, res) => {
    // Enforce no-cache
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    const { fullName, username, password, hourlyRate } = req.body;

    if (!fullName || !username) {
      return res.status(400).json({ error: "Full Name and Username are required fields." });
    }

    const normalizedUsername = username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    if (!normalizedUsername) {
      return res.status(400).json({ error: "Invalid username format." });
    }

    try {
      console.log(`[BACKEND] Attempting to register new account: @${normalizedUsername}`);
      
      const userDocRef = doc(db, "users", normalizedUsername);
      const userSnap = await getDoc(userDocRef);

      if (userSnap.exists()) {
        return res.status(400).json({ error: `An account with the username "@${normalizedUsername}" already exists.` });
      }

      const trimmedName = fullName.trim();
      const nameParts = trimmedName.split(/\s+/);
      const firstName = nameParts[0] || trimmedName;
      const lastName = nameParts.slice(1).join(' ') || '';

      const newUser = {
        username: normalizedUsername,
        password: password || '123456',
        firstName,
        lastName,
        fullName: trimmedName,
        hourlyRate: hourlyRate || 45,
        role: (normalizedUsername === 'derek_vriens' || trimmedName.toLowerCase() === 'derek vriens') ? 'manager' : 'employee',
        department: 'Operations',
        email: `${normalizedUsername}@ledger-demo.com`,
        phone: `+1 (555) 01${Math.floor(Math.random() * 90) + 10}-${Math.floor(Math.random() * 9000) + 1000}`,
        bio: 'Registered contractor account.'
      };

      // Perform the database 'create' / 'insert' command and await response
      await setDoc(userDocRef, newUser);
      console.log(`[BACKEND] Successfully registered @${normalizedUsername} into Firestore.`);

      // Return 201 Success status
      return res.status(201).json(newUser);
    } catch (error: any) {
      console.error("[BACKEND] Error during signup:", error);
      return res.status(500).json({ error: error.message || "Failed to register account." });
    }
  });

  serverApp.get("/api/users", getUsersHandler);
  serverApp.post("/api/users", getUsersHandler);

  // Account deletion API route
  serverApp.post("/api/delete-account", async (req, res) => {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }

    console.log(`[BACKEND] Starting backend deletion of account: @${username}`);

    try {
      // 1. Delete associated timesheets where username == target username
      const timesheetsRef = collection(db, "timesheets");
      const timesheetsQuery = query(timesheetsRef, where("username", "==", username));
      const timesheetsSnap = await getDocs(timesheetsQuery);
      
      const timesheetDeletions = timesheetsSnap.docs.map(docSnap => 
        deleteDoc(doc(db, "timesheets", docSnap.id))
      );
      await Promise.all(timesheetDeletions);
      console.log(`[BACKEND] Deleted ${timesheetDeletions.length} timesheet entries for @${username}`);

      // 2. Delete associated activeSessions (document key is the username)
      try {
        await deleteDoc(doc(db, "activeSessions", username));
        console.log(`[BACKEND] Deleted activeSession for @${username}`);
      } catch (err) {
        console.error(`[BACKEND] Error deleting activeSession for @${username}:`, err);
      }

      // 3. Delete associated futureShifts where username matches
      const shiftsRef = collection(db, "futureShifts");
      const shiftsQuery = query(shiftsRef, where("username", "==", username));
      const shiftsSnap = await getDocs(shiftsQuery);
      
      const shiftDeletions = shiftsSnap.docs.map(docSnap => 
        deleteDoc(doc(db, "futureShifts", docSnap.id))
      );
      await Promise.all(shiftDeletions);
      console.log(`[BACKEND] Deleted ${shiftDeletions.length} futureShifts for @${username}`);

      // 4. Delete associated timeOffRequests where username matches
      const timeOffRef = collection(db, "timeOffRequests");
      const timeOffQuery = query(timeOffRef, where("username", "==", username));
      const timeOffSnap = await getDocs(timeOffQuery);
      
      const timeOffDeletions = timeOffSnap.docs.map(docSnap => 
        deleteDoc(doc(db, "timeOffRequests", docSnap.id))
      );
      await Promise.all(timeOffDeletions);
      console.log(`[BACKEND] Deleted ${timeOffDeletions.length} timeOffRequests for @${username}`);

      // 5. Delete the main user document in "users" (document key is username)
      await deleteDoc(doc(db, "users", username));
      console.log(`[BACKEND] Deleted user profile document for @${username}`);

      return res.json({ 
        success: true, 
        message: `Account @${username} and all associated records have been successfully deleted from the system.` 
      });
    } catch (error: any) {
      console.error(`[BACKEND] Error during backend account deletion for @${username}:`, error);
      return res.status(500).json({ error: error.message || "Failed to delete account on backend." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    serverApp.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    serverApp.use(express.static(distPath));
    serverApp.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  serverApp.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
