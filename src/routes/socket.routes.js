const express = require('express');
const router = express.Router();
const socketService = require('../services/socketService');

// Return online members for a family (for debugging/verification)
router.get('/family/:familyId/online', (req, res) => {
  const { familyId } = req.params;
  if (!familyId) return res.status(400).json({ message: 'familyId required' });
  const members = socketService.getOnlineMembers(familyId);
  res.json({ familyId, members });
});

router.get('/family/:familyId/sockets', async (req, res) => {
  const { familyId } = req.params;
  if (!familyId) return res.status(400).json({ message: 'familyId required' });
  try {
    const sockets = await socketService.getSocketsInRoom(familyId);
    res.json({ familyId, sockets });
  } catch (err) {
    console.error('socket list error', err);
    res.status(500).json({ message: 'failed to list sockets' });
  }
});

// Emit a simple test message to the family room and return sockets for verification
router.post('/family/:familyId/emit-test', async (req, res) => {
  const { familyId } = req.params;
  const message = req.body && req.body.message ? req.body.message : 'test';
  if (!familyId) return res.status(400).json({ message: 'familyId required' });
  try {
    const sockets = await socketService.getSocketsInRoom(familyId);
    // emit a test event
    socketService.emitToFamily(familyId, 'server-test', { message, ts: Date.now() });
    res.json({ familyId, sockets, emitted: true });
  } catch (err) {
    console.error('emit-test error', err);
    res.status(500).json({ message: 'failed to emit test' });
  }
});

// Emit an activity-created event (used to verify toasts/notifications)
router.post('/family/:familyId/emit-activity', async (req, res) => {
  const { familyId } = req.params;
  const { message, meta } = req.body || {};
  if (!familyId) return res.status(400).json({ message: 'familyId required' });
  try {
    const sockets = await socketService.getSocketsInRoom(familyId);
    const payload = { message: message || 'Test activity', meta: meta || {} };
    socketService.emitToFamily(familyId, 'activity-created', payload);
    res.json({ familyId, sockets, emitted: true, payload });
  } catch (err) {
    console.error('emit-activity error', err);
    res.status(500).json({ message: 'failed to emit activity' });
  }
});

module.exports = router;
