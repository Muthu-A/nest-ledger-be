const mongoose = require("mongoose");

/**
 * Validate if a string is a valid MongoDB ObjectId
 * @param {string} id - ID to validate
 * @returns {boolean}
 */
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Sanitize and validate string input
 * Prevents NoSQL injection by ensuring input is string type
 * @param {string} input - String to validate
 * @param {number} maxLength - Maximum allowed length
 * @returns {string|null} - Sanitized string or null if invalid
 */
const validateString = (input, maxLength = 500) => {
  if (typeof input !== "string") {
    return null;
  }
  
  const trimmed = input.trim();
  
  if (trimmed.length === 0 || trimmed.length > maxLength) {
    return null;
  }
  
  return trimmed;
};

/**
 * Validate and sanitize email
 * @param {string} email - Email to validate
 * @returns {string|null} - Lowercase email or null if invalid
 */
const validateEmail = (email) => {
  if (typeof email !== "string") {
    return null;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const lowercaseEmail = email.toLowerCase();
  
  if (!emailRegex.test(lowercaseEmail)) {
    return null;
  }
  
  return lowercaseEmail;
};

/**
 * Validate numeric value
 * Prevents injection of NaN, Infinity, etc.
 * @param {*} value - Value to validate
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @returns {number|null} - Valid number or null
 */
const validateNumber = (value, min = -Infinity, max = Infinity) => {
  const num = Number(value);
  
  if (!isFinite(num) || num < min || num > max) {
    return null;
  }
  
  return num;
};

/**
 * Validate date string or Date object
 * @param {string|Date} date - Date to validate
 * @returns {Date|null} - Valid Date object or null
 */
const validateDate = (date) => {
  const dateObj = new Date(date);
  
  if (isNaN(dateObj.getTime())) {
    return null;
  }
  
  return dateObj;
};

/**
 * Validate array of strings (prevents injection)
 * @param {*} arr - Array to validate
 * @param {number} maxLength - Max length for each string
 * @returns {string[]|null} - Validated array or null
 */
const validateStringArray = (arr, maxLength = 500) => {
  if (!Array.isArray(arr)) {
    return null;
  }
  
  const validated = arr.map(item => validateString(item, maxLength));
  
  if (validated.some(item => item === null)) {
    return null;
  }
  
  return validated;
};

/**
 * Validate that value is one of allowed enum values
 * @param {*} value - Value to validate
 * @param {string[]} allowedValues - Allowed values
 * @returns {boolean}
 */
const validateEnum = (value, allowedValues) => {
  return allowedValues.includes(String(value).toLowerCase());
};

/**
 * Filter object to only include allowed fields
 * Prevents mass assignment/object injection
 * @param {object} obj - Object to filter
 * @param {string[]} allowedFields - Allowed field names
 * @returns {object} - Filtered object
 */
const filterAllowedFields = (obj, allowedFields) => {
  const filtered = {};
  
  allowedFields.forEach(field => {
    if (field in obj) {
      filtered[field] = obj[field];
    }
  });
  
  return filtered;
};

/**
 * Get and verify familyId from user document or request
 * Prevents IDOR by verifying user membership
 * @param {object} req - Express request object
 * @param {object} FamilyMember - FamilyMember model
 * @returns {string|null} - Valid familyId or null if not authorized
 */
const getFamilyIdAndVerifyOwnership = async (req, FamilyMember) => {
  // Candidate sources (priority): user.familyId > req.params.familyId > req.body.familyId
  const candidate = req.user?.familyId || req.params?.familyId || req.body?.familyId;

  if (!candidate) {
    return null;
  }

  // Normalize to string for comparison and validate as ObjectId when present
  const familyIdStr = String(candidate);
  if (!isValidObjectId(familyIdStr)) {
    return null;
  }

  // If the user's own familyId matches the candidate, accept without extra DB lookup.
  // This avoids false negatives when a separate FamilyMember entry is missing.
  if (req.user && req.user.familyId && String(req.user.familyId) === familyIdStr) {
    return familyIdStr;
  }

  // Otherwise verify membership explicitly to prevent IDOR
  const membership = await FamilyMember.findOne({
    familyId: familyIdStr,
    userId: req.user._id
  });

  return membership ? familyIdStr : null;
};

module.exports = {
  isValidObjectId,
  validateString,
  validateEmail,
  validateNumber,
  validateDate,
  validateStringArray,
  validateEnum,
  filterAllowedFields,
  getFamilyIdAndVerifyOwnership
};
