const admin = require("firebase-admin");
const serviceAccount = require("./config/nestledger-7d0a0-firebase-adminsdk-fbsvc-385e2fb355.json");

admin.initializeApp({
  credential: admin.cert(serviceAccount),
});

module.exports = admin;
