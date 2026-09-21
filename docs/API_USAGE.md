# API usage — where the numbers live

Four credentials leave this app, and each one is metered by somebody else on a
dashboard we don't own. This is where to look, and what the app now keeps for
itself.

## 1. One place, ours: `/admin`

Signed in as an operator, the account menu grows an **API usage** item. The
page shows, for the last 30 days:

- **Per provider**: calls spent against that provider's own window (RAWG bills
  by calendar month, the Open Library budget resets daily), a gauge when there
  is a cap to be a fraction of, today's count, the share the cache saved, and
  failures.
- **Calls that reached a provider**, per day, stacked by provider. Cache hits
  are excluded — this is the line that costs quota.
- **What spends it**: the last 30 days by call shape (`/3/search/movie`,
  `/api/games/:id`), so when a total jumps you can see which call did it.
- **What came back wrong**: the most recent failures, with status or timeout.

Access is `ADMIN_EMAILS` in the environment — a comma-separated list. Unset or
empty means nobody, and `/admin` returns 404 for everyone including you. It is
not a database role on purpose: the operator is whoever the deployment says it
is, which is already the set of people holding the service role key.

### What it is and isn't

It counts calls **at the door**, in `lib/providers/http.ts` — the single
function every provider adapter already goes through. So it is exact about
what this app asked for, and it is the only thing that can attribute a spike
to an endpoint or a day.

It is **not** the bill. Two honest gaps:

- `cached` is **inferred**, not reported. Next's fetch cache sits in front of
  these calls and is shared across all users; nothing in the response says "I
  came from the cache", so a response returning in under 15 ms is treated as
  one that never crossed the network. Generous on purpose — over-counting an
  upstream call is the safe direction to be wrong in.
- Anything that calls a provider **without** going through `fetchJson` — a
  script, a curl, a second deployment sharing the key — is invisible here and
  still counts against the real quota.

For both reasons the provider's own page stays the source of truth for
billing, and this page is the source of truth for trend and blame.

## 2. The providers' own pages

| Key | Provider page | What they actually limit |
|---|---|---|
| `TMDB_API_KEY` | [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) | No monthly cap. Throttles at roughly 50 requests/second per key. There is no usage total to read — the daily shape on `/admin` is the only view of volume. |
| `RAWG_API_KEY` | [rawg.io/apidocs](https://rawg.io/apidocs) (signed in, your key page shows the month's count) | **20,000 requests/month** on the free tier. The only key here that can realistically run out; when it does, RAWG stops answering for the rest of the month. |
| — (Open Library) | [openlibrary.org/developers/api](https://openlibrary.org/developers/api) | No key, no bill, no dashboard. They rate-limit by IP when hammered. The 5,000/day figure on `/admin` is **our** budget, set to catch a runaway loop, not their rule. |
| `SUPABASE_SERVICE_ROLE_KEY` / anon key | Supabase dashboard → **Reports** and **Settings → Usage** | Database size, egress, monthly active users, storage. Not request counts per key — Supabase meters the project, not the credential. |

## 3. Why a blown quota is quiet

`fetchJson` never throws: a timeout, a 429 or a 401 all return `null`, and the
UI falls back to manual entry. That is deliberate — a dead provider must not
break adding an item — but it means **the first symptom of a spent key is
"search stopped finding things"** with nothing in the interface to point at.
The failures panel on `/admin` is where that shows up: a run of 429s against
one provider is a throttle, a run of 401s is a key that was rotated or
revoked.

## 4. Running it

1. Run `docs/migrations/2026-09-22_api_usage.sql` in the Supabase SQL editor.
   Until then `/admin` says so plainly and every number is a zero.
2. Set `ADMIN_EMAILS` in `.env.local` and in the Vercel project's environment
   variables.
3. Optional, recommended: schedule the prune so the table doesn't grow
   forever. In Supabase → Database → Cron:

   ```sql
   SELECT cron.schedule('prune-api-usage', '0 4 * * *',
                        $$SELECT public.prune_api_usage(90)$$);
   ```

## 5. Adding a provider

Add one entry to `PROVIDER_METERS` in `lib/usage/providers.ts` (id, label, key
env, quota, their dashboard) and teach `providerForUrl` its hostname. Nothing
else needs to change: any adapter that calls `fetchJson` is counted from its
first request, and the `/admin` cards and charts pick it up from the registry.

## 6. Storage

The meter is one append-only row per call — provider, endpoint shape, ok,
status, cached, duration, timestamp. The key itself is never stored: endpoint
labels are built from the URL **path** only, and the query string, which is
where TMDB and RAWG carry the credential, is dropped before anything is
written. RLS is on with no policies, so the table is unreadable by anon and
authenticated alike; only the service role touches it.
