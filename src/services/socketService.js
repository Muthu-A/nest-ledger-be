// Central socket service. Controllers should use this to emit events.
const User = require("../models/User");
let io = null;

// Map<familyId, Map<userId, Set<socketId>>> to track online sockets per user per family
const familySockets = new Map();
// Map<userId, Set<socketId>> to track sockets per user globally (even before family join)
const globalUserSockets = new Map();

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

function addGlobalSocket(userId, socketId) {
  if (!userId) return;
  const uid = userId.toString();
  let sockets = globalUserSockets.get(uid);
  if (!sockets) {
    sockets = new Set();
    globalUserSockets.set(uid, sockets);
  }
  sockets.add(socketId);
}

function removeGlobalSocket(userId, socketId) {
  if (!userId) return;
  const uid = userId.toString();
  const sockets = globalUserSockets.get(uid);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size === 0) globalUserSockets.delete(uid);
}

function getSocketsByUser(userId) {
  if (!userId) return [];
  const uid = userId.toString();
  const sockets = globalUserSockets.get(uid);
  return sockets ? Array.from(sockets) : [];
}

function emitToUser(familyId, userId, eventName, payload) {
  if (!io) return;
  if (!familyId || !userId) return;
  try {
    const fam = familyId.toString();
    const uid = userId.toString();
    const users = familySockets.get(fam);
    if (!users) return;
    const sockets = users.get(uid);
    if (!sockets) return;
    for (const socketId of sockets) {
      try {
        io.to(socketId).emit(eventName, payload);
      } catch (err) {
        console.error('[socketService] emitToUser error', err);
      }
    }
  } catch (err) {
    console.error('[socketService] emitToUser outer error', err);
  }
}

function emitToUserSockets(userId, eventName, payload) {
  if (!io) return;
  if (!userId) return;
  try {
    const sockets = getSocketsByUser(userId);
    for (const sid of sockets) {
      try { io.to(sid).emit(eventName, payload); } catch (e) { console.error('[socketService] emitToUserSockets error', e); }
    }
  } catch (err) {
    console.error('[socketService] emitToUserSockets outer error', err);
  }
}

function addUserSocketsToFamily(familyId, userId) {
  if (!io || !familyId || !userId) return [];
  const room = `family_${familyId}`.toString();
  const socketIds = getSocketsByUser(userId);
  for (const sid of socketIds) {
    try {
      const s = io?.sockets?.sockets?.get ? io.sockets.sockets.get(sid) : null;
      if (s && s.join) {
        try { s.join(room); } catch (e) { /* ignore */ }
      }
      addSocket(familyId, userId, sid);
    } catch (err) {
      console.error('[socketService] addUserSocketsToFamily error', err);
    }
  }
  return socketIds;
}

function removeUserFromFamily(familyId, userId) {
  if (!familyId || !userId) return [];
  const fam = familyId.toString();
  const uid = userId.toString();
  const users = familySockets.get(fam);
  if (!users) return [];
  const sockets = users.get(uid);
  if (!sockets) return [];
  const socketIds = Array.from(sockets);
  // Remove tracking
  users.delete(uid);
  if (users.size === 0) familySockets.delete(fam);

  // Also force socket leave from room if possible
  try {
    const room = `family_${familyId}`.toString();
    for (const sid of socketIds) {
      const s = io?.sockets?.sockets?.get ? io.sockets.sockets.get(sid) : null;
      if (s && s.leave) {
        try { s.leave(room); } catch (e) { /* ignore */ }
      }
    }
  } catch (err) {
    console.error('[socketService] removeUserFromFamily error', err);
  }
  return socketIds;
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

async function getOnlineMembersWithDetails(familyId) {
  const members = getOnlineMembers(familyId);
  if (!members || members.length === 0) return [];
  try {
    const users = await User.find({ _id: { $in: members.map(m => m.userId) } }).lean();
    const userMap = {};
    users.forEach(u => { userMap[u._id.toString()] = u; });
    return members.map(m => {
      const user = userMap[m.userId.toString()];
      return {
        userId: m.userId,
        connections: m.connections,
        name: user?.name || 'Unknown',
        email: user?.email || 'unknown@example.com',
        message: `${user?.name || 'User'} is online`
      };
    });
  } catch (err) {
    console.error('[socketService] getOnlineMembersWithDetails error', err);
    return members;
  }
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
  getOnlineMembersWithDetails,
  getSocketsInRoom,
  emitToUser,
  removeUserFromFamily,
  addGlobalSocket,
  removeGlobalSocket,
  getSocketsByUser,
  emitToUserSockets,
  addUserSocketsToFamily
};


