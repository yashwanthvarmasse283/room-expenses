import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ShoppingCart, Pencil, Check, X } from 'lucide-react';

const GroceryManager = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newItem, setNewItem] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const { data: groceries = [] } = useQuery({
    queryKey: ['groceries', profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase.from('groceries').select('*').eq('admin_id', profile.id).order('name');
      return data ?? [];
    },
    enabled: !!profile,
  });

  const addItem = async () => {
    if (!newItem.trim() || !profile) return;
    const { error } = await supabase.from('groceries').insert({ admin_id: profile.id, name: newItem.trim() });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    queryClient.invalidateQueries({ queryKey: ['groceries'] });
    setNewItem('');
    toast({ title: 'Item added' });
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from('groceries').delete().eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    queryClient.invalidateQueries({ queryKey: ['groceries'] });
    toast({ title: 'Item removed' });
  };

  const startEdit = (item: any) => {
    setEditingId(item.id);
    setEditName(item.name);
  };

  const saveEdit = async () => {
    if (!editName.trim() || !editingId) return;
    const { error } = await supabase.from('groceries').update({ name: editName.trim() }).eq('id', editingId);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    queryClient.invalidateQueries({ queryKey: ['groceries'] });
    setEditingId(null);
    toast({ title: 'Item updated' });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-primary" />Grocery Items
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Manage grocery items that appear as quick-select options when adding expenses.</p>
        <div className="flex gap-2">
          <Input 
            placeholder="Add new item (e.g. Milk, Rice)" 
            value={newItem} 
            onChange={e => setNewItem(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addItem(); }}
          />
          <Button onClick={addItem} disabled={!newItem.trim()}>
            <Plus className="w-4 h-4 mr-1" />Add
          </Button>
        </div>
        {groceries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No grocery items yet. Add some above.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {groceries.map((g: any) => (
              <div key={g.id} className="flex items-center gap-1 bg-muted rounded-full px-3 py-1.5 text-sm">
                {editingId === g.id ? (
                  <>
                    <Input className="h-6 w-24 text-xs" value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); }} />
                    <button onClick={saveEdit} className="text-[hsl(var(--success))] hover:opacity-80"><Check className="w-3 h-3" /></button>
                    <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
                  </>
                ) : (
                  <>
                    <span className="text-foreground">{g.name}</span>
                    <button onClick={() => startEdit(g)} className="text-muted-foreground hover:text-primary ml-1"><Pencil className="w-3 h-3" /></button>
                    <button onClick={() => deleteItem(g.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GroceryManager;
