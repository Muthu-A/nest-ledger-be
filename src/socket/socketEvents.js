const socketService = require("../services/socketService");

function makeActivityMessage(userName, action, itemName, amount) {
  // Examples: "Muthu added Grocery expense ₹500"
  if (amount != null) {
    return `${userName} ${action} ${itemName} ₹${amount}`;
  }
  return `${userName} ${action} ${itemName}`;
}

function broadcastOnlineMembers(familyId) {
  const members = socketService.getOnlineMembers(familyId);
  socketService.emitToFamily(familyId, "family-online-members", members);
}

function registerSocketHandlers(socket) {
  const { id: socketId, user } = socket;

  // Auto-join family room if user has familyId
  if (user && user.familyId) {
    const room = `family_${user.familyId}`;
    socket.join(room);
    socketService.addSocket(user.familyId, user.id, socketId);
    broadcastOnlineMembers(user.familyId);
  }

  socket.on("join-family", (payload = {}, cb) => {
    try {
      const { familyId } = payload;
      if (!familyId) return cb && cb({ error: "familyId required" });
      // security: only allow joining if socket.user.familyId matches or socket.user is owner
      if (socket.user && socket.user.familyId && socket.user.familyId !== familyId) {
        return cb && cb({ error: "Unauthorized to join this family" });
      }
      const room = `family_${familyId}`;
      socket.join(room);
      socketService.addSocket(familyId, socket.user.id, socketId);
      broadcastOnlineMembers(familyId);
      cb && cb({ ok: true });
    } catch (err) {
      console.error("join-family error", err);
      cb && cb({ error: "join failed" });
    }
  });

  socket.on("leave-family", (payload = {}, cb) => {
    try {
      const { familyId } = payload;
      if (!familyId) return cb && cb({ error: "familyId required" });
      const room = `family_${familyId}`;
      socket.leave(room);
      socketService.removeSocket(familyId, socket.user.id, socketId);
      broadcastOnlineMembers(familyId);
      cb && cb({ ok: true });
    } catch (err) {
      console.error("leave-family error", err);
      cb && cb({ error: "leave failed" });
    }
  });

  socket.on("disconnect", (reason) => {
    try {
      if (socket.user && socket.user.familyId) {
        socketService.removeSocket(socket.user.familyId, socket.user.id, socketId);
        broadcastOnlineMembers(socket.user.familyId);
      }
    } catch (err) {
      console.error("disconnect handler error", err);
    }
  });

  // Example server error handler
  socket.on("error", (err) => {
    console.error("Socket error", err);
  });
}

module.exports = { registerSocketHandlers, makeActivityMessage };
