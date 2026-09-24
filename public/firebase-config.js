// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCJysj0gjJiWCc7yhddehqy3I70VmvjR4s",
  authDomain: "tgb-poker.firebaseapp.com",
  projectId: "tgb-poker",
  storageBucket: "tgb-poker.firebasestorage.app",
  messagingSenderId: "385983017735",
  appId: "1:385983017735:web:4506fc54e00e4c71780ba2",
  measurementId: "G-EXVQ0690P1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);