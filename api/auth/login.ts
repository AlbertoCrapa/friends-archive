import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validatePassword } from '../_shared/db';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { nickname, password } = req.body;

  if (!nickname || typeof nickname !== 'string' || nickname.trim().length === 0) {
    return res.status(400).json({ error: 'Nickname is required' });
  }

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Password is required' });
  }

  if (!validatePassword(password)) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  return res.status(200).json({ 
    nickname: nickname.trim(),
    message: 'Login successful' 
  });
}
