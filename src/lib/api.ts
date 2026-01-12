import type { Item, CreateItemPayload, UpdateItemPayload, ItemFilters, ApiResponse } from '@/types';

const API_BASE = '/api';

/**
 * Generic fetch wrapper with error handling
 */
async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: data.error || 'Request failed' };
    }
    
    return { success: true, data };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Authentication API
 */
export const authApi = {
  login: async (nickname: string, password: string): Promise<ApiResponse<{ nickname: string }>> => {
    return apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ nickname, password }),
    });
  },
};

/**
 * Items API
 */
export const itemsApi = {
  getAll: async (filters?: ItemFilters): Promise<ApiResponse<Item[]>> => {
    const params = new URLSearchParams();
    if (filters?.category) params.append('category', filters.category);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.tags) params.append('tags', filters.tags.join(','));
    if (filters?.addedBy) params.append('addedBy', filters.addedBy);
    if (filters?.search) params.append('search', filters.search);
    
    const query = params.toString();
    return apiFetch(`/items${query ? `?${query}` : ''}`);
  },
  
  getOne: async (id: string): Promise<ApiResponse<Item>> => {
    return apiFetch(`/items/${id}`);
  },
  
  create: async (payload: CreateItemPayload): Promise<ApiResponse<Item>> => {
    return apiFetch('/items', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  
  update: async (id: string, payload: UpdateItemPayload): Promise<ApiResponse<Item>> => {
    return apiFetch(`/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
  
  delete: async (id: string): Promise<ApiResponse<void>> => {
    return apiFetch(`/items/${id}`, {
      method: 'DELETE',
    });
  },
  
  toggleUserStatus: async (
    id: string, 
    field: 'watchedBy' | 'plannedBy', 
    nickname: string
  ): Promise<ApiResponse<Item>> => {
    return apiFetch(`/items/${id}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ field, nickname }),
    });
  },
};

/**
 * Tags API
 */
export const tagsApi = {
  getAll: async (): Promise<ApiResponse<string[]>> => {
    return apiFetch('/tags');
  },
};
