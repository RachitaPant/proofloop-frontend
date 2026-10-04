require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/db');
const seedData = require('./config/seed');
const slaEscalationService = require('./services/slaEscalation.service');

// Entry point for a long-running process (local dev, Docker, Render).
// Not used on Vercel — see api/index.js for the serverless entry point.
const PORT = process.env.PORT || 8080;

connectDB()
  .then(seedData)
  .then(() => {
    slaEscalationService.startScheduler();
    app.listen(PORT, () => console.log(`ProofLoop Express backend listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
