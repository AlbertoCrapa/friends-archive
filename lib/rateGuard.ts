/**
 * Per-user call ceiling for a route: `const over = rateGuard(40, 60_000)`, then
 * `if (over(user.id)) return 429`. A human cannot get near it, a loop does.
 *
 * Per-instance, not global — serverless gives each instance its own memory, so
 * this bounds a hot instance rather than the whole deployment. That is the
 * right size for the job: it only has to stop one client from spending a
 * shared provider quota on everybody's behalf.
 */
export function rateGuard(maxPerWindow: number, windowMs: number) {
  const seen = new Map<string, { count: number; windowStart: number }>();

  return function overBudget(userId: string): boolean {
    const now = Date.now();
    const entry = seen.get(userId);
    if (!entry || now - entry.windowStart > windowMs) {
      seen.set(userId, { count: 1, windowStart: now });
      // Opportunistic sweep: the map only ever holds users seen this window.
      if (seen.size > 500) {
        for (const [key, value] of seen) {
          if (now - value.windowStart > windowMs) seen.delete(key);
        }
      }
      return false;
    }
    entry.count += 1;
    return entry.count > maxPerWindow;
  };
}
