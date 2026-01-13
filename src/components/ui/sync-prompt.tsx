import { RefreshCw, X, CloudUpload, XCircle } from 'lucide-react';
import { Button } from './button';
import type { Item } from '@/types';

interface SyncPromptProps {
  differences: {
    localOnly: Item[];
    serverOnly: Item[];
    modified: Item[];
  };
  onSync: () => void;
  onDismiss: () => void;
}

export function SyncPrompt({ differences, onSync, onDismiss }: SyncPromptProps) {
  const localOnlyCount = differences.localOnly.length;
  const modifiedCount = differences.modified.length;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-fade-in">
      <div className="bg-stone-900 border border-amber-600/50 p-4 shadow-xl shadow-black/50">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 border border-amber-600/30 flex items-center justify-center shrink-0 bg-amber-600/10">
            <RefreshCw className="w-5 h-5 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-serif text-lg text-stone-100 mb-1">
              Local Changes Found
            </h3>
            <p className="text-sm text-stone-400 mb-2">
              Your local data has changes not on the server:
            </p>
            <ul className="text-xs text-stone-500 mb-3 space-y-1">
              {localOnlyCount > 0 && (
                <li className="flex items-center gap-1">
                  <span className="text-green-500">+</span>
                  <span className="text-amber-500 font-mono">{localOnlyCount}</span> new item{localOnlyCount !== 1 ? 's' : ''}
                </li>
              )}
              {modifiedCount > 0 && (
                <li className="flex items-center gap-1">
                  <span className="text-blue-500">~</span>
                  <span className="text-amber-500 font-mono">{modifiedCount}</span> modified item{modifiedCount !== 1 ? 's' : ''}
                </li>
              )}
            </ul>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={onSync} className="gap-1">
                <CloudUpload className="w-3 h-3" />
                Update Server
              </Button>
              <Button variant="ghost" size="sm" onClick={onDismiss} className="gap-1">
                <XCircle className="w-3 h-3" />
                Keep Server
              </Button>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="text-stone-500 hover:text-stone-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
