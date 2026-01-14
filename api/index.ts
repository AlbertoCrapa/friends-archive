import type { VercelRequest, VercelResponse } from '@vercel/node';

// ============================================
// THE ARCHIVE - Unified API Handler
// ============================================

// Types
interface Item {
  id: string;
  title: string;
  category: string;
  dateAdded: string;
  addedBy: string;
  status: string;
  tags: string[];
  properties: Record<string, unknown>;
  watchedBy: string[];
  plannedBy: string[];
}

// In-memory store (will reset on cold starts - use Vercel KV for persistence)
const items: Map<string, Item> = new Map();

// Seed demo data
const demoItems: Item[] = [
  {
    id: '1',
    title: 'Dune',
    category: 'Films',
    dateAdded: '2024-01-15T10:00:00Z',
    addedBy: 'Alex',
    status: 'Watched',
    tags: ['sci-fi', 'epic', 'must-watch'],
    properties: { director: 'Denis Villeneuve', year: 2021, genre: ['Sci-Fi', 'Drama'], rating: 4.8 },
    watchedBy: ['Alex', 'Jordan'],
    plannedBy: ['Sam'],
  },
  {
    id: '2',
    title: 'The Bear',
    category: 'TV Series',
    dateAdded: '2024-02-01T10:00:00Z',
    addedBy: 'Jordan',
    status: 'Watching',
    tags: ['drama', 'food', 'intense'],
    properties: { seasons: 3, progress: 'S2E4', genre: ['Drama', 'Comedy'], rating: 4.9 },
    watchedBy: [],
    plannedBy: ['Alex'],
  },
  {
    id: '3',
    title: 'Project Hail Mary',
    category: 'Books',
    dateAdded: '2024-01-20T10:00:00Z',
    addedBy: 'Sam',
    status: 'Read',
    tags: ['sci-fi', 'space', 'page-turner'],
    properties: { author: 'Andy Weir', pages: 496, progress: '496/496', genre: ['Science Fiction'], rating: 4.7 },
    watchedBy: ['Sam', 'Alex'],
    plannedBy: [],
  },
  {
    id: '4',
    title: 'Oppenheimer',
    category: 'Films',
    dateAdded: '2024-03-10T10:00:00Z',
    addedBy: 'Jordan',
    status: 'Plan to Watch',
    tags: ['biography', 'history', 'nolan'],
    properties: { director: 'Christopher Nolan', year: 2023, genre: ['Biography', 'Drama', 'History'], rating: null },
    watchedBy: [],
    plannedBy: ['Alex', 'Sam', 'Jordan'],
  },
  {
    id: '5',
    title: 'Severance',
    category: 'TV Series',
    dateAdded: '2024-02-15T10:00:00Z',
    addedBy: 'Alex',
    status: 'Watched',
    tags: ['thriller', 'mystery', 'apple-tv'],
    properties: { seasons: 2, progress: 'Completed', genre: ['Thriller', 'Mystery', 'Sci-Fi'], rating: 4.8 },
    watchedBy: ['Alex'],
    plannedBy: ['Jordan', 'Sam'],
  },
  {
    id: '6',
    title: 'The Three-Body Problem',
    category: 'Books',
    dateAdded: '2024-03-01T10:00:00Z',
    addedBy: 'Alex',
    status: 'Reading',
    tags: ['sci-fi', 'chinese-lit', 'complex'],
    properties: { author: 'Liu Cixin', pages: 400, progress: '120/400', genre: ['Science Fiction', 'Hard SF'], rating: null },
    watchedBy: [],
    plannedBy: ['Sam'],
  },
];

// Initialize
if (items.size === 0) {
  demoItems.forEach((item) => items.set(item.id, item));
}

// Database operations
const db = {
  getAll: (): Item[] => Array.from(items.values()),

  getById: (id: string): Item | undefined => items.get(id),

  getFiltered: (filters: { category?: string; status?: string; tags?: string[]; addedBy?: string; search?: string }): Item[] => {
    let result = Array.from(items.values());
    if (filters.category) result = result.filter((item) => item.category === filters.category);
    if (filters.status) result = result.filter((item) => item.status === filters.status);
    if (filters.tags?.length) result = result.filter((item) => filters.tags!.some((tag) => item.tags.includes(tag)));
    if (filters.addedBy) result = result.filter((item) => item.addedBy === filters.addedBy);
    if (filters.search) {
      const s = filters.search.toLowerCase();
      result = result.filter((item) => item.title.toLowerCase().includes(s) || item.tags.some((t) => t.toLowerCase().includes(s)));
    }
    return result.sort((a, b) => new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime());
  },

  create: (item: Omit<Item, 'id' | 'dateAdded' | 'watchedBy' | 'plannedBy'>): Item => {
    const newItem: Item = { ...item, id: crypto.randomUUID(), dateAdded: new Date().toISOString(), watchedBy: [], plannedBy: [] };
    items.set(newItem.id, newItem);
    return newItem;
  },

  update: (id: string, updates: Partial<Item>): Item | null => {
    const existing = items.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, id, dateAdded: existing.dateAdded };
    items.set(id, updated);
    return updated;
  },

  delete: (id: string): boolean => items.delete(id),

  toggleUser: (id: string, field: 'watchedBy' | 'plannedBy', nickname: string): Item | null => {
    const item = items.get(id);
    if (!item) return null;
    const arr = [...item[field]];
    const idx = arr.indexOf(nickname);
    if (idx === -1) arr.push(nickname); else arr.splice(idx, 1);
    const updated = { ...item, [field]: arr };
    items.set(id, updated);
    return updated;
  },

  getAllTags: (): string[] => {
    const tags = new Set<string>();
    items.forEach((item) => item.tags.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  },
};

// Password validation
const validatePassword = (password: string): boolean => {
  return password === (process.env.ARCHIVE_PASSWORD || 'archive2024');
};

// CORS headers
const setCors = (res: VercelResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

// Main handler
export default function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = req.url || '';
  const path = url.split('?')[0].replace(/^\/api/, '');

  // Route: POST /api/auth/login
  if (path === '/auth/login' && req.method === 'POST') {
    const { nickname, password } = req.body || {};
    if (!nickname?.trim()) return res.status(400).json({ error: 'Nickname is required' });
    if (!password) return res.status(400).json({ error: 'Password is required' });
    if (!validatePassword(password)) return res.status(401).json({ error: 'Invalid password' });
    return res.status(200).json({ nickname: nickname.trim(), message: 'Login successful' });
  }

  // Route: GET /api/items
  if (path === '/items' && req.method === 'GET') {
    const { category, status, tags, addedBy, search } = req.query;
    const filters = {
      category: category as string | undefined,
      status: status as string | undefined,
      tags: tags ? (tags as string).split(',') : undefined,
      addedBy: addedBy as string | undefined,
      search: search as string | undefined,
    };
    return res.status(200).json(db.getFiltered(filters));
  }

  // Route: POST /api/items
  if (path === '/items' && req.method === 'POST') {
    const { title, category, addedBy, status, tags, properties } = req.body || {};
    if (!title || !category || !addedBy || !status) {
      return res.status(400).json({ error: 'Missing required fields: title, category, addedBy, status' });
    }
    const newItem = db.create({ title, category, addedBy, status, tags: tags || [], properties: properties || {} });
    return res.status(201).json(newItem);
  }

  // Route: GET/PUT/DELETE /api/items/:id
  const itemMatch = path.match(/^\/items\/([^/]+)$/);
  if (itemMatch) {
    const id = itemMatch[1];

    if (req.method === 'GET') {
      const item = db.getById(id);
      if (!item) return res.status(404).json({ error: 'Item not found' });
      return res.status(200).json(item);
    }

    if (req.method === 'PUT') {
      const updated = db.update(id, req.body || {});
      if (!updated) return res.status(404).json({ error: 'Item not found' });
      return res.status(200).json(updated);
    }

    if (req.method === 'DELETE') {
      if (!db.delete(id)) return res.status(404).json({ error: 'Item not found' });
      return res.status(200).json({ success: true });
    }
  }

  // Route: POST /api/items/:id/toggle
  const toggleMatch = path.match(/^\/items\/([^/]+)\/toggle$/);
  if (toggleMatch && req.method === 'POST') {
    const id = toggleMatch[1];
    const { field, nickname } = req.body || {};
    if (field !== 'watchedBy' && field !== 'plannedBy') {
      return res.status(400).json({ error: 'Invalid field. Must be watchedBy or plannedBy' });
    }
    if (!nickname) return res.status(400).json({ error: 'Nickname is required' });
    const updated = db.toggleUser(id, field, nickname);
    if (!updated) return res.status(404).json({ error: 'Item not found' });
    return res.status(200).json(updated);
  }

  // Route: GET /api/tags
  if (path === '/tags' && req.method === 'GET') {
    return res.status(200).json(db.getAllTags());
  }

  // 404 for unmatched routes
  return res.status(404).json({ error: 'Not found', path });
}
