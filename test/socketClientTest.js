const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');

const SERVER = process.env.SERVER_URL || 'http://localhost:5001';
const SECRET = process.env.JWT_SECRET || 'family_budget_secret';

function createClient(options = {}) {
  const socket = io(SERVER, {
    auth: options.auth || {},
    reconnection: true,
    transports: ['websocket'],
    timeout: 5000
  });

  socket.on('connect', () => {
    console.log('Connected:', socket.id, 'auth=', options.auth);
  });

  socket.on('connect_error', (err) => {
    console.log('connect_error:', err && err.message ? err.message : err);
  });

  socket.on('family-online-members', (members) => {
    console.log('family-online-members', members);
  });

  socket.on('expense-created', (data) => console.log('expense-created', data));
  socket.on('activity-created', (data) => console.log('activity-created', data));
  socket.on('disconnect', (reason) => console.log('disconnect', reason));

  return socket;
}

(async function run() {
  console.log('Server:', SERVER);

  console.log('\n1) Connect WITHOUT token (should be rejected)');
  let c1 = createClient();
  await new Promise((r) => setTimeout(r, 3500));
  c1.close();

  console.log('\n2) Connect WITH invalid token (should be rejected)');
  let c2 = createClient({ auth: { token: 'invalid.token.here' } });
  await new Promise((r) => setTimeout(r, 3500));
  c2.close();

  console.log('\n3) Connect WITH signed token (user likely not in DB; server will attempt lookup)');
  const fakeId = '000000000000000000000000';
  const signed = jwt.sign({ id: fakeId }, SECRET);
  let c3 = createClient({ auth: { token: signed } });
  await new Promise((r) => setTimeout(r, 5000));

  // attempt to join a family room (will be rejected if auth failed)
  try {
    c3.emit('join-family', { familyId: 'someFamilyId' }, (resp) => {
      console.log('join-family callback:', resp);
    });
  } catch (err) {
    console.error('emit error', err);
  }

  await new Promise((r) => setTimeout(r, 3000));
  c3.close();

  console.log('\nTest finished.');
  process.exit(0);
})();
