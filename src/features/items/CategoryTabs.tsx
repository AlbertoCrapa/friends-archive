import { Plus, LayoutGrid, Film, Tv, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useItemsStore } from '@/stores/items-store';

interface CategoryTabsProps {
  onAddItem: () => void;
}

const getCategoryIcon = (categoryId: string) => {
  switch (categoryId) {
    case 'all': return <LayoutGrid className="w-4 h-4" />;
    case 'films': return <Film className="w-4 h-4" />;
    case 'tv-series': return <Tv className="w-4 h-4" />;
    case 'books': return <BookOpen className="w-4 h-4" />;
    default: return null;
   }
};

export function CategoryTabs({ onAddItem }: CategoryTabsProps) {
  const categories = useItemsStore((state) => state.categories);
  const activeCategory = useItemsStore((state) => state.activeCategory);
  const setActiveCategory = useItemsStore((state) => state.setActiveCategory);
  const items = useItemsStore((state) => state.items);

  const getCategoryCount = (categoryId: string, categoryName: string) => {
    if (categoryId === 'all') return items.length;
    return items.filter((item) => item.category === categoryName).length;
  };

  return (
    <div className="flex items-center justify-between border-b border-stone-800 px-2 md:px-0">
      <Tabs value={activeCategory} onValueChange={setActiveCategory} className="flex-1 overflow-x-auto">
        <TabsList className="h-12 md:h-12">
          {categories.map((category) => (
            <TabsTrigger 
              key={category.id} 
              value={category.id} 
              className="gap-1 md:gap-2 px-2 md:px-4 text-xs md:text-sm"
            >
              <span className="md:hidden">{getCategoryIcon(category.id)}</span>
              <span className="hidden md:inline">{category.name}</span>
              <span className="md:hidden text-[9px]">{getCategoryCount(category.id, category.name)}</span>
              <span className="hidden md:inline text-[10px] text-stone-500 font-mono">
                {getCategoryCount(category.id, category.name)}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      
      <Button onClick={onAddItem} size="sm" className="ml-2 mr-2 md:mr-4 shrink-0">
        <Plus className="w-4 h-4 md:mr-1" />
        <span className="hidden md:inline">Add</span>
      </Button>
    </div>
  );
}
