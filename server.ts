import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, deleteDoc, doc, getDoc } from "firebase/firestore";

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

async function startServer() {
  const serverApp = express();
  const PORT = 3000;

  // Middleware to parse request body
  serverApp.use(express.json());

  // API Health check route
  serverApp.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // User list API route for manager dashboard
  const getUsersHandler = async (req: express.Request, res: express.Response) => {
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
