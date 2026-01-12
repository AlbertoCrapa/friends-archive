// ============================================
// THE ARCHIVE - Shared API Types & Utilities
// ============================================

export interface Item {
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

export interface ApiError {
  error: string;
}

/**
 * Simple in-memory store for demo purposes
 * In production, replace with a real database (Vercel KV, Postgres, etc.)
 */
const items: Map<string, Item> = new Map();

// Seed with demo data
const demoItems: Item[] = [
  {
    id: '1',
    title: 'Dune',
    category: 'Films',
    dateAdded: '2024-01-15T10:00:00Z',
    addedBy: 'Alex',
    status: 'Watched',
    tags: ['sci-fi', 'epic', 'must-watch'],
    properties: {
      director: 'Denis Villeneuve',
      year: 2021,
      genre: ['Sci-Fi', 'Drama'],
      rating: 4.8,
    },
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
    properties: {
      seasons: 3,
      progress: 'S2E4',
      genre: ['Drama', 'Comedy'],
      rating: 4.9,
    },
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
    properties: {
      author: 'Andy Weir',
      pages: 496,
      progress: '496/496',
      genre: ['Science Fiction'],
      rating: 4.7,
    },
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
    properties: {
      director: 'Christopher Nolan',
      year: 2023,
      genre: ['Biography', 'Drama', 'History'],
      rating: null,
    },
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
    properties: {
      seasons: 2,
      progress: 'Completed',
      genre: ['Thriller', 'Mystery', 'Sci-Fi'],
      rating: 4.8,
    },
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
    properties: {
      author: 'Liu Cixin',
      pages: 400,
      progress: '120/400',
      genre: ['Science Fiction', 'Hard SF'],
      rating: null,
    },
    watchedBy: [],
    plannedBy: ['Sam'],
  },
];

// Initialize demo data
demoItems.forEach((item) => items.set(item.id, item));

export const db = {
  items: {
    getAll: (): Item[] => Array.from(items.values()),
    
    getById: (id: string): Item | undefined => items.get(id),
    
    getFiltered: (filters: {
      category?: string;
      status?: string;
      tags?: string[];
      addedBy?: string;
      search?: string;
    }): Item[] => {
      let result = Array.from(items.values());
      
      if (filters.category) {
        result = result.filter((item) => item.category === filters.category);
      }
      
      if (filters.status) {
        result = result.filter((item) => item.status === filters.status);
      }
      
      if (filters.tags && filters.tags.length > 0) {
        result = result.filter((item) =>
          filters.tags!.some((tag) => item.tags.includes(tag))
        );
      }
      
      if (filters.addedBy) {
        result = result.filter((item) => item.addedBy === filters.addedBy);
      }
      
      if (filters.search) {
        const search = filters.search.toLowerCase();
        result = result.filter(
          (item) =>
            item.title.toLowerCase().includes(search) ||
            item.tags.some((tag) => tag.toLowerCase().includes(search))
        );
      }
      
      // Sort by dateAdded ascending (oldest first)
      result.sort((a, b) => new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime());
      
      return result;
    },
    
    create: (item: Omit<Item, 'id' | 'dateAdded' | 'watchedBy' | 'plannedBy'>): Item => {
      const newItem: Item = {
        ...item,
        id: crypto.randomUUID(),
        dateAdded: new Date().toISOString(),
        watchedBy: [],
        plannedBy: [],
      };
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
    
    delete: (id: string): boolean => {
      return items.delete(id);
    },
    
    toggleUserInArray: (
      id: string,
      field: 'watchedBy' | 'plannedBy',
      nickname: string
    ): Item | null => {
      const item = items.get(id);
      if (!item) return null;
      
      const array = [...item[field]];
      const index = array.indexOf(nickname);
      
      if (index === -1) {
        array.push(nickname);
      } else {
        array.splice(index, 1);
      }
      
      const updated = { ...item, [field]: array };
      items.set(id, updated);
      return updated;
    },
    
    getAllTags: (): string[] => {
      const tagSet = new Set<string>();
      items.forEach((item) => {
        item.tags.forEach((tag) => tagSet.add(tag));
      });
      return Array.from(tagSet).sort();
    },
  },
};

/**
 * Password validation
 * The password is stored in environment variable ARCHIVE_PASSWORD
 */
export function validatePassword(password: string): boolean {
  const correctPassword = process.env.ARCHIVE_PASSWORD || 'archive2024';
  return password === correctPassword;
}
