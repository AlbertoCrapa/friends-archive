import { AlertTriangle, Upload, X } from 'lucide-react';
import { Button } from './button';

interface RestorePromptProps {
  itemCount: number;
  onRestore: () => void;
  onDismiss: () => void;
}

export function RestorePrompt({ itemCount, onRestore, onDismiss }: RestorePromptProps) {
  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-fade-in">
      <div className="bg-stone-900 border border-amber-600/50 p-4 shadow-xl shadow-black/50">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 border border-amber-600/30 flex items-center justify-center shrink-0 bg-amber-600/10">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-serif text-lg text-stone-100 mb-1">
              Local Backup Found
            </h3>
            <p className="text-sm text-stone-400 mb-3">
              The server database is empty, but a local backup with{' '}
              <span className="text-amber-500 font-mono">{itemCount} items</span>{' '}
              was detected on this device.
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={onRestore} className="gap-1">
                <Upload className="w-3 h-3" />
                Restore Backup
              </Button>
              <Button variant="ghost" size="sm" onClick={onDismiss}>
                Dismiss
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
