const { validationResult } = require('express-validator');

// Mirrors the MethodArgumentNotValidException handler: a flat
// { fieldName: message } object, status 400, no envelope.
function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const errors = {};
  for (const e of result.array()) {
    if (!errors[e.path]) errors[e.path] = e.msg;
  }
  return res.status(400).json(errors);
}

module.exports = validate;
