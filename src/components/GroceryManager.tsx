import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ShoppingCart, Pencil, Check, X, Target } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

const GroceryManager = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newItem, setNewItem] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [budgetGroceryId, setBudgetGroceryId] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');

  const { data: groceries = [] } = useQuery({
    queryKey: ['groceries', profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase.from('groceries').select('*').eq('admin_id', profile.id).order('name');
      return data ?? [];
    },
    enabled: !!profile,
  });

  const { data: itemBudgets = [] } = useQuery({
    queryKey: ['item_budgets', profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase.from('item_budgets').select('*').eq('admin_id', profile.id);
      return data ?? [];
    },
    enabled: !!profile,
  });

  const addItem = async () => {
    if (!newItem.trim() || !profile) return;
    const { error } = await supabase.from('groceries').insert({
      admin_id: profile.id,
      name: newItem.trim(),
      default_price: Number(newPrice) || 0,
    } as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    queryClient.invalidateQueries({ queryKey: ['groceries'] });
    setNewItem('');
    setNewPrice('');
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
    setEditPrice(String(item.default_price || ''));
  };

  const saveEdit = async () => {
    if (!editName.trim() || !editingId) return;
    const { error } = await supabase.from('groceries').update({
      name: editName.trim(),
      default_price: Number(editPrice) || 0,
    } as any).eq('id', editingId);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    queryClient.invalidateQueries({ queryKey: ['groceries'] });
    setEditingId(null);
    toast({ title: 'Item updated' });
  };

  const toggleActive = async (item: any) => {
    const { error } = await supabase.from('groceries').update({
      active: !item.active,
    } as any).eq('id', item.id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    queryClient.invalidateQueries({ queryKey: ['groceries'] });
    toast({ title: item.active ? 'Item deactivated' : 'Item activated' });
  };

  const openBudgetDialog = (groceryId: string) => {
    setBudgetGroceryId(groceryId);
    const existing = itemBudgets.find((b: any) => b.grocery_id === groceryId);
    setBudgetAmount(existing ? String(existing.monthly_budget) : '');
    setBudgetDialogOpen(true);
  };

  const saveBudget = async () => {
    if (!profile || !budgetGroceryId) return;
    const amount = Number(budgetAmount) || 0;
    const existing = itemBudgets.find((b: any) => b.grocery_id === budgetGroceryId);
    if (existing) {
      await supabase.from('item_budgets').update({ monthly_budget: amount } as any).eq('id', (existing as any).id);
    } else if (amount > 0) {
      await supabase.from('item_budgets').insert({
        admin_id: profile.id,
        grocery_id: budgetGroceryId,
        monthly_budget: amount,
      } as any);
    }
    queryClient.invalidateQueries({ queryKey: ['item_budgets'] });
    setBudgetDialogOpen(false);
    toast({ title: 'Budget saved' });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-primary" />Grocery Items & Prices
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Manage grocery items, set default prices, and monthly budgets. Inactive items are hidden from the expense form.</p>
        <div className="flex gap-2">
          <Input
            placeholder="Item name (e.g. Milk)"
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addItem(); }}
          />
          <Input
            type="number"
            placeholder="Default ₹"
            className="w-24"
            value={newPrice}
            onChange={e => setNewPrice(e.target.value)}
          />
          <Button onClick={addItem} disabled={!newItem.trim()}>
            <Plus className="w-4 h-4 mr-1" />Add
          </Button>
        </div>
        {groceries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No grocery items yet.</p>
        ) : (
          <div className="space-y-2">
            {groceries.map((g: any) => {
              const budget = itemBudgets.find((b: any) => b.grocery_id === g.id);
              return (
                <div key={g.id} className={`flex items-center gap-2 p-2 rounded-lg ${g.active ? 'bg-muted/50' : 'bg-muted/20 opacity-60'}`}>
                  {editingId === g.id ? (
                    <>
                      <Input className="h-7 flex-1 text-sm" value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); }} />
                      <Input type="number" className="h-7 w-20 text-sm" value={editPrice} onChange={e => setEditPrice(e.target.value)} placeholder="₹" />
                      <button onClick={saveEdit} className="text-[hsl(var(--success))] hover:opacity-80"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>
                    </>
                  ) : (
                    <>
                      <Switch checked={g.active} onCheckedChange={() => toggleActive(g)} className="scale-75" />
                      <span className="text-sm text-foreground flex-1">{g.name}</span>
                      {g.default_price > 0 && <span className="text-xs text-muted-foreground">₹{g.default_price}</span>}
                      {budget && <span className="text-xs text-primary">Budget: ₹{(budget as any).monthly_budget}</span>}
                      <button onClick={() => openBudgetDialog(g.id)} className="text-muted-foreground hover:text-primary"><Target className="w-3.5 h-3.5" /></button>
                      <button onClick={() => startEdit(g)} className="text-muted-foreground hover:text-primary"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => deleteItem(g.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Set Monthly Budget</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Monthly Budget (₹)</Label>
              <Input type="number" value={budgetAmount} onChange={e => setBudgetAmount(e.target.value)} placeholder="e.g. 500" />
            </div>
            <Button className="w-full" onClick={saveBudget}>Save Budget</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default GroceryManager;
