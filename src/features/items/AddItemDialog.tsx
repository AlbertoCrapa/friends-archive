import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useItemsStore } from '@/stores/items-store';
import { useAuthStore } from '@/stores/auth-store';
import { useItems } from '@/hooks/useItems';
import type { ItemStatus } from '@/types';

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_OPTIONS: ItemStatus[] = [
  'Plan to Watch',
  'Watching',
  'Watched',
  'Plan to Read',
  'Reading',
  'Read',
];

export function AddItemDialog({ open, onOpenChange }: AddItemDialogProps) {
  const { createItem } = useItems();
  const categories = useItemsStore((state) => state.categories);
  const activeCategory = useItemsStore((state) => state.activeCategory);
  const session = useAuthStore((state) => state.session);
  
  // Filter out 'all' category and get real categories for adding
  const addableCategories = categories.filter((c) => c.id !== 'all');
  
  // If "all" is selected, default to first real category (films)
  const defaultCategoryId = activeCategory === 'all' ? 'films' : activeCategory;
  const [selectedCategory, setSelectedCategory] = useState(defaultCategoryId);
  
  const currentCategory = categories.find((c) => c.id === selectedCategory) || addableCategories[0];
  
  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<ItemStatus>(currentCategory?.defaultStatus || 'Plan to Watch');
  const [tags, setTags] = useState('');
  const [properties, setProperties] = useState<Record<string, string>>({});

  // Update category selection when active changes
  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
    const cat = categories.find((c) => c.id === categoryId);
    if (cat) {
      setStatus(cat.defaultStatus);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!session || !currentCategory) return;
    
    setIsLoading(true);
    
    // Convert properties to appropriate types
    const processedProperties: Record<string, string | number | boolean | string[] | null> = {};
    for (const [key, value] of Object.entries(properties)) {
      if (value.trim()) {
        // Try to parse as number
        const num = parseFloat(value);
        if (!isNaN(num) && value.trim() === num.toString()) {
          processedProperties[key] = num;
        } else if (value.includes(',')) {
          // Parse as array
          processedProperties[key] = value.split(',').map((s) => s.trim());
        } else {
          processedProperties[key] = value;
        }
      }
    }
    
    await createItem({
      title,
      category: currentCategory.name,
      addedBy: session.nickname,
      status,
      tags: tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
      properties: processedProperties,
    });
    
    // Reset form
    setTitle('');
    setStatus(currentCategory.defaultStatus);
    setTags('');
    setProperties({});
    setIsLoading(false);
    onOpenChange(false);
  };

  const propertyColumns = currentCategory?.columns.filter((c) => c.isProperty) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">
            Add New Item
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category selector - always show when in "all" view */}
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={selectedCategory} onValueChange={handleCategoryChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {addableCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter title..."
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ItemStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="tag1, tag2, tag3"
            />
            <p className="text-xs text-stone-500 font-mono">
              Comma-separated, lowercase
            </p>
          </div>
          
          {propertyColumns.length > 0 && (
            <div className="border-t border-stone-800 pt-4">
              <p className="text-xs text-stone-500 font-mono uppercase tracking-wider mb-3">
                Properties
              </p>
              <div className="grid grid-cols-2 gap-3">
                {propertyColumns.map((col) => (
                  <div key={col.id} className="space-y-1">
                    <Label htmlFor={col.id} className="text-xs">
                      {col.label}
                    </Label>
                    <Input
                      id={col.id}
                      value={properties[col.key] || ''}
                      onChange={(e) =>
                        setProperties((p) => ({ ...p, [col.key]: e.target.value }))
                      }
                      placeholder={col.type === 'tags' ? 'value1, value2' : col.type === 'number' ? '0' : 'Value'}
                      className="h-9 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Adding...' : 'Add Item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
