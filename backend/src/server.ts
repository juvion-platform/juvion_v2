import 'dotenv/config';
import { connectDB } from './config/db';
import app from './app';

const PORT = process.env.PORT || 3003;

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Juvion v2 API running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
