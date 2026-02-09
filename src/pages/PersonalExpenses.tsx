import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const categories = ['Travel', 'Shopping', 'Food', 'Health', 'Entertainment', 'Others'] as const;

const PersonalExpenses = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [date, setDate] = useState('');
  const [category, setCategory] = useState<string>('Food');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const { data: expenses = [] } = useQuery({
    queryKey: ['personal_expenses', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from('personal_expenses').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const resetForm = () => { setDate(''); setCategory('Food'); setAmount(''); setDescription(''); setEditingId(null); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (editingId) {
      const { error } = await supabase.from('personal_expenses')
        .update({ date, category, amount: Number(amount), description })
        .eq('id', editingId);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Updated' });
    } else {
      const { error } = await supabase.from('personal_expenses')
        .insert({ user_id: user.id, date, category, amount: Number(amount), description });
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Added' });
    }
    queryClient.invalidateQueries({ queryKey: ['personal_expenses'] });
    setOpen(false);
    resetForm();
  };

  const remove = async (id: string) => {
    await supabase.from('personal_expenses').delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['personal_expenses'] });
    toast({ title: 'Deleted' });
  };

  const startEdit = (exp: any) => {
    setEditingId(exp.id); setDate(exp.date); setCategory(exp.category);
    setAmount(String(exp.amount)); setDescription(exp.description || '');
    setOpen(true);
  };

  const monthTotal = expenses.filter((e: any) => {
    const d = new Date(e.date); const n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }).reduce((s: number, e: any) => s + Number(e.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Personal Expenses</h1>
          <p className="text-sm text-muted-foreground">This month: ₹{monthTotal.toLocaleString()}</p>
        </div>
        <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" />Add</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? 'Edit' : 'Add'} Expense</DialogTitle></DialogHeader>
            <form onSubmit={save} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} required /></div>
                <div className="space-y-2"><Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2"><Label>Amount (₹)</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} required /></div>
              <div className="space-y-2"><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} /></div>
              <Button className="w-full" type="submit">{editingId ? 'Update' : 'Add'}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {expenses.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">No personal expenses yet.</CardContent></Card>
        ) : expenses.map((e: any) => (
          <Card key={e.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <span className="font-medium text-foreground">{e.description || e.category}</span>
                <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">{e.category}</span>
                <p className="text-xs text-muted-foreground mt-0.5">{e.date}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-foreground">₹{Number(e.amount).toLocaleString()}</span>
                <Button variant="ghost" size="icon" onClick={() => startEdit(e)}><Pencil className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => remove(e.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default PersonalExpenses;
