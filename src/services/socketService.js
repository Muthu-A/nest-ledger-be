// Central socket service. Controllers should use this to emit events.
let io = null;

// Map<familyId, Map<userId, Set<socketId>>> to track online sockets per user per family
const familySockets = new Map();

function setIO(socketIO) {
  io = socketIO;
}

function emitToFamily(familyId, eventName, payload) {
  if (!io) {
    return;
  }
  try {
    const room = `family_${familyId}`.toString();
    io.to(room).emit(eventName, payload);
  } catch (err) {
    console.error("emitToFamily error", err);
  }
}

function addSocket(familyId, userId, socketId) {
  if (!familyId) return;
  const fam = familyId.toString();
  const uid = userId.toString();
  let users = familySockets.get(fam);
  if (!users) {
    users = new Map();
    familySockets.set(fam, users);
  }
  let sockets = users.get(uid);
  if (!sockets) {
    sockets = new Set();
    users.set(uid, sockets);
  }
  sockets.add(socketId);
}

function removeSocket(familyId, userId, socketId) {
  if (!familyId) return;
  const fam = familyId.toString();
  const uid = userId.toString();
  const users = familySockets.get(fam);
  if (!users) return;
  const sockets = users.get(uid);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    users.delete(uid);
  }
  if (users.size === 0) {
    familySockets.delete(fam);
  }
}

function getOnlineMembers(familyId) {
  if (!familyId) return [];
  const fam = familyId.toString();
  const users = familySockets.get(fam);
  if (!users) return [];
  const res = [];
  for (const [userId, sockets] of users.entries()) {
    res.push({ userId, connections: sockets.size });
  }
  return res;
}

// Return array of socket ids currently in the family room (live sockets)
async function getSocketsInRoom(familyId) {
  if (!io) return [];
  if (!familyId) return [];
  const room = `family_${familyId}`.toString();
  try {
    const sockets = await io.in(room).allSockets(); // returns a Set
    return Array.from(sockets || []);
  } catch (err) {
    console.error('[socketService] getSocketsInRoom error', err);
    return [];
  }
}

module.exports = {
  setIO,
  emitToFamily,
  addSocket,
  removeSocket,
  getOnlineMembers,
  getSocketsInRoom
};

