import { useRef } from 'react';
import { LogOut, Archive, Download, Upload, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/stores/auth-store';
import { useItemsStore } from '@/stores/items-store';

interface HeaderProps {
  children?: React.ReactNode;
}

export function Header({ children }: HeaderProps) {
  const session = useAuthStore((state) => state.session);
  const logout = useAuthStore((state) => state.logout);
  const items = useItemsStore((state) => state.items);
  const setItems = useItemsStore((state) => state.setItems);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      items: items,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `the-archive-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.items && Array.isArray(data.items)) {
          // Merge items, avoiding duplicates by title
          const existingTitles = new Set(items.map((item) => item.title.toLowerCase()));
          const newItems = data.items.filter(
            (item: { title: string }) => !existingTitles.has(item.title.toLowerCase())
          );
          const mergedItems = [...items, ...newItems];
          setItems(mergedItems);
          
          // Save to localStorage
          localStorage.setItem('archive-items-backup', JSON.stringify(mergedItems));
          
          alert(`Imported ${newItems.length} new items. ${data.items.length - newItems.length} duplicates skipped.`);
        }
      } catch {
        alert('Failed to parse backup file. Please ensure it\'s a valid JSON file.');
      }
    };
    reader.readAsText(file);
    
    // Reset the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <header className="h-14 md:h-16 border-b border-stone-800 bg-stone-950/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="h-full max-w-[1800px] mx-auto px-3 md:px-6 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 border border-amber-600/50 flex items-center justify-center bg-gradient-to-br from-stone-900 to-stone-950">
            <Archive className="w-4 h-4 md:w-5 md:h-5 text-amber-500" />
          </div>
          <div className="hidden sm:block">
            <h1 className="font-serif text-lg font-semibold text-stone-100 leading-tight">
              The Archive
            </h1>
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-stone-500">
              Cultural Repository
            </p>
          </div>
        </div>

        {/* Center content */}
        <div className="flex-1 flex justify-center">
          {children}
        </div>

        {/* User info & actions */}
        {session && (
          <div className="flex items-center gap-2 md:gap-4">
            {/* Desktop: show nickname */}
            <div className="hidden md:block text-right">
              <p className="text-sm text-stone-300 font-medium">
                {session.nickname}
              </p>
              <p className="text-[10px] font-mono text-stone-600 uppercase tracking-wider">
                Curator
              </p>
            </div>
            
            {/* Hidden file input for import */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".json,.txt"
              onChange={handleImport}
              className="hidden"
            />
            
            {/* Mobile: Menu dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-stone-500 hover:text-stone-300"
                >
                  <Menu className="w-4 h-4 md:hidden" />
                  <Download className="w-4 h-4 hidden md:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleExport}>
                  <Download className="w-4 h-4 mr-2" />
                  Export Backup
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2" />
                  Import Backup
                </DropdownMenuItem>
                <DropdownMenuSeparator className="md:hidden" />
                <DropdownMenuItem onClick={logout} className="md:hidden text-red-400">
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout ({session.nickname})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Desktop: Logout button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className="hidden md:flex text-stone-500 hover:text-stone-300"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
