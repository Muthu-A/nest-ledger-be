Socket.IO Usage — Nest Ledger Backend

Server setup

- Start server:

```bash
npm install
npm run dev
```

Connection (client)

Use Socket.IO client. Send JWT in `auth.token` during connection handshake.

Example (browser / frontend):

```javascript
import { io } from "socket.io-client";

const socket = io("https://your-server.com", {
  auth: {
    token: "Bearer <JWT_TOKEN>" // provide raw token or just token string
  },
  reconnection: true,
  transports: ["websocket"]
});

socket.on("connect", () => {
  console.log("connected", socket.id);
});

socket.on("family-online-members", (members) => {
  console.log("online members", members);
});

socket.on("expense-created", (expense) => {
  // update local store/UI
});

// join explicit family
socket.emit("join-family", { familyId: "<familyId>" }, (resp) => {
  if (resp && resp.error) console.error(resp.error);
});

// leave family
socket.emit("leave-family", { familyId: "<familyId>" }, (resp) => {});

// handle disconnects / reconnects
socket.on("disconnect", (reason) => {
  console.log("disconnected", reason);
});

socket.on("connect_error", (err) => {
  console.error("connect_error", err.message);
});
```

Security notes

- Always provide JWT in the `auth.token` on connect.
- Server validates token on the handshake and attaches `socket.user` with `familyId`.
- The server prevents joining families that don't match the authenticated user's `familyId`.

Server events emitted to family rooms

- expense-created, expense-updated, expense-deleted
- income-created, income-updated, income-deleted
- budget-created, budget-updated, budget-deleted
- goal-created, goal-updated, goal-deleted
- goal-contribution-added, goal-contribution-updated, goal-contribution-deleted
- activity-created
- family-online-members

All emits are sent via `src/services/socketService.js`.

If you want me to add a small client test harness (Node) or integrate into the frontend, tell me which framework you're using.
