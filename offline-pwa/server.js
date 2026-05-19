import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import dotenv from 'dotenv';
import twilio from 'twilio';

dotenv.config();
const app = express();
const port = process.env.PORT || 3001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');

app.use(cors());
app.use(express.json());
app.use(express.static(publicDir));

const verificationStore = new Map();
const syncHistoryStore = [];

const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? new twilio.Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

app.post('/api/verify/request', (req, res) => {
  const { phone } = req.body;
  if (!phone || typeof phone !== 'string') {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  const otp = generateOtp();
  verificationStore.set(phone, otp);

  if (twilioClient && process.env.TWILIO_FROM_NUMBER) {
    twilioClient.messages
      .create({
        body: `Your medicine app verification code is ${otp}`,
        from: process.env.TWILIO_FROM_NUMBER,
        to: phone
      })
      .then(() => {
        res.json({ status: 'sent' });
      })
      .catch((error) => {
        console.error('Twilio SMS failed', error);
        res.status(500).json({ error: 'SMS send failed' });
      });
  } else {
    console.info('SMS mock mode, OTP for', phone, '=>', otp);
    res.json({ status: 'mock', otp });
  }
});

app.post('/api/verify/confirm', (req, res) => {
  const { phone, code } = req.body;
  if (!phone || typeof phone !== 'string' || !code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Phone and code are required' });
  }

  const stored = verificationStore.get(phone);
  if (stored === code) {
    verificationStore.delete(phone);
    return res.json({ verified: true });
  }

  res.status(401).json({ verified: false, error: 'Invalid code' });
});

app.post('/api/history/sync', (req, res) => {
  const { phone, history } = req.body;
  if (!phone || !Array.isArray(history)) {
    return res.status(400).json({ error: 'Phone and history array are required' });
  }

  syncHistoryStore.push({ phone, timestamp: new Date().toISOString(), history });
  res.json({ synced: true, records: history.length });
});

app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', online: true });
});

app.use((req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(port, () => {
  console.log(`Offline PWA server running on http://localhost:${port}`);
});
