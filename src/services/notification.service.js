const { getMessaging } = require("firebase-admin/messaging");
require("../firebaseAdmin");

const sendNotification = async (tokens, title, body, data = {}) => {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    throw new Error("No notification tokens provided");
  }

  const message = {
    tokens,
    data: {
      title,
      body,
    },
  };

  if (data && Object.keys(data).length > 0) {
    message.data = { ...message.data, ...data };
  }

  const response = await getMessaging().sendEachForMulticast(message);

  return response;
};

module.exports = {
  sendNotification,
};
