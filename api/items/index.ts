import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_shared/db';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET - List all items with optional filters
  if (req.method === 'GET') {
    const { category, status, tags, addedBy, search } = req.query;
    
    const filters = {
      category: category as string | undefined,
      status: status as string | undefined,
      tags: tags ? (tags as string).split(',') : undefined,
      addedBy: addedBy as string | undefined,
      search: search as string | undefined,
    };
    
    const items = db.items.getFiltered(filters);
    return res.status(200).json(items);
  }

  // POST - Create new item
  if (req.method === 'POST') {
    const { title, category, addedBy, status, tags, properties } = req.body;
    
    if (!title || !category || !addedBy || !status) {
      return res.status(400).json({ 
        error: 'Missing required fields: title, category, addedBy, status' 
      });
    }
    
    const newItem = db.items.create({
      title,
      category,
      addedBy,
      status,
      tags: tags || [],
      properties: properties || {},
    });
    
    return res.status(201).json(newItem);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
