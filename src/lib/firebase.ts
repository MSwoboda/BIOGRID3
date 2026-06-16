// src/lib/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: 'biogrid-app',
  appId: '1:1013726403810:web:0131ffdcb7048e419b92bb',
  storageBucket: 'biogrid-app.firebasestorage.app',
  apiKey: 'AIzaSyChdmgejQ_FHuceacZ_Y2HZmrjgGyis4q8',
  authDomain: 'biogrid-app.firebaseapp.com',
  messagingSenderId: '1013726403810',
};

export const app      = initializeApp(firebaseConfig);
export const auth     = getAuth(app);
export const db       = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
