import { useState } from 'react';
import { Header } from '@/components/layout';
import { CategoryTabs, ItemsTable, FilterBar, AddItemDialog } from '@/features/items';
import { RestorePrompt } from '@/components/ui/restore-prompt';
import { SyncPrompt } from '@/components/ui/sync-prompt';
import { useItems } from '@/hooks/useItems';
import { useItemsStore } from '@/stores/items-store';

export function Dashboard() {
  const { 
    showRestorePrompt, 
    restoreFromBackup, 
    dismissRestorePrompt, 
    localBackupCount,
    showSyncPrompt,
    syncDifferences,
    syncToServer,
    dismissSyncPrompt,
  } = useItems();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const setFilters = useItemsStore((state) => state.setFilters);
  const setActiveCategory = useItemsStore((state) => state.setActiveCategory);

  const handleTagClick = (tag: string) => {
    // When clicking a tag, show all items with that tag across ALL categories
    setActiveTagFilter(tag);
    setFilters({ tags: [tag] });
    setActiveCategory('all'); // Switch to All category to show cross-category results
  };

  const handleClearTagFilter = () => {
    setActiveTagFilter(null);
    setFilters({});
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      {/* Background texture */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 opacity-[0.015]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }} />
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-stone-900/20 via-transparent to-stone-900/40" />
      </div>

      <div className="relative">
        <Header />
        
        <main className="max-w-[1800px] mx-auto">
          {/* Category tabs */}
          <CategoryTabs onAddItem={() => setIsAddDialogOpen(true)} />
          
          {/* Filter bar */}
          <FilterBar
            activeTagFilter={activeTagFilter}
            onClearTagFilter={handleClearTagFilter}
          />
          
          {/* Items table/cards */}
          <div className="p-2 md:p-4">
            <ItemsTable onTagClick={handleTagClick} />
          </div>
        </main>
        
        {/* Add item dialog */}
        <AddItemDialog
          open={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
        />

        {/* Restore backup prompt */}
        {showRestorePrompt && (
          <RestorePrompt
            itemCount={localBackupCount}
            onRestore={restoreFromBackup}
            onDismiss={dismissRestorePrompt}
          />
        )}

        {/* Sync prompt */}
        {showSyncPrompt && syncDifferences && (
          <SyncPrompt
            differences={syncDifferences}
            onSync={syncToServer}
            onDismiss={dismissSyncPrompt}
          />
        )}
      </div>
    </div>
  );
}
