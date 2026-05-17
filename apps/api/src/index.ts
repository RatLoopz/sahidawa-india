import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables before other imports use process.env
const rootEnvPath = path.resolve(__dirname, '../../../.env');
dotenv.config({ path: rootEnvPath });

// Fallback to local .env if root doesn't exist
if (!process.env.SUPABASE_URL) {
  dotenv.config();
}

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error('\n❌ CRITICAL: Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables.');
  console.error('Please ensure you have a .env file at the repository root.');
  console.error(`Attempted locations:\n- ${rootEnvPath}\n- ${process.cwd()}/.env\n`);
  process.exit(1);
}

import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import adminRoutes from './routes/admin.routes';
import { limiter } from './middleware/rateLimit';
import reportsRouter from './routes/reports';
import pharmaciesRouter from './routes/pharmacies';
import verifyRouter from './routes/verify';
import analyticsRoutes from './routes/analytics';
import { supabase } from './db/client';

import logger from './utils/logger';
import { errorHandler } from './middleware/errorHandler';

const app: Express = express();
const port = process.env.PORT || 4000;

app.use(helmet());

// Security: restrict CORS to known origins instead of wildcard
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:4000',
  'http://localhost:8000',
];
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));
app.use(limiter);

morgan.token('status', (req: Request, res: Response) => {
  const status = res.statusCode;
  if (status >= 500) return 'error';
  if (status >= 400) return 'warn';
  return 'info';
});

app.use(
  morgan(':method :url :status - :response-time ms'),
);

morgan((tokens, req: Request, res: Response) => {
  const status = res.statusCode;
  const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
  logger.log({
    level,
    message: `${tokens.method(req, res)} ${tokens.url(req, res)} ${status} - ${tokens['response-time'](req, res)} ms`,
  });
  return undefined;
});

app.get('/', (req: Request, res: Response) => {
  logger.info('Root route accessed');
  res.send('SahiDawa-India API is running successfully!');
});

// Admin Routes
app.use('/api/v1/admin', adminRoutes);

app.get('/health', async (req: Request, res: Response) => {
  logger.info('Health check endpoint accessed');
  
  try {
    const { error } = await supabase
      .from('medicines')
      .select('id')
      .limit(1);

    if (error) {
      return res.status(503).json({
        status: 'degraded',
        db: 'unreachable',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }

    return res.json({
      status: 'ok',
      db: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({
      status: 'error',
      db: 'unreachable',
      error: message,
      timestamp: new Date().toISOString(),
    });
  }
});

app.use('/reports', reportsRouter);
app.use('/api/pharmacies', pharmaciesRouter);
app.use('/api/verify', verifyRouter);
app.use('/api/analytics', analyticsRoutes);

app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    logger.info(`SahiDawa API is running at http://localhost:${port}`);
  });
}

export default app;
