import { create } from 'zustand';
import type { Item, CategoryConfig, ItemFilters, SortConfig, ColumnDefinition } from '@/types';

// Default category configurations
const defaultCategories: CategoryConfig[] = [
  {
    id: 'films',
    name: 'Films',
    defaultStatus: 'Plan to Watch',
    columns: [
      { id: 'title', key: 'title', label: 'Title', type: 'text', isProperty: false, visible: true, width: 300 },
      { id: 'status', key: 'status', label: 'Status', type: 'status', isProperty: false, visible: true, width: 140 },
      { id: 'director', key: 'director', label: 'Director', type: 'text', isProperty: true, visible: true, width: 180 },
      { id: 'year', key: 'year', label: 'Year', type: 'number', isProperty: true, visible: true, width: 80 },
      { id: 'genre', key: 'genre', label: 'Genre', type: 'tags', isProperty: true, visible: true, width: 200 },
      { id: 'rating', key: 'rating', label: 'Rating', type: 'number', isProperty: true, visible: true, width: 80 },
      { id: 'tags', key: 'tags', label: 'Tags', type: 'tags', isProperty: false, visible: true, width: 200 },
      { id: 'addedBy', key: 'addedBy', label: 'Added By', type: 'text', isProperty: false, visible: true, width: 120 },
      { id: 'watchedBy', key: 'watchedBy', label: 'Watched By', type: 'users', isProperty: false, visible: true, width: 150 },
    ],
  },
  {
    id: 'tv-series',
    name: 'TV Series',
    defaultStatus: 'Plan to Watch',
    columns: [
      { id: 'title', key: 'title', label: 'Title', type: 'text', isProperty: false, visible: true, width: 300 },
      { id: 'status', key: 'status', label: 'Status', type: 'status', isProperty: false, visible: true, width: 140 },
      { id: 'seasons', key: 'seasons', label: 'Seasons', type: 'number', isProperty: true, visible: true, width: 80 },
      { id: 'progress', key: 'progress', label: 'Progress', type: 'text', isProperty: true, visible: true, width: 100 },
      { id: 'genre', key: 'genre', label: 'Genre', type: 'tags', isProperty: true, visible: true, width: 200 },
      { id: 'rating', key: 'rating', label: 'Rating', type: 'number', isProperty: true, visible: true, width: 80 },
      { id: 'tags', key: 'tags', label: 'Tags', type: 'tags', isProperty: false, visible: true, width: 200 },
      { id: 'addedBy', key: 'addedBy', label: 'Added By', type: 'text', isProperty: false, visible: true, width: 120 },
      { id: 'watchedBy', key: 'watchedBy', label: 'Watched By', type: 'users', isProperty: false, visible: true, width: 150 },
    ],
  },
  {
    id: 'books',
    name: 'Books',
    defaultStatus: 'Plan to Read',
    columns: [
      { id: 'title', key: 'title', label: 'Title', type: 'text', isProperty: false, visible: true, width: 300 },
      { id: 'status', key: 'status', label: 'Status', type: 'status', isProperty: false, visible: true, width: 140 },
      { id: 'author', key: 'author', label: 'Author', type: 'text', isProperty: true, visible: true, width: 180 },
      { id: 'pages', key: 'pages', label: 'Pages', type: 'number', isProperty: true, visible: true, width: 80 },
      { id: 'progress', key: 'progress', label: 'Progress', type: 'text', isProperty: true, visible: true, width: 100 },
      { id: 'genre', key: 'genre', label: 'Genre', type: 'tags', isProperty: true, visible: true, width: 200 },
      { id: 'rating', key: 'rating', label: 'Rating', type: 'number', isProperty: true, visible: true, width: 80 },
      { id: 'tags', key: 'tags', label: 'Tags', type: 'tags', isProperty: false, visible: true, width: 200 },
      { id: 'addedBy', key: 'addedBy', label: 'Added By', type: 'text', isProperty: false, visible: true, width: 120 },
    ],
  },
];

interface ItemsState {
  items: Item[];
  categories: CategoryConfig[];
  activeCategory: string;
  filters: ItemFilters;
  sort: SortConfig;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setItems: (items: Item[]) => void;
  addItem: (item: Item) => void;
  updateItem: (id: string, updates: Partial<Item>) => void;
  deleteItem: (id: string) => void;
  setActiveCategory: (category: string) => void;
  setFilters: (filters: ItemFilters) => void;
  setSort: (sort: SortConfig) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateColumnVisibility: (categoryId: string, columnId: string, visible: boolean) => void;
  addCategory: (category: CategoryConfig) => void;
  addColumnToCategory: (categoryId: string, column: ColumnDefinition) => void;
}

export const useItemsStore = create<ItemsState>((set) => ({
  items: [],
  categories: defaultCategories,
  activeCategory: 'films',
  filters: {},
  sort: { field: 'dateAdded', direction: 'asc' },
  isLoading: false,
  error: null,
  
  setItems: (items) => set({ items }),
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  updateItem: (id, updates) => set((state) => ({
    items: state.items.map((item) => item.id === id ? { ...item, ...updates } : item),
  })),
  deleteItem: (id) => set((state) => ({
    items: state.items.filter((item) => item.id !== id),
  })),
  setActiveCategory: (category) => set({ activeCategory: category }),
  setFilters: (filters) => set({ filters }),
  setSort: (sort) => set({ sort }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  updateColumnVisibility: (categoryId, columnId, visible) => set((state) => ({
    categories: state.categories.map((cat) =>
      cat.id === categoryId
        ? {
            ...cat,
            columns: cat.columns.map((col) =>
              col.id === columnId ? { ...col, visible } : col
            ),
          }
        : cat
    ),
  })),
  addCategory: (category) => set((state) => ({
    categories: [...state.categories, category],
  })),
  addColumnToCategory: (categoryId, column) => set((state) => ({
    categories: state.categories.map((cat) =>
      cat.id === categoryId
        ? { ...cat, columns: [...cat.columns, column] }
        : cat
    ),
  })),
}));

// Selectors
export const selectFilteredItems = (state: ItemsState): Item[] => {
  let filtered = state.items;
  const category = state.categories.find((c) => c.id === state.activeCategory);
  
  // Filter by category name
  if (category) {
    filtered = filtered.filter((item) => item.category === category.name);
  }
  
  // Apply additional filters
  if (state.filters.status) {
    filtered = filtered.filter((item) => item.status === state.filters.status);
  }
  
  if (state.filters.tags && state.filters.tags.length > 0) {
    filtered = filtered.filter((item) =>
      state.filters.tags!.some((tag) => item.tags.includes(tag))
    );
  }
  
  if (state.filters.addedBy) {
    filtered = filtered.filter((item) => item.addedBy === state.filters.addedBy);
  }
  
  if (state.filters.search) {
    const search = state.filters.search.toLowerCase();
    filtered = filtered.filter((item) =>
      item.title.toLowerCase().includes(search) ||
      item.tags.some((tag) => tag.toLowerCase().includes(search))
    );
  }
  
  // Sort
  filtered = [...filtered].sort((a, b) => {
    const field = state.sort.field;
    let aVal: unknown = a[field as keyof Item];
    let bVal: unknown = b[field as keyof Item];
    
    // Check if it's a property field
    if (aVal === undefined && a.properties[field] !== undefined) {
      aVal = a.properties[field];
      bVal = b.properties[field];
    }
    
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return state.sort.direction === 'asc' 
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return state.sort.direction === 'asc' ? aVal - bVal : bVal - aVal;
    }
    
    return 0;
  });
  
  return filtered;
};

export const selectAllTags = (state: ItemsState): string[] => {
  const tagSet = new Set<string>();
  state.items.forEach((item) => {
    item.tags.forEach((tag) => tagSet.add(tag));
  });
  return Array.from(tagSet).sort();
};
