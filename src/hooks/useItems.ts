import { useEffect, useRef, useState } from 'react';
import type { Item, CreateItemPayload, UpdateItemPayload } from '@/types';
import { itemsApi } from '@/lib/api';
import { useItemsStore } from '@/stores/items-store';

const isDev = import.meta.env.DEV;
const STORAGE_KEY = 'archive-items-backup';
const FULL_DB_KEY = 'archive-full-database';

// Mock data for offline development
const mockItems: Item[] = [
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
];

// In-memory store for dev mode
let devItems = [...mockItems];

// Helper to save to localStorage (backup key)
const saveToLocalStorage = (items: Item[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    console.warn('Failed to save to localStorage');
  }
};

// Helper to save full database (separate key for sync)
const saveFullDatabase = (items: Item[]) => {
  try {
    localStorage.setItem(FULL_DB_KEY, JSON.stringify({
      items,
      timestamp: Date.now(),
    }));
  } catch {
    console.warn('Failed to save full database to localStorage');
  }
};

// Helper to load from localStorage
const loadFromLocalStorage = (): Item[] | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    console.warn('Failed to load from localStorage');
  }
  return null;
};

// Helper to load full database
const loadFullDatabase = (): { items: Item[]; timestamp: number } | null => {
  try {
    const stored = localStorage.getItem(FULL_DB_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    console.warn('Failed to load full database from localStorage');
  }
  return null;
};

// Find differences between local and server items
const findDifferences = (localItems: Item[], serverItems: Item[]): { 
  localOnly: Item[]; 
  serverOnly: Item[];
  modified: Item[];
} => {
  const localMap = new Map(localItems.map(item => [item.id, item]));
  const serverMap = new Map(serverItems.map(item => [item.id, item]));
  
  const localOnly: Item[] = [];
  const serverOnly: Item[] = [];
  const modified: Item[] = [];
  
  // Find items only in local or modified
  for (const [id, localItem] of localMap) {
    const serverItem = serverMap.get(id);
    if (!serverItem) {
      localOnly.push(localItem);
    } else if (JSON.stringify(localItem) !== JSON.stringify(serverItem)) {
      modified.push(localItem);
    }
  }
  
  // Find items only in server
  for (const [id, serverItem] of serverMap) {
    if (!localMap.has(id)) {
      serverOnly.push(serverItem);
    }
  }
  
  return { localOnly, serverOnly, modified };
};

export function useItems() {
  const items = useItemsStore((state) => state.items);
  const isLoading = useItemsStore((state) => state.isLoading);
  const error = useItemsStore((state) => state.error);
  const hasFetched = useRef(false);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [showSyncPrompt, setShowSyncPrompt] = useState(false);
  const [localBackup, setLocalBackup] = useState<Item[] | null>(null);
  const [syncDifferences, setSyncDifferences] = useState<{
    localOnly: Item[];
    serverOnly: Item[];
    modified: Item[];
  } | null>(null);

  const fetchItems = async () => {
    const { setLoading, setItems, setError } = useItemsStore.getState();
    setLoading(true);
    
    if (isDev) {
      // Use mock data in development
      setItems(devItems);
      setLoading(false);
      return;
    }
    
    const result = await itemsApi.getAll();
    
    if (result.success && result.data) {
      const serverItems = result.data;
      
      // Check if server returned empty but we have a local backup
      if (serverItems.length === 0) {
        const backup = loadFromLocalStorage();
        if (backup && backup.length > 0) {
          setLocalBackup(backup);
          setShowRestorePrompt(true);
        }
      } else {
        // Check for differences with local full database
        const localDb = loadFullDatabase();
        if (localDb && localDb.items.length > 0) {
          const differences = findDifferences(localDb.items, serverItems);
          const hasLocalChanges = differences.localOnly.length > 0 || differences.modified.length > 0;
          
          if (hasLocalChanges) {
            setSyncDifferences(differences);
            setShowSyncPrompt(true);
          }
        }
        
        // Save successful fetch to localStorage as backup
        saveToLocalStorage(serverItems);
      }
      setItems(serverItems);
    } else {
      setError(result.error || 'Failed to fetch items');
    }
    
    setLoading(false);
  };

  const restoreFromBackup = () => {
    if (localBackup) {
      const { setItems } = useItemsStore.getState();
      setItems(localBackup);
      setShowRestorePrompt(false);
      setLocalBackup(null);
    }
  };

  const dismissRestorePrompt = () => {
    setShowRestorePrompt(false);
    setLocalBackup(null);
  };

  const dismissSyncPrompt = () => {
    setShowSyncPrompt(false);
    setSyncDifferences(null);
    // Update local database with server data to clear differences
    const currentItems = useItemsStore.getState().items;
    saveFullDatabase(currentItems);
  };

  const syncToServer = async () => {
    if (!syncDifferences) return;
    
    const { setLoading } = useItemsStore.getState();
    setLoading(true);
    
    try {
      // Add local-only items to server
      for (const item of syncDifferences.localOnly) {
        await itemsApi.create({
          title: item.title,
          category: item.category,
          status: item.status,
          tags: item.tags,
          properties: item.properties,
          addedBy: item.addedBy,
        });
      }
      
      // Update modified items on server
      for (const item of syncDifferences.modified) {
        await itemsApi.update(item.id, {
          title: item.title,
          category: item.category,
          status: item.status,
          tags: item.tags,
          properties: item.properties,
          watchedBy: item.watchedBy,
          plannedBy: item.plannedBy,
        });
      }
      
      // Refresh after sync
      await fetchItems();
      setShowSyncPrompt(false);
      setSyncDifferences(null);
    } catch (err) {
      console.error('Failed to sync to server:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch - only once
  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchItems();
    }
  }, []);

  // Polling for real-time updates (every 30 seconds) - only in production
  useEffect(() => {
    if (isDev) return; // No polling in dev mode
    const interval = setInterval(fetchItems, 30000);
    return () => clearInterval(interval);
  }, []);

  const createItem = async (payload: CreateItemPayload): Promise<Item | null> => {
    if (isDev) {
      const newItem: Item = {
        id: crypto.randomUUID(),
        ...payload,
        dateAdded: new Date().toISOString(),
        watchedBy: [],
        plannedBy: [],
      };
      devItems = [...devItems, newItem];
      await fetchItems();
      return newItem;
    }
    
    const result = await itemsApi.create(payload);
    
    if (result.success && result.data) {
      await fetchItems(); // Refresh the list
      return result.data;
    }
    
    return null;
  };

  const updateItem = async (id: string, payload: UpdateItemPayload): Promise<Item | null> => {
    if (isDev) {
      devItems = devItems.map((item) => 
        item.id === id ? { ...item, ...payload } : item
      );
      await fetchItems();
      return devItems.find((item) => item.id === id) || null;
    }
    
    const result = await itemsApi.update(id, payload);
    
    if (result.success && result.data) {
      await fetchItems(); // Refresh the list
      return result.data;
    }
    
    return null;
  };

  const deleteItem = async (id: string): Promise<boolean> => {
    if (isDev) {
      devItems = devItems.filter((item) => item.id !== id);
      await fetchItems();
      return true;
    }
    
    const result = await itemsApi.delete(id);
    
    if (result.success) {
      await fetchItems(); // Refresh the list
      return true;
    }
    
    return false;
  };

  const toggleUserStatus = async (
    id: string,
    field: 'watchedBy' | 'plannedBy',
    nickname: string
  ): Promise<Item | null> => {
    if (isDev) {
      devItems = devItems.map((item) => {
        if (item.id !== id) return item;
        const users = item[field] || [];
        const hasUser = users.includes(nickname);
        return {
          ...item,
          [field]: hasUser ? users.filter((u) => u !== nickname) : [...users, nickname],
        };
      });
      await fetchItems();
      return devItems.find((item) => item.id === id) || null;
    }
    const result = await itemsApi.toggleUserStatus(id, field, nickname);
    
    if (result.success && result.data) {
      await fetchItems(); // Refresh the list
      return result.data;
    }
    
    return null;
  };

  // Save to localStorage whenever items change (after initial fetch)
  useEffect(() => {
    if (items.length > 0 && !isDev) {
      saveToLocalStorage(items);
      saveFullDatabase(items);
    }
  }, [items]);

  return {
    items,
    isLoading,
    error,
    fetchItems,
    createItem,
    updateItem,
    deleteItem,
    toggleUserStatus,
    showRestorePrompt,
    restoreFromBackup,
    dismissRestorePrompt,
    localBackupCount: localBackup?.length || 0,
    showSyncPrompt,
    syncDifferences,
    syncToServer,
    dismissSyncPrompt,
  };
}
