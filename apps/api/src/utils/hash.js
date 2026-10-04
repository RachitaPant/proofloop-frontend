const crypto = require('crypto');

// Same intent as com.proofloop.util.HashUtil (SHA-256 hash chain over each
// audit action). Note: the Spring Boot service never actually calls its
// HashUtil today, so previousHash/currentHash come back null from that
// backend — this implementation actually populates them.
const GENESIS_HASH = '0'.repeat(64);

function computeHash({ stepIndex, action, actedBy, comment, timestamp, previousHash }) {
  const data = [stepIndex, action, actedBy, comment || '', timestamp, previousHash].join('|');
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

module.exports = { GENESIS_HASH, computeHash };
