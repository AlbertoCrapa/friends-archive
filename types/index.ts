// ============================================
// THE FRIEND ARCHIVE — Type Definitions
// ============================================

// ── Media ──────────────────────────────────────────────────────────────────

/**
 * The four supported media categories.
 * IMPORTANT: 'movie' is canonical for cinema. Never use 'film' or 'films'.
 */
export type MediaType = 'movie' | 'tv_series' | 'book' | 'video_game';

/**
 * The group's collective progress on a media item.
 * Three database values map to context-sensitive UI labels via getStatusLabel().
 */
export type ItemStatus = 'plan_to_consume' | 'consuming' | 'completed';

/**
 * Type-specific metadata stored in the media_items.metadata JSONB column.
 */
export interface MovieMetadata {
  director?: string;
  release_year?: number;
  duration_minutes?: number;
}

export interface TvSeriesMetadata {
  creator?: string;
  release_year?: number;
  seasons?: number;
  platform?: string;
}

export interface BookMetadata {
  author?: string;
  publication_year?: number;
  publisher?: string;
}

export interface VideoGameMetadata {
  developer?: string;
  publisher?: string;
  release_year?: number;
  platforms?: string[];
}

export type MediaMetadata =
  | MovieMetadata
  | TvSeriesMetadata
  | BookMetadata
  | VideoGameMetadata;

// ── Users / Auth ────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  nickname: string;
  created_at: string;
  updated_at: string;
}

// ── Subscriptions ────────────────────────────────────────────────────────────

export type SubscriptionPlan = 'free' | 'premium' | 'enterprise';
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'trialing';

export interface Subscription {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  started_at: string;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Groups ───────────────────────────────────────────────────────────────────

export type GroupVisibility = 'public' | 'private';
export type GroupRole = 'owner' | 'member';

export interface Group {
  id: string;
  name: string;
  description: string | null;
  visibility: GroupVisibility;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: GroupRole;
  joined_at: string;
}

/** Group with computed counts — used on dashboard and discover page */
export interface GroupWithCounts extends Group {
  member_count: number;
  item_count: number;
  owner_nickname?: string;
}

/** Current user's membership context within a group */
export interface GroupMembership {
  isMember: boolean;
  role: GroupRole | null;
}

// ── Join Requests ────────────────────────────────────────────────────────────

/**
 * Lifecycle of a join request. Both public and private groups require an
 * approved request before a user becomes a member.
 */
export type JoinRequestStatus = 'pending' | 'approved' | 'declined';

export interface GroupJoinRequest {
  id: string;
  group_id: string;
  user_id: string;
  status: JoinRequestStatus;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Pending request enriched for the owner's notification UI */
export interface PendingJoinRequest {
  id: string;
  group_id: string;
  group_name: string;
  requester_nickname: string;
  created_at: string;
}

// ── Media Items ──────────────────────────────────────────────────────────────

export interface MediaItem {
  id: string;
  group_id: string;
  title: string;
  type: MediaType;
  status: ItemStatus;
  genre: string | null;
  added_by: string;
  metadata: MediaMetadata;
  created_at: string;
  updated_at: string;
}

/** MediaItem with its consumption records and adder's nickname */
export interface MediaItemWithDetails extends MediaItem {
  added_by_profile?: Pick<Profile, 'nickname'>;
  consumption_records?: ConsumptionRecord[];
}

// ── Consumption Records ──────────────────────────────────────────────────────

export interface ConsumptionRecord {
  id: string;
  media_item_id: string;
  user_id: string;
  consumed_at: string;
  note: string | null;
  created_at: string;
  updated_at: string;
  profile?: Pick<Profile, 'nickname'>;
}

// ── Filters ──────────────────────────────────────────────────────────────────

export interface MediaFilters {
  search?: string;
  type?: MediaType | 'all';
  status?: ItemStatus;
  added_by?: string;
  genre?: string;
}

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns the UI label for a status value, appropriate for the given media type.
 */
export function getStatusLabel(status: ItemStatus, type: MediaType): string {
  switch (status) {
    case 'plan_to_consume':
      if (type === 'book') return 'Plan to Read';
      if (type === 'video_game') return 'Plan to Play';
      return 'Plan to Watch';
    case 'consuming':
      if (type === 'book') return 'Reading';
      if (type === 'video_game') return 'Playing';
      return 'Watching';
    case 'completed':
      if (type === 'book') return 'Read';
      if (type === 'video_game') return 'Played';
      return 'Watched';
  }
}

/** All status values for select menus, with their label for a given type */
export function getStatusOptions(type: MediaType): { value: ItemStatus; label: string }[] {
  return [
    { value: 'plan_to_consume', label: getStatusLabel('plan_to_consume', type) },
    { value: 'consuming', label: getStatusLabel('consuming', type) },
    { value: 'completed', label: getStatusLabel('completed', type) },
  ];
}

/** Human-readable label for a media type */
export function getTypeLabel(type: MediaType): string {
  switch (type) {
    case 'movie': return 'Movie';
    case 'tv_series': return 'TV Series';
    case 'book': return 'Book';
    case 'video_game': return 'Game';
  }
}

/** Plural label for a media type tab */
export function getTypePluralLabel(type: MediaType): string {
  switch (type) {
    case 'movie': return 'Movies';
    case 'tv_series': return 'TV Series';
    case 'book': return 'Books';
    case 'video_game': return 'Games';
  }
}

/** Subscription plan limits */
export const PLAN_LIMITS: Record<SubscriptionPlan, { maxOwned: number; maxTotal: number | null }> = {
  free: { maxOwned: 2, maxTotal: 5 },
  premium: { maxOwned: 10, maxTotal: null },
  enterprise: { maxOwned: Infinity, maxTotal: null },
};

/** Plan display names and pricing */
export const PLAN_DISPLAY: Record<SubscriptionPlan, { name: string; price: string }> = {
  free: { name: 'Free', price: '€0' },
  premium: { name: 'Premium', price: '€3/month' },
  enterprise: { name: 'Enterprise', price: 'Custom' },
};
