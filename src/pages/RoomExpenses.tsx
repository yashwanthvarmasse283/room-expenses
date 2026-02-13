import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const categories = ['Food', 'Water', 'Rent', 'Electricity', 'Internet', 'Misc'] as const;

const RoomExpenses = () => {
  const { user, role, profile } = useAuth();
  const isAdmin = role === 'admin';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<string>('all');

  const [date, setDate] = useState('');
  const [category, setCategory] = useState<string>('Food');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paidBy, setPaidBy] = useState('');

  const adminId = isAdmin ? profile?.id : profile?.admin_id;

  const { data: expenses = [] } = useQuery({
    queryKey: ['room_expenses', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase.from('room_expenses').select('*').eq('admin_id', adminId).order('date', { ascending: false });
      return data ?? [];
    },
    enabled: !!adminId,
  });

  // Fetch daily food budget
  const { data: budgetData } = useQuery({
    queryKey: ['daily_food_budget', adminId],
    queryFn: async () => {
      if (!adminId) return null;
      const { data } = await supabase.from('profiles').select('daily_food_budget').eq('id', adminId).single();
      return data;
    },
    enabled: !!adminId,
  });

  const dailyFoodBudget = (budgetData as any)?.daily_food_budget ?? 120;

  // Group expenses by date for budget highlighting
  const dailyFoodTotals = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e: any) => {
      if (e.category === 'Food') {
        map[e.date] = (map[e.date] || 0) + Number(e.amount);
      }
    });
    return map;
  }, [expenses]);

  useEffect(() => {
    if (!adminId) return;
    const channel = supabase
      .channel('room-expenses-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_expenses', filter: `admin_id=eq.${adminId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['room_expenses', adminId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [adminId, queryClient]);

  const resetForm = () => { setDate(''); setCategory('Food'); setAmount(''); setDescription(''); setPaidBy(''); setEditingId(null); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (editingId) {
      const { error } = await supabase.from('room_expenses')
        .update({ date, category, amount: Number(amount), description, paid_by: paidBy })
        .eq('id', editingId);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Updated' });
    } else {
      const expAdminId = isAdmin ? profile.id : profile.admin_id!;
      const { error } = await supabase.from('room_expenses')
        .insert({ admin_id: expAdminId, date, category, amount: Number(amount), description, paid_by: paidBy || profile.name });
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      await supabase.from('purse_transactions')
        .insert({ admin_id: expAdminId, type: 'outflow', amount: Number(amount), date, description: `Room: ${description || category}` });
      toast({ title: 'Added' });
    }
    queryClient.invalidateQueries({ queryKey: ['room_expenses'] });
    queryClient.invalidateQueries({ queryKey: ['purse_transactions'] });
    setOpen(false);
    resetForm();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('room_expenses').delete().eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    queryClient.invalidateQueries({ queryKey: ['room_expenses'] });
    toast({ title: 'Deleted' });
  };

  const startEdit = (exp: any) => {
    setEditingId(exp.id); setDate(exp.date); setCategory(exp.category);
    setAmount(String(exp.amount)); setDescription(exp.description || ''); setPaidBy(exp.paid_by || '');
    setOpen(true);
  };

  const filtered = expenses.filter((e: any) => {
    const matchSearch = !search || (e.description || '').toLowerCase().includes(search.toLowerCase()) || e.category.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === 'all' || e.category === filterCat;
    return matchSearch && matchCat;
  });

  const monthlyTotal = expenses.filter((e: any) => {
    const d = new Date(e.date); const n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }).reduce((s: number, e: any) => s + Number(e.amount), 0);

  // Group filtered expenses by date for display
  const groupedByDate = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filtered.forEach((e: any) => {
      if (!groups[e.date]) groups[e.date] = [];
      groups[e.date].push(e);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const getBudgetColor = (date: string) => {
    const foodTotal = dailyFoodTotals[date] || 0;
    if (foodTotal === 0) return '';
    return foodTotal > dailyFoodBudget ? 'border-l-4 border-l-destructive bg-destructive/5' : 'border-l-4 border-l-[hsl(var(--success))] bg-[hsl(var(--success))]/5';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Room Expenses</h1>
          <p className="text-sm text-muted-foreground">Monthly total: ₹{monthlyTotal.toLocaleString()} · Food budget: ₹{dailyFoodBudget}/day</p>
        </div>
        <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-1" />Add Expense</Button>
          </DialogTrigger>
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
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Amount (₹)</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} required /></div>
                <div className="space-y-2"><Label>Paid By</Label><Input value={paidBy} onChange={e => setPaidBy(e.target.value)} /></div>
              </div>
              <div className="space-y-2"><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} /></div>
              <Button className="w-full" type="submit">{editingId ? 'Update' : 'Add'} Expense</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search expenses..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        {groupedByDate.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">No expenses found.</CardContent></Card>
        ) : groupedByDate.map(([dateKey, items]) => (
          <div key={dateKey} className={`rounded-lg p-3 ${getBudgetColor(dateKey)}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">{dateKey}</p>
              {dailyFoodTotals[dateKey] > 0 && (
                <p className={`text-xs font-medium ${dailyFoodTotals[dateKey] > dailyFoodBudget ? 'text-destructive' : 'text-[hsl(var(--success))]'}`}>
                  Food: ₹{dailyFoodTotals[dateKey].toLocaleString()} / ₹{dailyFoodBudget}
                </p>
              )}
            </div>
            <div className="space-y-2">
              {items.map((e: any) => (
                <Card key={e.id}>
                  <CardContent className="flex items-center justify-between p-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground text-sm">{e.description || e.category}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">{e.category}</span>
                      </div>
                      {e.paid_by && <p className="text-xs text-muted-foreground mt-0.5">Paid by {e.paid_by}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-foreground">₹{Number(e.amount).toLocaleString()}</span>
                      {isAdmin && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => startEdit(e)}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => remove(e.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RoomExpenses;
