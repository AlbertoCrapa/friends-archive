import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../_shared/db';

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

  const { id } = req.query;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Item ID is required' });
  }

  const { field, nickname } = req.body;
  
  if (!field || (field !== 'watchedBy' && field !== 'plannedBy')) {
    return res.status(400).json({ error: 'Invalid field. Must be watchedBy or plannedBy' });
  }
  
  if (!nickname || typeof nickname !== 'string') {
    return res.status(400).json({ error: 'Nickname is required' });
  }

  const updated = db.items.toggleUserInArray(id, field, nickname);
  
  if (!updated) {
    return res.status(404).json({ error: 'Item not found' });
  }
  
  return res.status(200).json(updated);
}
