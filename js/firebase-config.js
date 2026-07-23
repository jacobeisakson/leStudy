// ============================================================
// FIREBASE CONFIG
// ============================================================
// 1. Go to https://console.firebase.google.com, create a free project.
// 2. Add a "Web app" (</> icon) inside the project. Firebase will show you
//    a config object like the one below — copy your real values in here.
// 3. In the Firebase console, enable:
//      - Build > Firestore Database > Create database (start in "production mode")
//      - Build > Authentication > Sign-in method > Anonymous > Enable
// 4. Paste the Firestore security rules from README.md into
//    Firestore Database > Rules, and publish.
//
// This file is safe to make public — Firebase web config values are not
// secret keys, they just identify which project to talk to. Your Firestore
// security rules (set in step 4) are what actually control access.
// ============================================================

export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
