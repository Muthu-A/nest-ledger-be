const express = require("express");
const router = express.Router();
const familyController = require("../controllers/family.controller");
const auth = require("../middlewares/auth.middleware");

router.post("/create", auth, familyController.createFamily);
router.get("/:familyId", auth, familyController.getFamily);
router.get("/", auth, familyController.getFamiliesForUser);
router.delete("/:familyId", auth, familyController.deleteFamily);

router.post("/:familyId/invite", auth, familyController.inviteMember);
router.post("/invite/:invitationCode/accept", auth, familyController.acceptInvitation);
router.post("/invite/:invitationCode/reject", auth, familyController.rejectInvitation);
// Public endpoint to view invitation details by code (used by frontend join flow)
router.get("/invite/:invitationCode/details", familyController.getInvitationDetails);

router.get("/:familyId/members", auth, familyController.listMembers);
router.delete("/:familyId/members/:userId", auth, familyController.removeMember);
router.patch("/:familyId/members/:userId/role", auth, familyController.changeRole);

router.post("/:familyId/leave", auth, familyController.leaveFamily);

module.exports = router;
