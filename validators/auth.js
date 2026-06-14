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

const signupValidators = [
  email,
  body("password")
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
    .withMessage(`Password contains disallowed characters (not allowed: < > & " ' \` / \\)`),
];

const signinValidators = [
  email,
  body("password").notEmpty().withMessage("Password is required"),
];

module.exports = { signupValidators, signinValidators };
