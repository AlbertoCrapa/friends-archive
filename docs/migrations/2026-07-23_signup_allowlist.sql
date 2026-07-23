-- ============================================================================
-- THE FRIEND ARCHIVE — Signup Email Allowlist                     (2026-07-23)
--
-- Run this ENTIRE block in the Supabase SQL Editor
-- (Dashboard → SQL Editor → New query → paste → Run).
--
-- Gates account creation to a pre-approved list of email addresses via the
-- "Before User Created" auth hook. Idempotent and data-safe; it adds one
-- table + one function and seeds a couple of example rows. After running,
-- enable the hook in the Dashboard (see the footer of this file).
--
-- ── WHY ──────────────────────────────────────────────────────────────────────
-- Registration is otherwise fully open: RegisterForm.tsx calls
-- supabase.auth.signUp() in the browser with the public anon key, so any email
-- can create an account. A browser-only check would be trivially bypassable via
-- the Supabase API. The "Before User Created" hook runs INSIDE the database,
-- before any auth.users row is written, so it cannot be bypassed.
--
-- ── HOW IT WORKS ─────────────────────────────────────────────────────────────
-- Supabase calls hook_restrict_signup_to_allowlist(event) before creating each
-- user. The function returns '{}' to allow, or an { error } object to deny. It
-- looks up the (lowercased) signup email in public.allowed_emails. Because the
-- hook runs before user creation, disallowed emails are rejected immediately —
-- no auth.users / profiles / subscriptions rows are created and no confirmation
-- email is sent.
-- ============================================================================


-- 1. The allowlist table -----------------------------------------------------
create table if not exists public.allowed_emails (
  email      text primary key,                       -- store lowercased
  note       text,                                   -- optional: whose email
  created_at timestamptz not null default now()
);

-- No client access. RLS on + zero policies => anon/authenticated cannot read
-- or write it. The signup hook reads it via a SECURITY DEFINER function, and
-- the dashboard Table Editor (service role) can still manage rows.
alter table public.allowed_emails enable row level security;


-- 2. The Before-User-Created hook function -----------------------------------
-- SECURITY DEFINER (owned by postgres) so it can read allowed_emails despite
-- RLS, consistent with the other helpers in SUPABASE_SETUP.md. search_path is
-- pinned to public to keep it locked down.
create or replace function public.hook_restrict_signup_to_allowlist(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  v_email := lower(event -> 'user' ->> 'email');

  if v_email is not null and exists (
    select 1 from public.allowed_emails where email = v_email
  ) then
    return '{}'::jsonb;                              -- allow
  end if;

  return jsonb_build_object(                         -- deny
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'This email is not on the invite list. Ask an admin to add you.'
    )
  );
end;
$$;

-- Only the auth system may call the hook.
grant execute on function public.hook_restrict_signup_to_allowlist(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_restrict_signup_to_allowlist(jsonb) from authenticated, anon, public;


-- 3. Seed the allowlist (EDIT THESE — use lowercase) -------------------------
insert into public.allowed_emails (email, note) values
  ('you@example.com',    'me'),
  ('friend1@gmail.com',  'friend one')
on conflict (email) do nothing;


-- 4. Verify ------------------------------------------------------------------
-- SELECT * FROM public.allowed_emails ORDER BY created_at;


-- ── AFTER RUNNING THIS FILE (one-time, in the Dashboard) ─────────────────────
-- Dashboard → Authentication → Hooks → "Before User Created":
--   • Enable the hook
--   • Type   = Postgres
--   • Schema = public
--   • Function = hook_restrict_signup_to_allowlist
--   • Save
--
-- Managing the list later:
--   • Table Editor → allowed_emails → add/remove rows (lowercased email), OR
--   • SQL Editor:  insert into public.allowed_emails (email, note)
--                    values ('newfriend@gmail.com', 'someone') on conflict do nothing;
--                  delete from public.allowed_emails where email = 'someone@gmail.com';
-- ============================================================================
