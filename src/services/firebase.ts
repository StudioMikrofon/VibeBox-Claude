// src/services/firebase.ts
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyD3WiaGOcw_4p8KtVI62YdtFRkBCPDTKFY",  // ← Ovdje mora biti pravi key
  authDomain: "vibebox-58735465-afa10.firebaseapp.com",
  projectId: "vibebox-58735465-afa10",
  storageBucket: "vibebox-58735465-afa10.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

console.log('🔥 Firebase config:', {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain
});

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
