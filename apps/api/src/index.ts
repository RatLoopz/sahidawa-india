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

app.use(helmet());
app.use(cors());
app.use(express.json());

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

app.get('/health', (req: Request, res: Response) => {
  logger.info('Health check endpoint accessed');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

app.listen(port, () => {
  logger.info(`SahiDawa API is running at http://localhost:${port}`);
});