const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.SOCKET_PORT || 5001;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Local Socket.IO server');
});

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id, 'query=', socket.handshake.query);
  // optional: acknowledge
  socket.emit('connected', { socketId: socket.id });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', socket.id, 'reason=', reason);
  });
});

server.listen(PORT, () => {
  console.log(`Local Socket.IO server listening on port ${PORT}`);
});
