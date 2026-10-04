const mongoose = require('mongoose');

function send(res, status, error, message) {
  return res.status(status).json({ timestamp: new Date().toISOString(), status, error, message });
}

// Mirrors com.proofloop.exception.GlobalExceptionHandler response shapes.
function errorHandler(err, _req, res, _next) {
  if (err.status && err.error) {
    return send(res, err.status, err.error, err.message);
  }

  // Optimistic-concurrency conflict: someone else modified the document
  // between our read and our save (e.g. two approvers clicking at once).
  if (err instanceof mongoose.Error.VersionError) {
    return send(res, 409, 'Conflict', 'This record was modified by someone else. Refresh and try again.');
  }

  if (err instanceof mongoose.Error.CastError) {
    return send(res, 404, 'Not Found', 'Resource not found');
  }

  // Malformed JSON body from express.json()
  if (err.type === 'entity.parse.failed') {
    return send(res, 400, 'Bad Request', 'Malformed JSON body');
  }

  console.error(err);
  const message = process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message;
  return send(res, 500, 'Internal Server Error', message);
}

module.exports = errorHandler;
