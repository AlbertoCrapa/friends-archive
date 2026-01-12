import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useItemsStore } from '@/stores/items-store';

interface CategoryTabsProps {
  onAddItem: () => void;
}

export function CategoryTabs({ onAddItem }: CategoryTabsProps) {
  const categories = useItemsStore((state) => state.categories);
  const activeCategory = useItemsStore((state) => state.activeCategory);
  const setActiveCategory = useItemsStore((state) => state.setActiveCategory);
  const items = useItemsStore((state) => state.items);

  const getCategoryCount = (categoryName: string) => {
    return items.filter((item) => item.category === categoryName).length;
  };

  return (
    <div className="flex items-center justify-between border-b border-stone-800">
      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList className="h-12">
          {categories.map((category) => (
            <TabsTrigger key={category.id} value={category.id} className="gap-2">
              {category.name}
              <span className="text-[10px] text-stone-500 font-mono">
                {getCategoryCount(category.name)}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      
      <Button onClick={onAddItem} size="sm" className="mr-4">
        <Plus className="w-4 h-4 mr-1" />
        Add
      </Button>
    </div>
  );
}
