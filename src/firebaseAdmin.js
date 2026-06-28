const admin = require("firebase-admin");
const serviceAccount = require("./config/nestledger-7d0a0-firebase-adminsdk-fbsvc-f8f5bd1e6f.json");

admin.initializeApp({
  credential: admin.cert(serviceAccount),
});

module.exports = admin;
