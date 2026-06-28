# UI Changes Log

Date: 2026-06-01

This document records frontend quality upgrades applied after the baseline audit in `docs/UI_AUDIT.md`.

## 1. Design System Foundation

What changed:

- Reworked global design tokens in `app/globals.css` with semantic names:
- `--color-background`, `--color-surface`, `--color-surface-elevated`, `--color-border`
- `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`
- `--color-accent`, `--color-accent-hover`, `--color-destructive`, `--color-success`, `--color-warning`
- Added type scale, spacing rhythm, radius tokens, shadow tiers, motion durations/easing, and z-index tokens.
- Added reusable shimmer loader (`.skeleton-shimmer`) and `prefers-reduced-motion` fallback.

Why:

- Establishes a single source of truth for visual consistency and interaction timing.

Principle:

- Design-system tokenization and consistency.

## 2. Shared Primitive Standardization

What changed:

- Updated shared controls to consume tokenized styles and interaction states:
- `components/ui/button.tsx`
- `components/ui/input.tsx`
- `components/ui/textarea.tsx`
- `components/ui/select.tsx`
- `components/ui/dialog.tsx`
- `components/ui/label.tsx`
- Added reusable primitives:
- `components/ui/spinner.tsx`
- `components/ui/form-banner.tsx`
- `components/ui/skeleton.tsx`

Why:

- Normalizes focus, disabled behavior, cursor semantics, and visual rhythm across all forms and controls.
- Adds consistent loading and error display components.

Principle:

- Button/control variant consistency, loading and error state standardization, cursor clarity.

## 3. Motion System Integration (Framer Motion)

What changed:

- Installed Framer Motion dependency.
- Added route-level page transition wrapper:
- `components/layout/PageTransition.tsx`
- `app/layout.tsx`
- Added list-entry motion to media rows/cards in `components/features/media/MediaTable.tsx`.

Why:

- Introduces restrained, purposeful motion for state and route transitions.

Principle:

- Motion should communicate spatial/state change, never decorate passive content.

## 4. Form Loading/Error UX Improvements

What changed:

- Standardized inline loading spinner + disabled submit behavior and friendly non-technical errors in:
- `components/features/auth/LoginForm.tsx`
- `components/features/auth/RegisterForm.tsx`
- `components/features/auth/ResetPasswordForm.tsx`
- `app/update-password/page.tsx`
- `components/features/groups/CreateGroupForm.tsx`
- `components/features/groups/GroupSettings.tsx`

Why:

- Replaces inconsistent text-only loading and raw backend messages with uniform, readable feedback patterns.

Principle:

- Every async action gets visible feedback; errors use clear user-language.

## 5. Media List Mobile Usability

What changed:

- Refactored `components/features/media/MediaTable.tsx` to dual layout:
- Desktop: tabular grid view (`md+`)
- Mobile: stacked card view with full-width actions (`<md`)
- Added pending-state handling for status updates and delete actions.
- Increased action touch targets and improved destructive-action feedback.
- Updated filter/pagination controls in `components/features/media/GroupMediaSection.tsx`:
- sticky filter rail
- larger pagination controls (`min-h-11`)

Why:

- Resolves critical 390px density failure from audit and improves one-thumb operation.

Principle:

- Mobile-first interaction comfort and dense-list readability.

## 6. Dialog and Metadata Form Responsiveness

What changed:

- Updated add/edit media dialogs for mobile-friendly fields:
- two-column metadata grids now collapse to one column on small screens
- numeric inputs now include `inputMode="numeric"`
- loading/error states standardized in dialogs
- dialog shell now supports near-full-screen mobile mode

Files:

- `components/features/media/AddMediaDialog.tsx`
- `components/features/media/EditMediaItemDialog.tsx`
- `components/ui/dialog.tsx`

Why:

- Prevents cramped forms and keyboard overlap issues on mobile.

Principle:

- Mobile dialogs should be usable without zoom, precise taps, or hover assumptions.

## 7. Card Interaction Affordance

What changed:

- Added explicit pointer cursor and subtle hover-lift/shadow treatment on core clickable cards in:
- `app/(dashboard)/dashboard/page.tsx`
- `app/(dashboard)/discover/page.tsx`
- `app/profile/[nickname]/page.tsx`

Why:

- Improves immediate recognition of interactive surfaces and gives consistent hover feedback.

Principle:

- Interactive elements must feel interactive before hover-dependent discovery.

## 8. Skeleton Loading Pages

What changed:

- Added route loading skeletons:
- `app/(dashboard)/dashboard/loading.tsx`
- `app/(dashboard)/discover/loading.tsx`
- `app/(dashboard)/groups/[groupId]/loading.tsx`
- `app/(dashboard)/pricing/loading.tsx`
- `app/profile/[nickname]/loading.tsx`

Why:

- Replaces blank/snap loading with shape-matching placeholders for better perceived performance.

Principle:

- Loading state is first-class UI, not fallback.

## 9. Validation

What changed:

- Ran `npm run build` successfully after refactor.

Why:

- Confirms no TypeScript/lint/build regressions in updated frontend code.

Principle:

- Every significant UI change should be compile-validated before handoff.

## 10. Protected Route UX Hardening

What changed:

- Added explicit back/recovery actions on core protected flows:
- `app/(dashboard)/groups/new/page.tsx`
- `app/(dashboard)/groups/[groupId]/page.tsx`
- `app/(dashboard)/groups/[groupId]/settings/page.tsx`
- `app/profile/[nickname]/page.tsx`
- Improved discover correctness and async feedback:
- Real member counts now rendered instead of placeholder text.
- Join action now uses pending state UI with spinner (`JoinGroupSubmitButton`).

Why:

- Reduces navigation dead-ends and gives clearer feedback during protected-route interactions.

Principle:

- Recovery-first UX and transparent async state.

## 11. Stress Harness + Screenshot Validation

What changed:

- Added dedicated stress harness route with mock data injection:
- `app/ui-stress/page.tsx`
- Simulates data volumes: 0, 2, 20, 100, 140.
- Includes long/short text extremes for group names, media titles, nicknames, and notes.
- Used to capture screenshot matrix at 1440, 768, and 390 plus below-the-fold media section checks.

Why:

- Enables repeatable UI stress validation even when real protected routes are auth-gated in the active browser session.

Principle:

- Data-volume resilience and viewport-first verification.

## 12. Comments Replace Per-Item "Reviews"

Date: 2026-06-27

What changed:

- Replaced the old per-item "Reviews" dialog (`ConsumedByDialog.tsx`, backed by the
  one-per-user `consumption_records.note`) with a true comment thread:
  `components/features/media/CommentsDialog.tsx`, backed by the new `comments`
  table (see `docs/SUPABASE_SETUP.md` §9 / `docs/DATA_MODEL.md` §3.8).
- Each member can post **many** comments per item; everyone who can read the
  group's content reads them (members, plus any authenticated viewer for public
  groups, read-only). Each comment shows the author's nickname (joined from
  `profiles`, never stored) and the date.
- Authors can edit and delete their own comments; the group owner can delete any
  comment (moderation). A new `isOwner` boolean is threaded
  page → `GroupMediaLoader` → `GroupMediaSection` → `MediaTable` → `CommentsDialog`.
- Composer enforces the 2000-char limit with a live counter, in-button spinner +
  disabled state while posting/saving, and a friendly inline error banner.
- The "Consumed By" column is unchanged — it still derives from
  `consumption_records`, independent of comments.
- Removed `components/features/media/ConsumedByDialog.tsx`.

Why:

- Brings shared per-item discussion into scope and stops overloading the private
  consumption note as if it were a public review.

Principle:

- One concept per surface; shared discussion is a first-class, owner-moderated feature.
