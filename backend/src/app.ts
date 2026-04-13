import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './middleware/errorHandler';
import apiRouter from './routes';
import authRouter from './modules/auth/routes';

// Register workflow definitions
import './shared/workflow/definitions';
import './modules/admissions/workflow.handlers';

const app = express();

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

// JWT secret validation in production
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-secret')) {
  console.error('FATAL: JWT_SECRET must be set to a secure value in production');
  process.exit(1);
}

// Global rate limit: 100 requests per minute per IP
app.use(rateLimit({ windowMs: 60_000, max: 100, standardHeaders: true, legacyHeaders: false }));

// Stricter rate limit on login
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60_000, max: 10, message: { error: 'Too many login attempts. Try again in 15 minutes.' } }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', version: '2.0.0' }));
app.use('/api/auth', authRouter);
app.use('/api', apiRouter);
app.use(errorHandler);

export default app;
