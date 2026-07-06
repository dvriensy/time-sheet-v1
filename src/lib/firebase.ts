import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "gen-lang-client-0537336721",
  appId: "1:804857383232:web:fcdf2991ae3e5adf1c12a5",
  apiKey: "AIzaSyAe1uJ-KF3DA5lfsjSWTup5mOGztUM_dlU",
  authDomain: "gen-lang-client-0537336721.firebaseapp.com",
  storageBucket: "gen-lang-client-0537336721.firebasestorage.app",
  messagingSenderId: "804857383232"
};

const app = initializeApp(firebaseConfig);

// Use the specific firestoreDatabaseId provided in the applet configuration
export const db = getFirestore(app, "ai-studio-timesheets-73827a6b-bcc0-4d4a-96a4-7fb232ef0f22");
