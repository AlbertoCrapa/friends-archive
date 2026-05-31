# UI Audit — The Friend Archive

Date: 2026-06-01  
Scope: Observation-only audit (no production UI code changes yet)

## Style DNA

The current interface already has a distinctive foundation and should be evolved, not replaced.

### Visual Identity Snapshot

- Dominant palette: stone-black and charcoal surfaces (`stone-950`, `stone-900`, `stone-800`) with amber as a single accent (`amber-500/600`), occasional emerald/red for state signaling.
- Tone: archival, cinematic, low-light, editorial. The mood is intentional and coherent on core pages.
- Typography system:
- Serif display (`Cormorant Garamond`) for headings and brand moments.
- Mono UI voice (`JetBrains Mono`) for labels, controls, metadata.
- This serif+mono pairing is unusual and brand-forward, not generic.
- Spacing rhythm: mostly `space-y-4/5/8`, `px-6`, `py-3/4/8`, with generally consistent vertical breathing room in page shells.
- Shape language: mostly square corners, hard edges, thin borders, subtle glass on sticky header. Feels aligned with the archival/brutalist direction.
- Motion language today: subtle fades/scales via global keyframes and Radix animation classes. Mostly restrained.

### Elements That Already Work Well (Must Be Preserved)

- Brand mood and palette discipline across landing and auth pages.
- Serif hero/heading treatment with mono metadata labels.
- Global focus visibility (`:focus-visible` amber outline) and dark theme consistency.
- Button variant foundation in shared `components/ui/button.tsx`.
- Status badges and media status color mapping in `lib/utils.ts`.
- Border-driven card system in dashboard/discover/profile cards.

## Screenshot Capture Coverage

Screenshots captured at 1440, 768, and 390 widths for:

- Landing (`/`)
- Login (`/login`)
- Register (`/register`)
- Reset password (`/reset-password`)
- Update password (`/update-password`) — pre-recovery state
- Upgrade (`/upgrade`)
- Not found (`/this-route-does-not-exist`)

Protected route runtime behavior verified (all redirected to `/login` in current session):

- `/dashboard`
- `/discover`
- `/groups/new`
- `/groups/[groupId]`
- `/groups/[groupId]/settings`
- `/profile/[nickname]`
- `/pricing`

Note: Protected pages are audited primarily from source due auth gating in this session.

## Issues By Page and Severity

## Landing Page (`app/page.tsx`)

### High

- Feature section has no semantic section heading; jumps from H1 directly to repeated H3 cards, weakening document hierarchy and screen-reader section navigation.
- CTA links wrap `Button` components, creating nested interactive semantics risk in some assistive contexts when `asChild` is not used.

### Medium

- Feature icons use raw Unicode symbols (`◫`, `◎`, `◈`) instead of icon components, causing inconsistent rendering weight and alignment across platforms.
- Footer and metadata text can become too low contrast (`text-stone-600` on `stone-950`) for body-sized text in some displays.
- No reduced-motion branch for animated utility classes.

### Low

- Hover affordance for links/buttons is mostly color-only; no additional underline or transform cue for some text links.

## Login Page (`app/(auth)/login/page.tsx`, `components/features/auth/LoginForm.tsx`)

### High

- Loading state is text-only (`Signing in…`) with no inline spinner; feedback is easy to miss.
- Server/auth error messages are raw provider strings, which may expose technical phrasing and inconsistent tone.

### Medium

- Error block appears abruptly; no transition for state change.
- Label style is all-caps mono with wide tracking; legibility degrades on mobile and for dyslexic users.
- Auth helper links rely on color-only distinction and no persistent underline.

## Register Page (`app/(auth)/register/page.tsx`, `components/features/auth/RegisterForm.tsx`)

### High

- Same loading-state issue as login (text swap only, no spinner).
- Nickname availability pre-check has no visible intermediate state; users can perceive lag as unresponsive form.
- Backend error strings can be displayed verbatim.

### Medium

- Field-level validation is not surfaced inline per field; all errors are consolidated in a generic block.
- Supporting helper copy (`Your unique handle...`) is very low contrast at small size.

## Reset Password (`app/(auth)/reset-password/page.tsx`, `components/features/auth/ResetPasswordForm.tsx`)

### High

- Submit loading state is text-only (`Sending…`) with no spinner.
- Success state is plain static block without action affordance (no resend, no change email path).

### Medium

- Error treatment differs from success treatment and lacks entry transition.
- Small text in success state (`text-xs`) trends toward under-14px comfort threshold on mobile.

## Update Password (`app/update-password/page.tsx`)

### High

- Verifying state can remain static indefinitely with no progress indicator (only text), risking uncertainty.

### Medium

- Recovery wait-state copy and link are low contrast and small on 390px.
- Error pattern differs from other forms (inconsistent tone/system).

## Upgrade Page (`app/upgrade/page.tsx`)

### Medium

- Layout is visually sparse and elegant but too minimal for conversion intent; no secondary context (plan summary, expected timeline, contact alternatives).
- Single tiny CTA with modest contrast limits discoverability.

### Low

- Unicode icon token again introduces rendering variability.

## Not Found (`app/not-found.tsx`)

### Medium

- "Go to dashboard" can route unauthenticated users into immediate redirect loops to login, causing context friction.
- Error recovery options are too narrow (no "Go home" or "Back").

## Dashboard (`app/(dashboard)/dashboard/page.tsx`)

### High

- No skeleton loading state for async server content; page snaps in when data resolves.
- Group cards are entirely clickable via wrapper `Link`; cursor behavior relies on browser defaults and lacks explicit interactive reinforcement.

### Medium

- Empty state is text-centric and serviceable but visually underpowered for first-time activation.
- Card metadata hierarchy can flatten at high density (title/description/role all similar visual weight).

## Discover (`app/(dashboard)/discover/page.tsx`)

### High

- Member count label renders "members" without an actual number.
- Join action uses server action submit with no in-button loading indicator; double-submit risk and weak feedback.
- No skeleton state for initial fetch.

### Medium

- Similar card interaction/cursor signaling inconsistency as dashboard.
- Empty state lacks actionable CTA (no direct path to create group or retry).

## Group Detail (`app/(dashboard)/groups/[groupId]/page.tsx` + media components)

### Critical

- `MediaTable` desktop column grid (`grid-cols-[2.2fr_1fr_1fr_1.6fr_1fr_1.4fr_76px]`) has no responsive fallback; at 390px it will be cramped/overflow and fail one-thumb usability.

### High

- Filter tabs in `GroupMediaSection` are horizontal-scroll text buttons but no sticky behavior; controls can drift off context on long lists.
- Pagination buttons are 32px tall (`h-8`), under recommended 44px touch target.
- No skeleton placeholders for media list loading or refetch transitions.
- Status changes optimistically mutate UI but show no per-row pending affordance.
- Empty state says "Add the first one above"; on mobile action may be off-screen and not persistent.

### Medium

- Consumed-by text can become a long comma list and visually collapse hierarchy in dense rows.
- Multi-action row (status select, users dialog, kebab menu) is optimized for pointer precision, not touch comfort.

## Add/Edit Media Dialogs (`components/features/media/AddMediaDialog.tsx`, `EditMediaItemDialog.tsx`)

### High

- Type-specific metadata forms use `grid-cols-2` without mobile collapse (`grid-cols-1`), causing squeezed controls at 390px.
- Dialog is centered modal on mobile, not full-screen/near-full-sheet; keyboard overlap risk.
- Submit buttons are loading-text only, no spinner.

### Medium

- Number inputs do not explicitly include `inputMode="numeric"` for mobile keyboard optimization.
- Errors are global block style only; no field-level inline hints.

## Group Settings (`components/features/groups/GroupSettings.tsx`)

### High

- Remove-member and delete actions lack robust async feedback beyond label changes (no spinner/disabled state consistency for every destructive path).
- Member rows use very small icon-only remove buttons; touch target too small for mobile.

### Medium

- Danger zone contrast and spacing are acceptable but not strongly differentiated as irreversible sequence.
- `confirm()` browser prompt for delete is default/unbranded and inconsistent with app interaction system.

## Profile (`app/profile/[nickname]/page.tsx`)

### Medium

- Group row cards are compact and readable at desktop but may feel too tight on mobile due single-line truncation and small metadata.
- Empty state is plain text with no primary follow-up action.

## Pricing (`app/(dashboard)/pricing/page.tsx`)

### High

- The recommended Premium plan is highlighted, but hierarchy remains subtle; "recommended" emphasis can be stronger.
- Feature comparison is card-only with no compact mobile comparison strategy.

### Medium

- "Custom" enterprise pricing uses same visual rhythm as numeric plans; hierarchy ambiguity.
- CTA labels and destinations are functionally correct but lack microcopy for decision confidence.

## Shared Components and System-Level Findings

### High

- Loading state pattern is inconsistent and mostly text-only across forms/actions.
- Error presentation is inconsistent in copy, placement, and hierarchy; no unified non-blocking banner pattern for form-level server errors.
- No global skeleton component system despite multiple async surfaces.
- Cursor semantics are inconsistent across clickable non-button surfaces (cards, list rows, some trigger wrappers).

### Medium

- Placeholder color in global CSS (`#78716c`) can fall below ideal readability in certain contexts.
- Labels are uppercase + wide tracking by default (`components/ui/label.tsx`), reducing scannability for forms.
- Link styling relies heavily on color change; not always visibly identifiable without hover.
- Z-layer strategy is implicit in components (z-40, z-50) but not centralized/tokenized.

### Low

- Multiple one-off animation class patterns (global keyframes + Radix data animations) without a single motion vocabulary source.

## Typography and Semantics Audit

### High

- Heading hierarchy inconsistency on landing (H1 followed by repeated H3 without section H2).

### Medium

- Body line-height generally comfortable due global `line-height: 1.6`, but some metadata text sizes drop to `text-xs` in dense contexts.
- Labels are present (good), but visual style favors brand texture over form readability.

## Cursor and Interaction Audit

### High

- Clickable card/link wrappers do not consistently communicate interactivity with explicit cursor and hover intent.
- Icon-only controls in dense rows/settings are visually subtle and can be mistaken for decorative icons.

### Medium

- Disabled cursor behavior is globally defined (`*:disabled`), but many non-disabled pending states do not visually communicate temporary non-interactivity.

## Loading State Audit

### High

Resolved in implementation phase:

- Login/register/reset/update password buttons now show inline spinner + disabled state.
- Create group, group settings, add/edit media, discover join, and row-level media actions now show loading affordance.
- Route-level loading skeletons now exist for dashboard/discover/group detail/group settings/new group/profile/pricing.

Residual:

- Nickname availability pre-check in register form still shares the same submit loading state rather than a distinct inline "checking" indicator.

## Error State Audit

### High

Resolved in implementation phase:

- Form submissions now route through a consistent banner pattern (`FormBanner`) with friendlier language.
- Raw backend error text has been removed from high-frequency auth/group/media actions.

Residual:

- Page-level protected-route fetch failures still rely primarily on `notFound`/redirect patterns; dedicated full-page retry states can be expanded further.

### Medium

- Empty states are improved in structure but still vary in richness (some remain text-dominant).

## Mobile (390px) Audit

### Critical

Resolved: media list now has a dedicated card layout on mobile with larger touch targets and clearer action separation.

### High

Resolved in implementation phase:

- Dialog shell now supports near-full-screen mobile mode.
- Add/edit metadata grids collapse from 2 columns to 1 on small screens.
- Pagination and icon/action controls were upsized toward thumb ergonomics.
- Group media rows now render as touch-friendly cards on mobile.

### Medium

- Improved, but some metadata labels remain intentionally small (`text-xs`) and may need an accessibility sizing pass if user testing indicates strain.

## Stress Test Results

Stress tests required scenarios:

- Empty (0)
- Minimal (1-2)
- Typical (15-20)
- Dense (~100)
- Overflow (>100)

Viewport targets:

- 1440, 768, 390

### Current Result Status

- Executed via dedicated stress route `app/ui-stress/page.tsx` with mock data injected directly into protected-page component patterns.
- Captured screenshots for all required scenarios (`empty`, `minimal`, `typical`, `dense`, `overflow`) at all target widths (1440, 768, 390).
- Additional below-the-fold captures were taken for dense/overflow media sections to validate list behavior beyond first viewport.

### Results Summary

- Pass: no layout breakage observed in group-card grids at 20/100/140 items on desktop/tablet/mobile.
- Pass: long group names and long media titles remain contained (line clamp or wrap) without container overflow.
- Pass: media list remains readable on mobile under dense and overflow scenarios due new card layout.
- Pass: action controls remain distinguishable and tappable in tested scenarios.
- Pass: spacing and boundaries remain visually stable across dense stacks.

### Residual Findings From Stress Captures

- Dense/overflow mobile screens become very scroll-heavy (expected) and could benefit from optional sticky quick-filter/search affordances in future iteration.
- Some metadata density in desktop media rows still trends visually compact at very high volumes; acceptable but can be tuned with slightly larger vertical row spacing.

### Protected-Route Runtime Constraint

- Direct screenshot capture of authenticated runtime pages remained auth-gated in this session.
- To cover this, stress validation used a mock harness that reuses protected-page visual patterns and component structures with controlled data extremes.

## Priority Fix Order (for implementation phase)

1. Add dedicated page-level retry UIs for protected-data fetch failures beyond `notFound`/redirect.
2. Introduce optional sticky quick controls for long mobile lists under dense/overflow data.
3. Run same matrix against authenticated seeded data in real protected routes for final parity check.
