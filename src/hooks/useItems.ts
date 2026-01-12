import { useState, useEffect, useCallback } from 'react';
import type { Item, CreateItemPayload, UpdateItemPayload } from '@/types';
import { itemsApi } from '@/lib/api';
import { useItemsStore } from '@/stores/items-store';

export function useItems() {
  const { items, setItems, setLoading, setError, isLoading, error } = useItemsStore();
  const [lastFetch, setLastFetch] = useState<number>(0);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const result = await itemsApi.getAll();
    
    if (result.success && result.data) {
      setItems(result.data);
      setLastFetch(Date.now());
    } else {
      setError(result.error || 'Failed to fetch items');
    }
    
    setLoading(false);
  }, [setItems, setLoading, setError]);

  // Initial fetch
  useEffect(() => {
    if (items.length === 0 || Date.now() - lastFetch > 30000) {
      fetchItems();
    }
  }, [fetchItems, items.length, lastFetch]);

  // Polling for real-time updates (every 10 seconds)
  useEffect(() => {
    const interval = setInterval(fetchItems, 10000);
    return () => clearInterval(interval);
  }, [fetchItems]);

  const createItem = async (payload: CreateItemPayload): Promise<Item | null> => {
    const result = await itemsApi.create(payload);
    
    if (result.success && result.data) {
      await fetchItems(); // Refresh the list
      return result.data;
    }
    
    return null;
  };

  const updateItem = async (id: string, payload: UpdateItemPayload): Promise<Item | null> => {
    const result = await itemsApi.update(id, payload);
    
    if (result.success && result.data) {
      await fetchItems(); // Refresh the list
      return result.data;
    }
    
    return null;
  };

  const deleteItem = async (id: string): Promise<boolean> => {
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
    const result = await itemsApi.toggleUserStatus(id, field, nickname);
    
    if (result.success && result.data) {
      await fetchItems(); // Refresh the list
      return result.data;
    }
    
    return null;
  };

  return {
    items,
    isLoading,
    error,
    fetchItems,
    createItem,
    updateItem,
    deleteItem,
    toggleUserStatus,
  };
}
