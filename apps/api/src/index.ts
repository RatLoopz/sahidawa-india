import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import logger from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// HTTP request logging with Winston
app.use(
  morgan('combined', {
    stream: {
      write: (message: string) => {
        const trimmed = message.trim();
        if (trimmed.includes(' 4')) {
          logger.warn(trimmed);
        } else if (trimmed.includes(' 5')) {
          logger.error(trimmed);
        } else {
          logger.info(trimmed);
        }
      },
    },
  })
);

// --- Routes ---

app.get('/', (req: Request, res: Response) => {
  logger.info('Root route accessed');
  res.send('SahiDawa-India API is running successfully!');
});

app.get('/health', (req: Request, res: Response) => {
  logger.info('Health check endpoint accessed');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Centralized error handler
app.use(errorHandler);

// Start the server
app.listen(port, () => {
  logger.info(`SahiDawa API is running at http://localhost:${port}`);
});