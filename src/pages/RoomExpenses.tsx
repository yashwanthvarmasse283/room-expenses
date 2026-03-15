import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Pencil, Trash2, Search, Users, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const defaultCategories = ['Food', 'Water', 'Rent', 'Electricity', 'Internet', 'Misc'];

const RoomExpenses = () => {
  const { user, role, profile, isViewOnly } = useAuth();
  const isAdmin = role === 'admin';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<string>('all');

  const [date, setDate] = useState('');
  const [category, setCategory] = useState<string>('Food');
  const [customCategory, setCustomCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [selectedSplitMembers, setSelectedSplitMembers] = useState<string[]>([]);

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

  const { data: members = [] } = useQuery({
    queryKey: ['room_members_expenses', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase.from('profiles').select('id, user_id, name').or(`id.eq.${adminId},admin_id.eq.${adminId}`).eq('approved', true);
      return data ?? [];
    },
    enabled: !!adminId,
  });

  const { data: virtualMembers = [] } = useQuery({
    queryKey: ['virtual_roommates', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase.from('virtual_roommates').select('*').eq('admin_id', adminId);
      return data ?? [];
    },
    enabled: !!adminId,
  });

  const allMembers = useMemo(() => {
    const real = members.map((m: any) => ({ id: m.user_id || m.id, name: m.name, type: 'real' }));
    const virtual = virtualMembers.map((v: any) => ({ id: v.id, name: v.name, type: 'virtual' }));
    return [...real, ...virtual];
  }, [members, virtualMembers]);

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

  // Get unique categories from existing expenses + defaults
  const allCategories = useMemo(() => {
    const cats = new Set(defaultCategories);
    expenses.forEach((e: any) => { if (e.category) cats.add(e.category); });
    return Array.from(cats);
  }, [expenses]);

  const dailyFoodTotals = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e: any) => {
      if (e.category?.toLowerCase() === 'food') {
        map[e.date] = (map[e.date] || 0) + Number(e.amount);
      }
    });
    return map;
  }, [expenses]);

  const dailyTotals = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e: any) => {
      map[e.date] = (map[e.date] || 0) + Number(e.amount);
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

  const resetForm = () => {
    setDate(''); setCategory('Food'); setCustomCategory(''); setAmount(''); setDescription(''); setPaidBy('');
    setEditingId(null); setSelectedSplitMembers([]);
  };

  const getEffectiveCategory = () => category === '_custom' ? customCategory.trim() : category;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || isViewOnly) return;

    const effectiveCategory = getEffectiveCategory();
    if (!effectiveCategory) {
      toast({ title: 'Please enter a category name', variant: 'destructive' });
      return;
    }

    if (!editingId) {
      const existingDailyTotal = dailyTotals[date] || 0;
      if (dailyFoodBudget > 0 && existingDailyTotal + Number(amount) > dailyFoodBudget * allMembers.length) {
        toast({ title: '⚠️ Daily spending limit exceeded.', description: `Total for ${date} will exceed the daily budget.`, variant: 'destructive' });
      }
      if (effectiveCategory.toLowerCase() === 'food') {
        const existingFoodTotal = dailyFoodTotals[date] || 0;
        if (existingFoodTotal + Number(amount) > dailyFoodBudget) {
          toast({ title: '⚠️ Daily food budget exceeded.', description: `Food budget for ${date}: ₹${dailyFoodBudget}`, variant: 'destructive' });
        }
      }
    }

    const splitAmong = selectedSplitMembers.length > 0 ? selectedSplitMembers : null;

    if (editingId) {
      const { error } = await supabase.from('room_expenses')
        .update({ date, category: effectiveCategory, amount: Number(amount), description, paid_by: paidBy, split_among: splitAmong })
        .eq('id', editingId);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Updated' });
    } else {
      const expAdminId = isAdmin ? profile.id : profile.admin_id!;
      const { error } = await supabase.from('room_expenses')
        .insert({ admin_id: expAdminId, date, category: effectiveCategory, amount: Number(amount), description, paid_by: paidBy || profile.name, split_among: splitAmong });
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      await supabase.from('purse_transactions')
        .insert({ admin_id: expAdminId, type: 'outflow', amount: Number(amount), date, description: `Room: ${description || effectiveCategory}` });
      toast({ title: 'Added' });
    }
    queryClient.invalidateQueries({ queryKey: ['room_expenses'] });
    queryClient.invalidateQueries({ queryKey: ['purse_transactions'] });
    setOpen(false);
    resetForm();
  };

  const remove = async (id: string) => {
    if (isViewOnly) return;
    const { error } = await supabase.from('room_expenses').delete().eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    queryClient.invalidateQueries({ queryKey: ['room_expenses'] });
    toast({ title: 'Deleted' });
  };

  const startEdit = (exp: any) => {
    if (isViewOnly) return;
    setEditingId(exp.id); setDate(exp.date);
    // Check if category is a default or custom
    if (defaultCategories.includes(exp.category)) {
      setCategory(exp.category);
      setCustomCategory('');
    } else {
      setCategory('_custom');
      setCustomCategory(exp.category);
    }
    setAmount(String(exp.amount)); setDescription(exp.description || ''); setPaidBy(exp.paid_by || '');
    setSelectedSplitMembers(exp.split_among || []);
    setOpen(true);
  };

  const toggleSplitMember = (name: string) => {
    setSelectedSplitMembers(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const perPersonShare = useMemo(() => {
    if (!amount || selectedSplitMembers.length === 0) return 0;
    return Math.round((Number(amount) / selectedSplitMembers.length) * 100) / 100;
  }, [amount, selectedSplitMembers]);

  const filtered = expenses.filter((e: any) => {
    const matchSearch = !search || (e.description || '').toLowerCase().includes(search.toLowerCase()) || e.category.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === 'all' || e.category.toLowerCase() === filterCat.toLowerCase();
    return matchSearch && matchCat;
  });

  const monthlyTotal = expenses.filter((e: any) => {
    const d = new Date(e.date); const n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }).reduce((s: number, e: any) => s + Number(e.amount), 0);

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

  const exportCsv = () => {
    const headers = ['Date', 'Category', 'Amount', 'Description', 'Paid By', 'Split Among'];
    const rows = filtered.map((e: any) => [
      e.date, e.category, e.amount, e.description || '', e.paid_by || '',
      e.split_among ? e.split_among.join('; ') : ''
    ]);
    const csv = [headers, ...rows].map(r => r.map((c: any) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `room-expenses-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: `${filtered.length} expenses exported to CSV.` });
  };

  const canEdit = isAdmin && !isViewOnly;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Room Expenses</h1>
          <p className="text-sm text-muted-foreground">Monthly total: ₹{monthlyTotal.toLocaleString()} · Food budget: ₹{dailyFoodBudget}/day</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="w-4 h-4 mr-1" />Export
          </Button>
          {!isViewOnly && (
            <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-1" />Add Expense</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editingId ? 'Edit' : 'Add'} Expense</DialogTitle></DialogHeader>
                <form onSubmit={save} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} required /></div>
                    <div className="space-y-2"><Label>Category</Label>
                      <Select value={category} onValueChange={v => { setCategory(v); if (v !== '_custom') setCustomCategory(''); }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {defaultCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          <SelectItem value="_custom">✏️ Custom...</SelectItem>
                        </SelectContent>
                      </Select>
                      {category === '_custom' && (
                        <Input
                          placeholder="Enter custom category"
                          value={customCategory}
                          onChange={e => setCustomCategory(e.target.value)}
                          className="mt-2"
                          required
                        />
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Amount (₹)</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} required /></div>
                    <div className="space-y-2"><Label>Paid By</Label><Input value={paidBy} onChange={e => setPaidBy(e.target.value)} /></div>
                  </div>
                  <div className="space-y-2"><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} /></div>

                  {/* Split Among */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2"><Users className="w-4 h-4" />Split Among</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {allMembers.map(m => (
                        <label key={m.id} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted">
                          <Checkbox
                            checked={selectedSplitMembers.includes(m.name)}
                            onCheckedChange={() => toggleSplitMember(m.name)}
                          />
                          <span className="text-foreground">{m.name}</span>
                          {m.type === 'virtual' && <span className="text-[10px] text-muted-foreground">(Virtual)</span>}
                        </label>
                      ))}
                    </div>
                    {selectedSplitMembers.length > 0 && amount && (
                      <p className="text-xs text-muted-foreground">
                        Each person pays: <span className="font-bold text-foreground">₹{perPersonShare.toLocaleString()}</span> ({selectedSplitMembers.length} people)
                      </p>
                    )}
                  </div>

                  <Button className="w-full" type="submit">{editingId ? 'Update' : 'Add'} Expense</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
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
            {allCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
                      {e.split_among && e.split_among.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Split: {e.split_among.join(', ')} · ₹{(Number(e.amount) / e.split_among.length).toFixed(0)} each
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-foreground">₹{Number(e.amount).toLocaleString()}</span>
                      {canEdit && (
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
