const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const keyPath = path.join(__dirname, 'serviceAccountKey.json');

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  // Production: read from environment variable (Render, Railway, etc.)
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('Firebase Admin initialized from environment variable.');
} else if (fs.existsSync(keyPath)) {
  // Development: read from local file
  const serviceAccount = require(keyPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('Firebase Admin initialized from local file.');
} else {
  console.warn('WARNING: No Firebase credentials found. Push notifications will fail.');
  admin.initializeApp();
}

module.exports = admin;
