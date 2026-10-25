// ============================================
// Social link preview — what a pasted post says about itself.
// Server-only. Turns any link (Instagram, TikTok, YouTube, X, Facebook,
// Reddit, a blog…) into the caption text and one image, for the recognizer.
//
// The big platforms publish oEmbed endpoints that answer without a key and
// carry the full caption; everything else falls back to the og: tags a page
// prints for link previews, fetched as Facebook's preview bot because that is
// the visitor most sites are written to answer.
// ============================================

import { fetchJson } from './http';

export interface LinkPreview {
  /** Caption / title / description, joined. Never empty. */
  text: string;
  /** Who posted it, when the platform says — a distributor's name is a clue. */
  author?: string;
  imageUrl?: string;
}

const BOT_UA = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';
const TIMEOUT_MS = 6000;
const MAX_HTML_BYTES = 1_500_000;
const MAX_IMAGE_BYTES = 4_000_000;

/**
 * Only public web hosts. A pasted link is fetched by OUR server, so without
 * this it could be pointed at localhost or the cloud metadata address.
 * ponytail: hostname check only — a DNS name resolving to a private IP, or a
 * redirect to one, still passes. Resolve + check the address if this ever runs
 * next to anything private.
 */
export function isPublicUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase();
  if (!host.includes('.') || host.startsWith('[')) return null;
  if (/^\d+(\.\d+){3}$/.test(host)) return null;
  if (/\.(local|internal|localhost)$/.test(host)) return null;
  return url;
}

interface OEmbed {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
  /** X puts the tweet in here as markup, with no title. */
  html?: string;
}

/** The keyless oEmbed endpoint for a host, or null to use og: tags. */
function oembedUrl(url: URL): string | null {
  const host = url.hostname.replace(/^www\.|^m\./, '');
  const q = encodeURIComponent(url.toString());
  if (host === 'instagram.com') return `https://www.instagram.com/api/v1/oembed/?url=${q}`;
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) return `https://www.tiktok.com/oembed?url=${q}`;
  if (host === 'youtube.com' || host === 'youtu.be') return `https://www.youtube.com/oembed?format=json&url=${q}`;
  if (host === 'x.com' || host === 'twitter.com') return `https://publish.twitter.com/oembed?omit_script=1&url=${q}`;
  return null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

const stripTags = (html: string) => decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

/** og:/twitter:/description meta tags, whatever order the attributes come in. */
export function readMetaTags(html: string): Record<string, string> {
  const tags: Record<string, string> = {};
  for (const [tag] of html.matchAll(/<meta\s[^>]*>/gi)) {
    const key = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    const content = /content\s*=\s*"([^"]*)"|content\s*=\s*'([^']*)'/i.exec(tag);
    const value = content?.[1] ?? content?.[2];
    if (key && value && !(key in tags)) tags[key] = decodeEntities(value).trim();
  }
  const title = /<title[^>]*>([^<]*)/i.exec(html)?.[1];
  if (title && !tags.title) tags.title = decodeEntities(title).trim();
  return tags;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': BOT_UA, Accept: 'text/html,*/*' },
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.text()).slice(0, MAX_HTML_BYTES);
  } catch {
    return null;
  }
}

async function fromOgTags(url: URL): Promise<LinkPreview | null> {
  const html = await fetchText(url.toString());
  if (!html) return null;
  const m = readMetaTags(html);
  const parts = [m['og:title'] ?? m['twitter:title'] ?? m.title, m['og:description'] ?? m['twitter:description'] ?? m.description];
  const text = [...new Set(parts.filter(Boolean))].join('\n\n');
  const imageUrl = m['og:image'] ?? m['twitter:image'];
  if (!text && !imageUrl) return null;
  return { text: text || url.toString(), imageUrl, author: m['og:site_name'] };
}

/** Caption + image for a public link, or null when nothing readable came back. */
export async function fetchLinkPreview(raw: string): Promise<LinkPreview | null> {
  const url = isPublicUrl(raw);
  if (!url) return null;

  const endpoint = oembedUrl(url);
  if (endpoint) {
    const o = await fetchJson<OEmbed>(endpoint, { 'User-Agent': BOT_UA }, TIMEOUT_MS);
    const text = o?.title?.trim() || (o?.html ? stripTags(o.html) : '');
    if (o && (text || o.thumbnail_url)) {
      return { text: text || url.toString(), author: o.author_name, imageUrl: o.thumbnail_url };
    }
  }
  return fromOgTags(url);
}

/** The preview image as base64 for the model, or null (too big, not an image, blocked). */
export async function fetchImageBase64(
  raw: string
): Promise<{ mimeType: string; data: string } | null> {
  const url = isPublicUrl(raw);
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
    const mimeType = res.headers.get('content-type')?.split(';')[0] ?? '';
    if (!res.ok || !mimeType.startsWith('image/')) return null;
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength > MAX_IMAGE_BYTES) return null;
    return { mimeType, data: Buffer.from(bytes).toString('base64') };
  } catch {
    return null;
  }
}
