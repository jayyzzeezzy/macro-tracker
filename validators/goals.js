const { body } = require("express-validator");

// Daily macro goals sent as short keys (calories/protein/carbs/fat) to match
// the frontend shape. Each is required, numeric, >= 0, with a sane upper bound.
// Upper bounds guard against typos / absurd values, not real nutrition limits.
function goalField(name, max) {
  return body(name)
    .exists({ values: "falsy" })
    .withMessage(`${name} is required`)
    .bail()
    .isFloat({ min: 0, max })
    .withMessage(`${name} must be a number between 0 and ${max}`)
    .bail()
    .toFloat();
}

const goalsValidators = [
  goalField("calories", 20000),
  goalField("protein", 2000),
  goalField("carbs", 2000),
  goalField("fat", 2000),
];

module.exports = { goalsValidators };
