import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_shared/db';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Item ID is required' });
  }

  // GET - Get single item
  if (req.method === 'GET') {
    const item = db.items.getById(id);
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    return res.status(200).json(item);
  }

  // PUT - Update item
  if (req.method === 'PUT') {
    const updates = req.body;
    
    const updated = db.items.update(id, updates);
    
    if (!updated) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    return res.status(200).json(updated);
  }

  // DELETE - Delete item
  if (req.method === 'DELETE') {
    const deleted = db.items.delete(id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
