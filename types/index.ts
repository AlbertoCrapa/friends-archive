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
 * A member's personal progress on a media item. Stored per (item, user) in the
 * item_statuses table — NEVER on the shared media_items row. A missing row
 * means 'plan_to_consume'. The three values map to one uniform UI vocabulary
 * via getStatusLabel(): Planned / In progress / Completed, for every type.
 */
export type ItemStatus = 'plan_to_consume' | 'consuming' | 'completed';

/**
 * Type-specific metadata stored in the media_items.metadata JSONB column.
 */
export interface MovieMetadata {
  director?: string;
  /** External page for the director (e.g. TMDB person), when known. */
  director_url?: string;
  release_year?: number;
  duration_minutes?: number;
}

export interface TvSeriesMetadata {
  creator?: string;
  /** External page for the creator (e.g. TMDB person), when known. */
  creator_url?: string;
  release_year?: number;
  seasons?: number;
  platform?: string;
}

export interface BookMetadata {
  author?: string;
  /** External page for the author (e.g. Open Library author), when known. */
  author_url?: string;
  publication_year?: number;
  publisher?: string;
}

export interface VideoGameMetadata {
  developer?: string;
  /** External page for the developer (e.g. RAWG developer), when known. */
  developer_url?: string;
  publisher?: string;
  release_year?: number;
  platforms?: string[];
}

export type MediaMetadata =
  | MovieMetadata
  | TvSeriesMetadata
  | BookMetadata
  | VideoGameMetadata;

// ── External Identification Layer ────────────────────────────────────────────

/**
 * Trusted external providers whose stable ids we normalize into media_items.
 * One provider per media category — see lib/providers/.
 */
export type ExternalSource = 'tmdb' | 'openlibrary' | 'rawg';

/**
 * A single normalized search result from any external provider.
 * Every provider adapter maps its heterogeneous payload into THIS shape, so the
 * UI, the stored columns, and any future analytics speak one language regardless
 * of origin.
 */
export interface ExternalWork {
  /** Namespaced, provider-stable id, e.g. "tmdb:movie:693134". Identical across groups. */
  external_id: string;
  external_source: ExternalSource;
  /** External detail page to visit (cached so the UI never needs a live call). */
  external_url: string;
  type: MediaType;
  title: string;
  year?: number;
  /** Genre hint (maps to the media_items.genre column, not metadata). */
  genre?: string;
  /** Director / author / developer — shown to disambiguate suggestions. */
  subtitle?: string;
  /** Poster/cover thumbnail for the suggestion row. */
  image_url?: string;
  /** Pre-mapped into our existing per-type JSONB shape, ready to store. */
  metadata: MediaMetadata;
}

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

/**
 * A recently-approved request, enriched for the *requester's* notification UI.
 * Tells the requester that an owner accepted them into a group. Derived (not
 * stored) the same way pending requests are — see DATA_MODEL § 6.6.
 */
export interface AcceptedJoinRequest {
  id: string;
  group_id: string;
  group_name: string;
  approver_nickname: string;
  resolved_at: string;
}

// ── Media Items ──────────────────────────────────────────────────────────────

export interface MediaItem {
  id: string;
  group_id: string;
  title: string;
  type: MediaType;
  genre: string | null;
  added_by: string;
  metadata: MediaMetadata;
  /** Namespaced external id (e.g. "tmdb:movie:693134"). NULL for manual entries. */
  external_id: string | null;
  external_source: ExternalSource | null;
  external_url: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * MediaItem enriched for display: the VIEWER'S OWN status (from item_statuses;
 * missing row = 'plan_to_consume'), consumption records, comments and the
 * adder's nickname. `status` is personal — never shared across members.
 */
export interface MediaItemWithDetails extends MediaItem {
  status: ItemStatus;
  added_by_profile?: Pick<Profile, 'nickname'>;
  consumption_records?: ConsumptionRecord[];
  comments?: Comment[];
}

// ── Item Statuses (per member) ───────────────────────────────────────────────

/**
 * A member's personal status for one media item. One row per (item, user);
 * absence of a row means 'plan_to_consume'. Everything else about the item
 * stays shared — only this progress state is per-member.
 */
export interface ItemStatusRecord {
  id: string;
  media_item_id: string;
  user_id: string;
  status: ItemStatus;
  created_at: string;
  updated_at: string;
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

// ── Comments ──────────────────────────────────────────────────────────────────

/**
 * A shared comment on a media item. Stored in the `comments` table — NOT on the
 * media item and NOT in consumption_records. Many comments per item, each with
 * its own author. The author's NAME is never stored here: it is derived by
 * joining author_id -> profiles.nickname (exposed via the optional `author`).
 *
 * Read access mirrors the parent item: group members for any group, plus any
 * authenticated viewer for items in a public group (read-only). Only members can
 * write; a comment is editable by its author and deletable by its author or the
 * group owner. See DATA_MODEL § 3.8 / § 6.8.
 */
export interface Comment {
  id: string;
  media_item_id: string;
  /** UUID of the author. Join to profiles for the display name. */
  author_id: string;
  /** Comment text, 1–2000 chars (CHECK constraint in the DB). */
  body: string;
  created_at: string;
  updated_at: string;
  /** Author's nickname, joined from profiles!comments_author_id_fkey. */
  author?: Pick<Profile, 'nickname'>;
}

/** Max length of a comment body, mirrored by the DB CHECK constraint. */
export const COMMENT_MAX_LENGTH = 2000;

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
 * Returns the UI label for a status value. One vocabulary for every media
 * type, everywhere in the app (filters, dropdowns, badges):
 * Planned / In progress / Completed.
 */
export function getStatusLabel(status: ItemStatus): string {
  switch (status) {
    case 'plan_to_consume':
      return 'Planned';
    case 'consuming':
      return 'In progress';
    case 'completed':
      return 'Completed';
  }
}

/** All status values for select menus, with the uniform label */
export function getStatusOptions(): { value: ItemStatus; label: string }[] {
  return [
    { value: 'plan_to_consume', label: getStatusLabel('plan_to_consume') },
    { value: 'consuming', label: getStatusLabel('consuming') },
    { value: 'completed', label: getStatusLabel('completed') },
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
