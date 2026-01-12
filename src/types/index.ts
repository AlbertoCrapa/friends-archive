// ============================================
// THE ARCHIVE - Type Definitions
// ============================================

/**
 * Status options for tracking consumption progress
 */
export type ItemStatus = 'Plan to Watch' | 'Watching' | 'Watched' | 'Plan to Read' | 'Reading' | 'Read';

/**
 * Core Item entity - the unified data model
 * All categories (Films, TV Series, Books, etc.) share this structure
 */
export interface Item {
  id: string;
  title: string;
  category: string; // e.g., "Film", "TV Series", "Book" - user-defined
  dateAdded: string; // ISO date string, hidden from UI
  addedBy: string; // Nickname of who added it
  status: ItemStatus;
  tags: string[]; // Global tags across all categories
  properties: Record<string, PropertyValue>; // Flexible fields (JSON object)
  watchedBy: string[]; // Nicknames of users who watched/read
  plannedBy: string[]; // Nicknames of users planning to watch/read
}

/**
 * Allowed property value types for flexible fields
 */
export type PropertyValue = 
  | string 
  | number 
  | boolean 
  | string[] 
  | null;

/**
 * Column definition for table display
 */
export interface ColumnDefinition {
  id: string;
  key: string; // Can be a top-level field or a property key
  label: string;
  type: 'text' | 'number' | 'tags' | 'status' | 'users' | 'date';
  isProperty: boolean; // True if stored in properties object
  visible: boolean;
  width?: number;
}

/**
 * Category configuration - defines a "database" in UI terms
 */
export interface CategoryConfig {
  id: string;
  name: string; // e.g., "Films", "TV Series", "Books"
  columns: ColumnDefinition[];
  defaultStatus: ItemStatus;
}

/**
 * User session (simple nickname-based)
 */
export interface UserSession {
  nickname: string;
  isAuthenticated: boolean;
}

/**
 * API Response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Filter options for querying items
 */
export interface ItemFilters {
  category?: string;
  status?: ItemStatus;
  tags?: string[];
  addedBy?: string;
  watchedBy?: string;
  plannedBy?: string;
  search?: string;
}

/**
 * Sort configuration
 */
export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

/**
 * Create item payload
 */
export type CreateItemPayload = Omit<Item, 'id' | 'dateAdded' | 'watchedBy' | 'plannedBy'>;

/**
 * Update item payload
 */
export type UpdateItemPayload = Partial<Omit<Item, 'id' | 'dateAdded'>>;
