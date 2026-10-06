# Product

## Register

product

The app (dashboard, group pages, item sheets) is the primary surface and sets the
visual law. Marketing surfaces — `/` above all — are designed in the **brand**
register, but they are *the same product wearing its best clothes*: same tokens,
same type system, same accent. A homepage that looked like a different company
would be a failure, however beautiful.

## Users

Small private circles: a friend group, a couple, a family, a flatshare. They
already talk about films, series, books and games in a group chat, and the
recommendation dies there. They are not collectors or critics; they are people
who keep losing the list.

- **On the homepage:** a cold visitor who has never heard of the product. The job
  is to understand the idea in seconds and create an account.
- **In the app:** a returning member on the group page, adding a title, changing a
  status, or checking who has already seen something.

The group page is the thing people actually use. Everything else exists to get
them there and keep them coming back.

## Product Purpose

One shared catalogue per group, covering movies, TV series, books and video games,
with a private layer on top: each member's own status and their own notes. Success
is a group whose list is still alive six months in.

Free, open source, a hobby project. No ads, no paid tiers, no commercial intent.
The interface must never write cheques the product does not cash ("no credit card
required" is a lie by implication when nothing is ever charged).

## Brand Personality

**Precise. Quiet. Well-built.** A cool instrument, not a cosy scrapbook. The voice
is plain and specific: it names what the thing does and stops. Numbers, counts,
statuses and indices are part of the voice, because the product's real artifact is
a catalogue entry.

Emotional goal: the confidence you feel picking up a tool that was made carefully.

## Anti-references

- **Brutalist / loud.** No 200px raw type, no neon, no deliberately broken grid,
  no shouting. Discipline is the brand.
- **Dark-SaaS template.** Ambient purple glow orbs, glass cards, three-up icon
  grids, "built for modern teams" copy.
- **Repeated uppercase kickers** above every section heading. The page numbers its
  sections instead: one index rail, used deliberately.
- **Fake commercial theatre.** Logo clouds, testimonials, pricing tables, credit
  card reassurance on a product that has no payments.

## Strategic Design Principles

1. **Coherence over spectacle.** The homepage may be the most beautiful page in
   the product; it may not be a different product. Existing tokens only:
   near-black ground, `#18181b` / `#27272a` surfaces, `#2c99f8` accent, Bricolage
   Grotesque, 6/10/16 radii.
2. **Colour means something.** The four media types carry the app's chart hues
   (`--chart-movie` / `--chart-tv_series` / `--chart-book` / `--chart-video_game`)
   on marketing surfaces too, so the colour a visitor learns on the homepage is
   the colour they meet in the archive.
3. **Motion explains.** Scroll-driven sequences are allowed and encouraged, but
   each one has to demonstrate a product mechanic (a catalogue filling, a filter
   narrowing, a status changing). Decoration that moves is decoration.
4. **Accessibility is strict.** AA on every piece of text, display type included.
   Muted greys (`#52525b`, `#71717a`) are for hairlines and decoration, never for
   words. `prefers-reduced-motion` gets a real static composition, not a faster
   animation.
5. **Say the true thing.** Free and open source, stated plainly, is a stronger
   pitch than manufactured urgency.
