const { Server } = require("socket.io");
const socketAuth = require("./socketMiddleware");
const { registerSocketHandlers } = require("./socketEvents");
const socketService = require("../services/socketService");

function initSocket(server, options = {}) {
  const io = new Server(server, {
    cors: {
      origin: options.corsOrigin || "*",
      methods: ["GET", "POST"],
      credentials: true
    },
    pingInterval: options.pingInterval || 25000,
    pingTimeout: options.pingTimeout || 60000,
    maxHttpBufferSize: options.maxHttpBufferSize || 1e6
  });

  // attach io to socketService
  socketService.setIO(io);

  // Use middleware for auth
  io.use((socket, next) => socketAuth(socket, next));

  io.on("connection", (socket) => {
    try {
      registerSocketHandlers(socket);
      console.log("Socket connected");
      
    } catch (err) {
      console.error("connection handler error", err);
      socket.disconnect(true);
    }
  });

  // Graceful handling for server restarts; keep behavior idempotent
  io.on("error", (err) => {
    console.error("Socket.IO error", err);
  });

  return io;
}

module.exports = { initSocket };
