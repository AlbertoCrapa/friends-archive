'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Users } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface ConsumptionRecord {
  user_id: string;
  consumed_at: string;
  note: string | null;
  profiles: { nickname: string } | null;
}

interface Props {
  itemId: string;
  itemTitle: string;
}

const recordsCache = new Map<string, ConsumptionRecord[]>();

export function ConsumedByDialog({ itemId, itemTitle }: Props) {
  const [open, setOpen] = useState(false);
  const [records, setRecords] = useState<ConsumptionRecord[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadRecords() {
    const cached = recordsCache.get(itemId);
    if (cached) {
      setRecords(cached);
      return;
    }

    if (records !== null) return;
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('consumption_records')
      .select('user_id, consumed_at, note, profiles(nickname)')
      .eq('media_item_id', itemId)
      .order('consumed_at', { ascending: false });

    const next = (data ?? []) as unknown as ConsumptionRecord[];
    recordsCache.set(itemId, next);
    setRecords(next);
    setLoading(false);
  }

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen) loadRecords();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-11 w-11" title="Who has seen this?">
          <Users className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="line-clamp-1">{itemTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-72 overflow-y-auto">
          {loading && (
            <p className="text-stone-500 text-sm font-mono py-4 text-center inline-flex items-center gap-2 justify-center w-full">
              <Spinner />
              Loading...
            </p>
          )}
          {!loading && records?.length === 0 && (
            <p className="text-stone-600 text-sm font-mono py-4 text-center">
              Nobody has consumed this yet.
            </p>
          )}
          {!loading && records?.map((r) => (
            <div key={r.user_id} className="border border-stone-800 p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-stone-300 text-sm font-mono">
                  {r.profiles?.nickname ?? 'Unknown'}
                </span>
                <span className="text-stone-600 text-xs font-mono">
                  {formatDate(r.consumed_at)}
                </span>
              </div>
              {r.note && (
                <p className="text-stone-500 text-xs font-light italic leading-relaxed">
                  &ldquo;{r.note}&rdquo;
                </p>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
