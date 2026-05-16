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
// Capture rawBody alongside parsed JSON so webhook HMAC verification can
// hash the exact byte sequence the sender signed. ~10MB overhead cap per
// request; same as the JSON limit so no new memory ceiling introduced.
app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf) => {
    (req as unknown as { rawBody?: Buffer }).rawBody = buf;
  },
}));

// JWT secret validation in production
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-secret')) {
  console.error('FATAL: JWT_SECRET must be set to a secure value in production');
  process.exit(1);
}

// Payment webhook secret validation in production — webhooks are rejected
// without it, so this fails loudly at startup rather than silently breaking
// real payment flows.
if (process.env.NODE_ENV === 'production' && !process.env.PAYMENT_WEBHOOK_SECRET) {
  console.error('FATAL: PAYMENT_WEBHOOK_SECRET must be set in production');
  process.exit(1);
}

// Global rate limit: 100 requests per minute per IP.
// E2E_TESTING bypass keeps the Playwright suite (and other automated
// load) from tripping the limit. Production NEVER sets this.
const isE2ETesting = process.env.E2E_TESTING === '1' || process.env.E2E_TESTING === 'true';
if (!isE2ETesting) {
  app.use(rateLimit({ windowMs: 60_000, max: 100, standardHeaders: true, legacyHeaders: false }));
  // Stricter rate limit on login.
  app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60_000, max: 10, message: { error: 'Too many login attempts. Try again in 15 minutes.' } }));
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok', version: '2.0.0' }));
app.use('/api/auth', authRouter);
app.use('/api', apiRouter);
app.use(errorHandler);

export default app;
