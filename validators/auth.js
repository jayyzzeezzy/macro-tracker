const { body } = require("express-validator");

// Allowed special characters for passwords.
// Deliberately EXCLUDES characters commonly used in XSS / HTML-injection
// payloads: < > & " ' ` / \
// (Note: passwords are hashed and never rendered, so this is defense-in-depth,
//  not a substitute for output-encoding on the frontend.)
const SPECIALS = "!@#$%^*()_+\\-=\\[\\]{}|;:,.?~";

const hasLower = /[a-z]/;
const hasUpper = /[A-Z]/;
const hasDigit = /\d/;
const hasSpecial = new RegExp(`[${SPECIALS}]`);
const allowedOnly = new RegExp(`^[A-Za-z0-9${SPECIALS}]+$`);

const email = body("email")
  .trim()
  .notEmpty()
  .withMessage("Email is required")
  .bail()
  .isEmail()
  .withMessage("Must be a valid email address")
  .bail()
  .isLength({ max: 254 })
  .withMessage("Email is too long")
  .customSanitizer((v) => v.toLowerCase());

// Password strength rules — shared by signup and set-password.
const password = body("password")
  .exists({ values: "falsy" })
  .withMessage("Password is required")
  .bail()
  .isString()
  .withMessage("Password must be a string")
  .bail()
  .isLength({ min: 8, max: 50 })
  .withMessage("Password must be 8–50 characters")
  .matches(hasLower)
  .withMessage("Password must include a lowercase letter")
  .matches(hasUpper)
  .withMessage("Password must include an uppercase letter")
  .matches(hasDigit)
  .withMessage("Password must include a number")
  .matches(hasSpecial)
  .withMessage("Password must include a special character")
  .matches(allowedOnly)
  .withMessage(`Password contains disallowed characters (not allowed: < > & " ' \` / \\)`);

const signupValidators = [
  email,
  // Display name — how the user wants to be addressed. Names legitimately
  // contain spaces, apostrophes, hyphens and accented letters, so we only
  // check presence/length here. It IS rendered in the UI, so the frontend
  // must output-encode it (defense against XSS is the caller's job).
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .bail()
    .isLength({ max: 50 })
    .withMessage("Name must be 50 characters or fewer"),
  password,
];

const signinValidators = [
  email,
  body("password").notEmpty().withMessage("Password is required"),
];

// For an authenticated user setting a password on a passwordless account
// (e.g. one created via Google). Same strength rules; no email/name needed.
const setPasswordValidators = [password];

module.exports = { signupValidators, signinValidators, setPasswordValidators };
