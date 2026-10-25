// ============================================
// Gemini adapter — "which work is this post about?"
// Server-only. Reads a social post's caption and image and answers with the
// work's category and its official English title, so the normal provider
// search can take it from there.
// ============================================

import type { MediaType } from '@/types';
import { fetchJson } from './http';
import type { LinkPreview } from './socialPreview';

// The rolling alias for the newest Flash-Lite — free tier, and a new model
// lands without a deploy. Pin a version via GEMINI_MODEL if it ever regresses.
const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
const TIMEOUT_MS = 12000;

export interface RecognizedWork {
  type: MediaType;
  title: string;
  year?: number;
}

// Kept short on purpose: the schema below already spells out the fields and
// the allowed types, so the prompt only says what the schema can't.
const PROMPT =
  'List every work this post names or shows. title: official English title as on TMDB/RAWG/Open Library, never translated. year: release year or 0. Empty list if none.';

/** A list post ("top 10 RPGs") — more than this and it is a catalogue, not a post. */
const MAX_WORKS = 12;

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

const TYPES: MediaType[] = ['movie', 'tv_series', 'book', 'video_game'];

/** Every work the post is about, in the order it names them. [] when none or on any failure. */
export async function recognizeWorks(
  preview: LinkPreview,
  image: { mimeType: string; data: string } | null
): Promise<RecognizedWork[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return [];

  // The title is almost always in the first lines; the rest is hashtags.
  const post = `@${preview.author ?? '?'}: ${preview.text.slice(0, 1200)}`;
  const res = await fetchJson<GeminiResponse>(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    // Header, not query string: the meter logs the path, and a key in a URL ends up in logs.
    { 'x-goog-api-key': key },
    TIMEOUT_MS,
    0,
    {
      contents: [
        {
          parts: [
            { text: `${PROMPT}\n\n${post}` },
            ...(image ? [{ inline_data: { mime_type: image.mimeType, data: image.data } }] : []),
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        // The image is most of the bill: LOW is ~64 tokens instead of ~258+
        // per tile, still enough to read a poster's title.
        mediaResolution: 'MEDIA_RESOLUTION_LOW',
        // A lookup, not a puzzle — no thinking tokens.
        // (Gemini 3.x takes a level; the old `thinkingBudget: 0` is a 400.)
        thinkingConfig: { thinkingLevel: 'minimal' },
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              type: { type: 'STRING', enum: TYPES },
              title: { type: 'STRING' },
              year: { type: 'INTEGER' },
            },
            required: ['type', 'title', 'year'],
          },
        },
      },
    }
  );

  let raw: unknown;
  try {
    raw = JSON.parse(res?.candidates?.[0]?.content?.parts?.[0]?.text ?? '');
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];

  const works: RecognizedWork[] = [];
  const seen = new Set<string>();
  for (const w of raw) {
    const title = typeof w?.title === 'string' ? w.title.trim() : '';
    if (!TYPES.includes(w?.type) || !title) continue;
    const key = `${w.type}:${title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const year = Number.isInteger(w.year) && w.year > 1800 ? w.year : undefined;
    works.push({ type: w.type, title, year });
    if (works.length === MAX_WORKS) break;
  }
  return works;
}
