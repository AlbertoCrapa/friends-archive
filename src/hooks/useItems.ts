import { useEffect, useRef } from 'react';
import type { Item, CreateItemPayload, UpdateItemPayload } from '@/types';
import { itemsApi } from '@/lib/api';
import { useItemsStore } from '@/stores/items-store';

export function useItems() {
  const items = useItemsStore((state) => state.items);
  const isLoading = useItemsStore((state) => state.isLoading);
  const error = useItemsStore((state) => state.error);
  const hasFetched = useRef(false);

  const fetchItems = async () => {
    const { setLoading, setItems, setError } = useItemsStore.getState();
    setLoading(true);
    const result = await itemsApi.getAll();
    
    if (result.success && result.data) {
      setItems(result.data);
    } else {
      setError(result.error || 'Failed to fetch items');
    }
    
    setLoading(false);
  };

  // Initial fetch - only once
  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchItems();
    }
  }, []);

  // Polling for real-time updates (every 30 seconds)
  useEffect(() => {
    const interval = setInterval(fetchItems, 30000);
    return () => clearInterval(interval);
  }, []);

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
