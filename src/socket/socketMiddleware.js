const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Socket handshake middleware to authenticate sockets using JWT.
// It expects the client to send { token } in socket.auth (recommended) or
// an Authorization header in the handshake headers.
async function socketAuthMiddleware(socket, next) {
  try {
    let authToken = (socket.handshake && socket.handshake.auth && socket.handshake.auth.token) ||
      (socket.handshake && socket.handshake.headers && socket.handshake.headers.authorization && socket.handshake.headers.authorization);

    // normalize "Bearer <token>" to raw token
    if (typeof authToken === 'string' && authToken.toLowerCase().startsWith('bearer ')) {
      authToken = authToken.split(' ')[1];
    }

    if (!authToken) {
      const err = new Error("Unauthorized: No token provided");
      err.data = { code: "NO_TOKEN" };
      return next(err);
    }

    const decoded = jwt.verify(authToken, process.env.JWT_SECRET || "secret");
    const user = await User.findById(decoded.id).select("name email familyId role");
    if (!user) {
      const err = new Error("Unauthorized: Invalid token");
      err.data = { code: "INVALID_TOKEN" };
      return next(err);
    }

    // attach minimal user payload to socket
    socket.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      familyId: user.familyId ? user.familyId.toString() : null,
      role: user.role
    };

    return next();
  } catch (err) {
    console.error("Socket auth error", err);
    const error = new Error("Unauthorized");
    error.data = { code: "UNAUTHORIZED" };
    return next(error);
  }
}

module.exports = socketAuthMiddleware;
