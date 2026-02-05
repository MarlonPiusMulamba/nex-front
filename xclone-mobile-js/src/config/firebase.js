// Firebase Configuration for PWA Notifications
// Get these values from your Firebase Console > Project Settings > General > Your Apps > Web App
// If you haven't created a Web App in your Firebase project yet, create one now.
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

export const firebaseConfig = {
    apiKey: "AIzaSyCSf2PJ8-cMcLJF4d3-7ymxWDSv8DJ73Kg",
    authDomain: "nexfi-5cedf.firebaseapp.com",
    projectId: "nexfi-5cedf",
    storageBucket: "nexfi-5cedf.firebasestorage.app",
    messagingSenderId: "60010292286",
    appId: "1:60010292286:web:91a8b4181f2aa794e65d6f",
    measurementId: "G-LMJ85K03F2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);


