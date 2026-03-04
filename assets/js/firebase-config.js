import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, FacebookAuthProvider, sendPasswordResetEmail, sendEmailVerification, updateProfile, updatePassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set, get, child, update, push, onValue, remove, query, orderByChild, equalTo, limitToFirst, limitToLast, onChildAdded } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBloT4f7vWWrRjOXW-VL6CGmujvbR_fE7I",
    authDomain: "shreyash-medical.firebaseapp.com",
    databaseURL: "https://shreyash-medical-default-rtdb.firebaseio.com",
    projectId: "shreyash-medical",
    storageBucket: "shreyash-medical.firebasestorage.app",
    messagingSenderId: "235190622842",
    appId: "1:235190622842:web:73ec20ccdaa52316ffb9c3"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const googleProvider = new GoogleAuthProvider();
const facebookProvider = new FacebookAuthProvider();

export { app, auth, db, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, googleProvider, facebookProvider, signInWithPopup, ref, set, get, child, update, push, sendPasswordResetEmail, sendEmailVerification, onValue, remove, query, orderByChild, equalTo, limitToFirst, limitToLast, onChildAdded, updateProfile, updatePassword };
