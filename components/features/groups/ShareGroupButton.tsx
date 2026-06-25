'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Check, Link2, Mail, MessageCircle, Send, Share2 } from 'lucide-react';

interface Props {
  groupId: string;
  groupName: string;
}

/**
 * Share a group link. On devices with the Web Share API (most phones, some
 * desktops) it opens the native share sheet. Everywhere else it falls back to a
 * menu of the main socials + copy link. The URL is built from the current
 * origin so it keeps working if the domain changes.
 */
export function ShareGroupButton({ groupId, groupName }: Props) {
  const [url, setUrl] = useState('');
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUrl(`${window.location.origin}/groups/${groupId}`);
    setCanNativeShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, [groupId]);

  const title = `${groupName} · The Friend Archive`;
  const text = `Join "${groupName}" on The Friend Archive — our shared movie, TV, book & game archive.`;

  async function nativeShare() {
    try {
      await navigator.share({ title, text, url });
    } catch {
      // User dismissed the share sheet — nothing to do.
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (e.g. insecure context) — silently ignore.
    }
  }

  // The native share sheet already covers every app the user has installed.
  if (canNativeShare) {
    return (
      <Button variant="outline" size="sm" className="gap-1" onClick={nativeShare}>
        <Share2 className="h-3 w-3" />
        Share
      </Button>
    );
  }

  const shareText = encodeURIComponent(text);
  const shareUrl = encodeURIComponent(url);
  const textWithUrl = encodeURIComponent(`${text} ${url}`);

  const socials = [
    {
      label: 'WhatsApp',
      icon: MessageCircle,
      href: `https://wa.me/?text=${textWithUrl}`,
    },
    {
      label: 'Telegram',
      icon: Send,
      href: `https://t.me/share/url?url=${shareUrl}&text=${shareText}`,
    },
    {
      label: 'X',
      icon: Share2,
      href: `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`,
    },
    {
      label: 'Email',
      icon: Mail,
      href: `mailto:?subject=${encodeURIComponent(title)}&body=${textWithUrl}`,
    },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Share2 className="h-3 w-3" />
          Share
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {socials.map(({ label, icon: Icon, href }) => (
          <DropdownMenuItem key={label} asChild>
            <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </a>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            copyLink();
          }}
          className="flex items-center gap-2"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Link2 className="h-3.5 w-3.5" />}
          {copied ? 'Copied!' : 'Copy link'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
