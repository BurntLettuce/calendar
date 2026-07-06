  // ---- Firebase ----
  const firebaseConfig = {
    apiKey: "AIzaSyC9CPawZ3fPgVl795aTH3t-R4pGg2cQfb4",
    authDomain: "calendar-27456.firebaseapp.com",
    projectId: "calendar-27456",
    storageBucket: "calendar-27456.firebasestorage.app",
    messagingSenderId: "811837168492",
    appId: "1:811837168492:web:51d9545c121d830c85b149"
  };

  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
  import { getFirestore, doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
  import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);
  const calendarRef = doc(db, "calendar", "main");

  window.__ghostDB = {
    subscribe(onData){
      return onSnapshot(calendarRef, (snap)=>{
        const data = snap.exists() ? snap.data() : {};
        onData(data.entries || {});
      }, (err)=>{
        console.error('Ledger read failed', err);
        onData({});
      });
    },
    async save(entriesObj){
      if(!auth.currentUser){
        alert('Sign in first to save changes.');
        throw new Error('not signed in');
      }
      try{
        await setDoc(calendarRef, { entries: entriesObj });
      }catch(err){
        if(err.code === 'permission-denied'){
          alert('You are not authorized to save changes.');
        }else{
          alert('Could not save to the ledger. Check your connection and try again.');
        }
        throw err;
      }
    }
  };

  window.__ghostAuth = {
    onChange(cb){ return onAuthStateChanged(auth, cb); },
    async signIn(email, password){ await signInWithEmailAndPassword(auth, email, password); },
    async signOut(){ await signOut(auth); }
  };
