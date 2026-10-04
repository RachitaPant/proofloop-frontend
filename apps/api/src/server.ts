import 'dotenv/config';
import app from './app';
import { connectDB } from './config/db';
import { seedData } from './config/seed';
import { startScheduler } from './services/slaEscalation.service';

// Entry point for a long-running process (local dev, Docker, Render).
// Not used on Vercel; see api/index.js for the serverless entry point.
const PORT = Number(process.env.PORT || 8080);

connectDB()
  .then(seedData)
  .then(() => {
    startScheduler();
    app.listen(PORT, () => console.log(`ProofLoop API listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
