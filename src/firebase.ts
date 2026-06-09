import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDVjDq--tPyuHIBbzB26lhTk15GtvD0bb8",
  authDomain: "poultry-project-84772.firebaseapp.com",
  projectId: "poultry-project-84772",
  storageBucket: "poultry-project-84772.firebasestorage.app",
  messagingSenderId: "987165671768",
  appId: "1:987165671768:web:bad4f3f94c8a7e7cb0252d",
  measurementId: "G-5GNTBJ06WM"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
