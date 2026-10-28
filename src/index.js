import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { handleCommission } from './commission.js';

const app = express();
const PORT = process.env.PORT || 8080;

const allowedOrigins = [
  'https://byjihan.com',
  'https://www.byjihan.com',
  'http://localhost:5173',
  'http://localhost:80',
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
}));

app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/commission',     handleCommission);
app.post('/api/commission', handleCommission);

app.listen(PORT, () => console.log(`jihan-mihwar listening on :${PORT}`));
