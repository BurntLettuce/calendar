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

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const calendarRef = doc(db, "calendar", "main");

  async function sha256(str){
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

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
      let authHash = localStorage.getItem('ghost-ledger-auth');
      if(!authHash){
        const pass = prompt('Enter the ledger passphrase to save changes:');
        if(pass === null) throw new Error('cancelled');
        authHash = await sha256(pass);
      }
      try{
        await setDoc(calendarRef, { entries: entriesObj, _auth: authHash });
        localStorage.setItem('ghost-ledger-auth', authHash);
      }catch(err){
        localStorage.removeItem('ghost-ledger-auth');
        if(err.code === 'permission-denied'){
          alert('That passphrase was incorrect. Your change was not saved.');
        }else{
          alert('Could not save to the ledger. Check your connection and try again.');
        }
        throw err;
      }
    }
  };
