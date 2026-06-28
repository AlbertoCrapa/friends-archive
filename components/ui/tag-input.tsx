'use client';

import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  /** Current tags (original case). Controlled. */
  value: string[];
  onChange: (tags: string[]) => void;
  id?: string;
  placeholder?: string;
  /** Hard cap on number of tags. */
  maxTags?: number;
  /** Max characters per tag. */
  maxTagLength?: number;
}

/**
 * Chip-style tag editor. Type a tag and press Enter or comma to add it; click the
 * × on a chip (or Backspace on an empty input) to remove. De-duplicates
 * case-insensitively and preserves insertion order. Tags are stored by the parent
 * as a comma-separated string (media_items.genre) via serializeTags().
 */
export function TagInput({
  value,
  onChange,
  id,
  placeholder = 'Add a tag…',
  maxTags = 12,
  maxTagLength = 30,
}: Props) {
  const [draft, setDraft] = useState('');

  function addTag(raw: string) {
    const tag = raw.trim().replace(/\s+/g, ' ').slice(0, maxTagLength);
    if (!tag) return;
    if (value.length >= maxTags) return;
    if (value.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...value, tag]);
    setDraft('');
  }

  function removeTag(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(draft);
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      removeTag(value.length - 1);
    }
  }

  function handleChange(raw: string) {
    // Support pasting "a, b, c" — commit everything before the last comma.
    if (raw.includes(',')) {
      const parts = raw.split(',');
      const last = parts.pop() ?? '';
      for (const part of parts) addTag(part);
      setDraft(last);
    } else {
      setDraft(raw);
    }
  }

  const atMax = value.length >= maxTags;

  return (
    <div
      className={cn(
        // Resting size/shape matches the Input component (single line, h-11),
        // then grows as chips wrap onto more lines.
        'flex flex-wrap items-center gap-1.5 min-h-11 w-full rounded-[var(--radius-sm)] border bg-[var(--color-surface)] px-3 py-2',
        'border-[var(--color-border)] focus-within:ring-2 focus-within:ring-[var(--color-accent)] focus-within:border-[var(--color-accent)] transition-all'
      )}
    >
      {value.map((tag, index) => (
        <span
          key={`${tag}-${index}`}
          className="inline-flex items-center gap-1 border border-stone-700/70 bg-stone-800/40 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-stone-300"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(index)}
            className="text-stone-500 hover:text-red-400 cursor-pointer"
            aria-label={`Remove tag ${tag}`}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <input
        id={id}
        type="text"
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addTag(draft)}
        placeholder={atMax ? 'Tag limit reached' : value.length === 0 ? placeholder : ''}
        disabled={atMax}
        className="flex-1 min-w-[80px] bg-transparent text-sm font-mono text-stone-100 placeholder:text-stone-600 outline-none cursor-text disabled:cursor-not-allowed"
      />
    </div>
  );
}
