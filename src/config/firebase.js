// src/config/firebase.js
const admin = require('firebase-admin');

let firebaseInitialized = false;

// Initialize Firebase Admin SDK
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID || "craetionai",
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || "placeholder-key-id",
  private_key: (process.env.FIREBASE_PRIVATE_KEY || "placeholder-private-key").replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL || "firebase-adminsdk-fbsvc@craetionai.iam.gserviceaccount.com",
  client_id: process.env.FIREBASE_CLIENT_ID || "placeholder-client-id",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL || "placeholder-cert-url"
};

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
  
  firebaseInitialized = true;
  console.log('Firebase Admin initialized successfully');
} catch (error) {
  console.warn('Firebase Admin initialization failed:', error.message);
  console.warn('Authentication features will be limited');
}

// Export with safe fallbacks
let db, auth;

if (firebaseInitialized) {
  try {
    db = admin.firestore();
    auth = admin.auth();
  } catch (error) {
    console.warn('Firebase services initialization failed:', error.message);
    firebaseInitialized = false;
  }
}

// Provide fallback objects if Firebase is not initialized
if (!firebaseInitialized) {
  db = {
    collection: () => ({ 
      doc: () => ({
        set: async () => { throw new Error('Firebase not initialized'); },
        get: async () => { throw new Error('Firebase not initialized'); },
        delete: async () => { throw new Error('Firebase not initialized'); }
      }),
      add: async () => { throw new Error('Firebase not initialized'); },
      where: () => ({ get: async () => ({ docs: [] }) })
    })
  };
  
  auth = {
    verifyIdToken: async () => { throw new Error('Firebase not initialized'); },
    createUser: async () => { throw new Error('Firebase not initialized'); },
    updateUser: async () => { throw new Error('Firebase not initialized'); }
  };
}

module.exports = { admin, db, auth, firebaseInitialized };
