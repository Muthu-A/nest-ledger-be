const FamilyMember = require("../models/FamilyMember");

// allowedRoles can be a string or array of strings
module.exports = function (allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return async (req, res, next) => {
    try {
      const familyId = req.params.familyId || req.body.familyId;
      if (!familyId) return res.status(400).json({ message: "familyId required" });
      const membership = await FamilyMember.findOne({ familyId, userId: req.user._id });
      if (!membership) return res.status(403).json({ message: "Not a family member" });
      if (!roles.includes(membership.role)) return res.status(403).json({ message: "Insufficient role" });
      req.membership = membership;
      next();
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  };
};
