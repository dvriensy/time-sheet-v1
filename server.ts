import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, deleteDoc, doc } from "firebase/firestore";

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
