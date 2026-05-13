import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import verifyRouter from './routes/verify';

// Load environment variables
dotenv.config();

const app: Express = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// --- ROUTES ---

// Medicine Verification Endpoint
app.use('/api/verify', verifyRouter);

// 1. Root Route (This fixes the "Cannot GET /" error)
app.get('/', (req: Request, res: Response) => {
  res.send('SahiDawa-India API is running successfully!');
});

// 2. Health Check Route
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start the server
app.listen(port, () => {
  console.log(`[API Server]: SahiDawa API is running at http://localhost:${port}`);
});
