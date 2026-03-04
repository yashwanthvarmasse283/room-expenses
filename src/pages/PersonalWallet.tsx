import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Plus, ArrowDownLeft, ArrowUpRight, Wallet, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const expenseCategories = ['Food', 'Travel', 'Personal', 'Shopping', 'Health', 'Entertainment', 'Bills', 'Others'] as const;

const COLORS = [
  'hsl(215, 65%, 52%)', 'hsl(145, 55%, 42%)', 'hsl(38, 92%, 50%)',
  'hsl(0, 65%, 55%)', 'hsl(270, 50%, 55%)', 'hsl(180, 50%, 42%)',
  'hsl(330, 55%, 50%)', 'hsl(60, 70%, 45%)',
];

const TERM_LABELS: Record<number, string> = { 1: 'Term 1 (1-10)', 2: 'Term 2 (11-20)', 3: 'Term 3 (21-30)' };
const getTermForDay = (day: number) => (day <= 10 ? 1 : day <= 20 ? 2 : 3);

const PersonalWallet = () => {
  const { user, profile, isViewOnly } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [txType, setTxType] = useState<'income' | 'expense'>('expense');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState<string>('Personal');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const { data: transactions = [] } = useQuery({
    queryKey: ['personal_wallet', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from('personal_wallet').select('*').eq('user_id', user.id).order('date', { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: profileData } = useQuery({
    queryKey: ['personal_daily_limit', profile?.id],
    queryFn: async () => {
      if (!profile) return null;
      const { data } = await supabase.from('profiles').select('personal_daily_limit').eq('id', profile.id).single();
      return data;
    },
    enabled: !!profile,
  });

  const dailyLimit = (profileData as any)?.personal_daily_limit ?? 0;

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('personal-wallet-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'personal_wallet', filter: `user_id=eq.${user.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['personal_wallet', user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const balance = transactions.reduce((s: number, t: any) => s + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0);
  const totalIncome = transactions.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + Number(t.amount), 0);
  const totalSpent = transactions.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + Number(t.amount), 0);

  // Today's spending
  const today = new Date().toISOString().slice(0, 10);
  const todaySpent = transactions
    .filter((t: any) => t.type === 'expense' && t.date === today)
    .reduce((s: number, t: any) => s + Number(t.amount), 0);
  const overLimit = dailyLimit > 0 && todaySpent > dailyLimit;
  const limitPercent = dailyLimit > 0 ? Math.min(100, Math.round((todaySpent / dailyLimit) * 100)) : 0;

  // 3-Term Analysis
  const termData = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const thisMonth = transactions.filter((t: any) => {
      if (t.type !== 'expense') return false;
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const termTotals: Record<number, { total: number; categories: Record<string, number> }> = {
      1: { total: 0, categories: {} },
      2: { total: 0, categories: {} },
      3: { total: 0, categories: {} },
    };

    thisMonth.forEach((t: any) => {
      const day = new Date(t.date).getDate();
      const term = getTermForDay(day);
      const amt = Number(t.amount);
      termTotals[term].total += amt;
      termTotals[term].categories[t.category] = (termTotals[term].categories[t.category] || 0) + amt;
    });

    return [1, 2, 3].map(t => ({
      term: TERM_LABELS[t],
      total: termTotals[t].total,
      ...termTotals[t].categories,
    }));
  }, [transactions]);

  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    transactions.filter((t: any) => t.type === 'expense').forEach((t: any) => cats.add(t.category));
    return Array.from(cats);
  }, [transactions]);

  // Group by date
  const groupedByDate = useMemo(() => {
    const groups: Record<string, any[]> = {};
    transactions.forEach((t: any) => {
      if (!groups[t.date]) groups[t.date] = [];
      groups[t.date].push(t);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [transactions]);

  const resetForm = () => { setDate(''); setCategory('Personal'); setAmount(''); setDescription(''); setEditingId(null); setTxType('expense'); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (editingId) {
      const { error } = await supabase.from('personal_wallet')
        .update({ date, category, amount: Number(amount), description, type: txType })
        .eq('id', editingId);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Updated' });
    } else {
      const { error } = await supabase.from('personal_wallet')
        .insert({ user_id: user.id, type: txType, date, category: txType === 'income' ? 'Income' : category, amount: Number(amount), description });
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: txType === 'income' ? 'Income Added' : 'Expense Added' });
    }
    queryClient.invalidateQueries({ queryKey: ['personal_wallet'] });
    setOpen(false);
    resetForm();
  };

  const remove = async (id: string) => {
    await supabase.from('personal_wallet').delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['personal_wallet'] });
    toast({ title: 'Deleted' });
  };

  const startEdit = (t: any) => {
    setEditingId(t.id); setAmount(String(t.amount)); setDate(t.date);
    setDescription(t.description || ''); setTxType(t.type); setCategory(t.category);
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Personal Wallet</h1>
          <p className="text-sm text-muted-foreground">
            Today's spend: <span className={`font-bold ${overLimit ? 'text-destructive' : 'text-[hsl(var(--success))]'}`}>
              ₹{todaySpent.toLocaleString()}
            </span>
            {dailyLimit > 0 && <span className="text-muted-foreground"> / ₹{dailyLimit}</span>}
          </p>
        </div>
        {!isViewOnly && (
          <div className="flex gap-2">
            <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild>
                <Button onClick={() => setTxType('income')} variant="outline"><ArrowDownLeft className="w-4 h-4 mr-1" />Add Income</Button>
              </DialogTrigger>
              <DialogTrigger asChild>
                <Button onClick={() => setTxType('expense')}><ArrowUpRight className="w-4 h-4 mr-1" />Add Expense</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editingId ? 'Edit' : txType === 'income' ? 'Add Income' : 'Add Expense'}</DialogTitle></DialogHeader>
                <form onSubmit={save} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} required /></div>
                    {txType === 'expense' && (
                      <div className="space-y-2"><Label>Category</Label>
                        <Select value={category} onValueChange={setCategory}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{expenseCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2"><Label>Amount (₹)</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} required /></div>
                  <div className="space-y-2"><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} /></div>
                  <Button className="w-full" type="submit">{editingId ? 'Update' : 'Save'}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Daily Limit Progress Bar */}
      {dailyLimit > 0 && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Daily Budget</span>
              <span className={`font-bold ${overLimit ? 'text-destructive' : 'text-[hsl(var(--success))]'}`}>
                ₹{todaySpent.toLocaleString()} / ₹{dailyLimit.toLocaleString()}
              </span>
            </div>
            <Progress
              value={limitPercent}
              className={overLimit ? '[&>div]:bg-destructive' : '[&>div]:bg-[hsl(var(--success))]'}
            />
            {overLimit && <p className="text-xs text-destructive font-medium">⚠️ Daily limit exceeded!</p>}
          </CardContent>
        </Card>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Balance</CardTitle>
            <Wallet className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-foreground">₹{balance.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Income</CardTitle>
            <ArrowDownLeft className="w-4 h-4 text-[hsl(var(--success))]" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-[hsl(var(--success))]">₹{totalIncome.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Spent</CardTitle>
            <ArrowUpRight className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">₹{totalSpent.toLocaleString()}</div></CardContent>
        </Card>
      </div>

      {/* 3-Term Analysis */}
      <Card>
        <CardHeader><CardTitle className="text-base">Term-Wise Spending (This Month)</CardTitle></CardHeader>
        <CardContent>
          {termData.every(t => t.total === 0) ? (
            <p className="text-sm text-muted-foreground">No expenses this month yet.</p>
          ) : (
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={termData}>
                  <XAxis dataKey="term" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  {allCategories.map((cat, i) => (
                    <Bar key={cat} dataKey={cat} stackId="a" fill={COLORS[i % COLORS.length]} radius={i === allCategories.length - 1 ? [4, 4, 0, 0] : undefined} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-3 gap-3">
                {termData.map((t, i) => (
                  <div key={i} className={`text-center p-3 rounded-lg ${t.total === Math.max(...termData.map(d => d.total)) && t.total > 0 ? 'bg-destructive/10 border border-destructive/30' : 'bg-muted/50'}`}>
                    <p className="text-xs text-muted-foreground">{t.term}</p>
                    <p className="text-lg font-bold text-foreground">₹{t.total.toLocaleString()}</p>
                    {t.total === Math.max(...termData.map(d => d.total)) && t.total > 0 && (
                      <p className="text-xs text-destructive font-medium">Highest</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction History grouped by date */}
      <Card>
        <CardHeader><CardTitle className="text-base">Transaction History</CardTitle></CardHeader>
        <CardContent>
          {groupedByDate.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <div className="space-y-4">
              {groupedByDate.map(([dateKey, items]) => (
                <div key={dateKey}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">{dateKey}</p>
                  <div className="space-y-2">
                    {items.map((t: any) => (
                      <div key={t.id} className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0">
                        <div className="flex items-center gap-3">
                          {t.type === 'income' ? <ArrowDownLeft className="w-4 h-4 text-[hsl(var(--success))]" /> : <ArrowUpRight className="w-4 h-4 text-destructive" />}
                          <div>
                            <p className="font-medium text-foreground">{t.description || t.category}</p>
                            <p className="text-xs text-muted-foreground">{t.category}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${t.type === 'income' ? 'text-[hsl(var(--success))]' : 'text-destructive'}`}>
                            {t.type === 'income' ? '+' : '-'}₹{Number(t.amount).toLocaleString()}
                          </span>
                          {!isViewOnly && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => startEdit(t)}><Pencil className="w-3 h-3" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => remove(t.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PersonalWallet;
