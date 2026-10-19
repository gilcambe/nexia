import { initializeApp } from 'firebase/app';
import { initializeAuth, indexedDBLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN_PROPRIO && import.meta.env.AUTH_DOMINIO_PROPRIO === '1') || (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN_PROPRIO && typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') ? import.meta.env.VITE_FIREBASE_AUTH_DOMAIN_PROPRIO : (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN_PROPRIO || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: indexedDBLocalPersistence,
});

export const db = getFirestore(app);
