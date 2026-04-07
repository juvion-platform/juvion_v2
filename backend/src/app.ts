import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { connectDB } from './config/db';
import { errorHandler } from './middleware/errorHandler';
import apiRouter from './routes';
import authRouter from './modules/auth/routes';

// Register workflow definitions
import './shared/workflow/definitions';

const app = express();
const PORT = process.env.PORT || 3003;

app.use(helmet());

// CORS: support multiple allowed origins via comma-separated ALLOWED_ORIGINS env var
const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Allow requests with no origin (curl, server-to-server, mobile apps)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', version: '2.0.0' }));
app.use('/api/auth', authRouter);
app.use('/api', apiRouter);
app.use(errorHandler);

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Juvion v2 API running on http://localhost:${PORT}`);
  });
}

start().catch(err => { console.error('Failed to start:', err); process.exit(1); });

export default app;
