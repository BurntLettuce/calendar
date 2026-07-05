# Calendar — setup

This is a static site.

There are three parts to set up: Firebase, passphrase, and GitHub Pages.

## 1. Create a Firebase project

1. Go to https://console.firebase.google.com and click **Add project**.
   Name it. Skip Google Analytics.
2. In the left sidebar, go to **Build → Firestore Database → Create database**.
   Choose **Start in production mode**, pick any region, click Create.
3. Go to **Project settings** (gear icon, top left) → scroll to **Your apps**
   → click the `</>` (web) icon → register the app. Firebase will show you a `firebaseConfig` object:

   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "proj_name-xxxx.firebaseapp.com",
     projectId: "proj_name-xxxx",
     storageBucket: "proj_name-xxxx.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef"
   };
   ```

4. Open `index.html` in this folder, find the `firebaseConfig` object under the `<script type="module">` block,
   and paste values in place of the `YOUR_...` placeholders.

## 2. Set security rules

1. In Firebase, go to **Firestore Database → Rules** tab.
2. Replace the contents with what's in `firestore.rules`,
   then click **Publish**.

## 3. Set passphrase

The passphrase is never sent to me or stored anywhere in plain text — you
generate its hash yourself and paste only the hash into Firestore.

1. Pick a passphrase.
2. Open any web page, press F12 to open the browser console, paste this in:

   ```js
   crypto.subtle.digest('SHA-256', new TextEncoder().encode("your passphrase here"))
     .then(buf => console.log(Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('')));
   ```

3. Copy the output hex string.
4. In Firebase, go to **Firestore Database → Data**, click **Start collection**,
   name it `secret`, document ID `key`, add a field named `hash` (type
   string) and paste the hex string as its value. Save.

## 4. Publish through GitHub Pages

1. Go to https://github.com/new, create new repo.
