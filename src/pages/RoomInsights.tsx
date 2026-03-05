import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Wallet, Receipt, Flame, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const COLORS = [
  'hsl(215, 65%, 52%)', 'hsl(145, 55%, 42%)', 'hsl(38, 92%, 50%)',
  'hsl(0, 65%, 55%)', 'hsl(270, 50%, 55%)', 'hsl(180, 50%, 42%)',
  'hsl(330, 55%, 50%)', 'hsl(60, 70%, 45%)',
];

const TERM_LABELS: Record<number, string> = { 1: 'Term 1 (1-10)', 2: 'Term 2 (11-20)', 3: 'Term 3 (21-End)' };
const getTermForDay = (day: number) => (day <= 10 ? 1 : day <= 20 ? 2 : 3);

const RoomInsights = () => {
  const { profile, role } = useAuth();
  const isAdmin = role === 'admin';
  const adminId = isAdmin ? profile?.id : profile?.admin_id;

  const { data: roomExpenses = [] } = useQuery({
    queryKey: ['insights_room', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase.from('room_expenses').select('*').eq('admin_id', adminId);
      return data ?? [];
    },
    enabled: !!adminId,
  });

  const { data: purse = [] } = useQuery({
    queryKey: ['insights_purse', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase.from('purse_transactions').select('*').eq('admin_id', adminId);
      return data ?? [];
    },
    enabled: !!adminId,
  });

  const { data: contributions = [] } = useQuery({
    queryKey: ['insights_contributions', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase.from('monthly_contributions').select('*').eq('admin_id', adminId);
      return data ?? [];
    },
    enabled: !!adminId,
  });

  const now = new Date();
  const thisMonthExp = useMemo(() => roomExpenses.filter((e: any) => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }), [roomExpenses]);

  const lastMonthExp = useMemo(() => roomExpenses.filter((e: any) => {
    const d = new Date(e.date);
    const lm = new Date(now.getFullYear(), now.getMonth() - 1);
    return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
  }), [roomExpenses]);

  const thisMonthTotal = thisMonthExp.reduce((s: number, e: any) => s + Number(e.amount), 0);
  const lastMonthTotal = lastMonthExp.reduce((s: number, e: any) => s + Number(e.amount), 0);
  const expenseChange = lastMonthTotal > 0 ? Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100) : 0;

  const thisMonthContribs = contributions.filter((c: any) => c.month === now.getMonth() + 1 && c.year === now.getFullYear() && c.paid);
  const lastMonthContribs = contributions.filter((c: any) => {
    const lm = new Date(now.getFullYear(), now.getMonth() - 1);
    return c.month === lm.getMonth() + 1 && c.year === lm.getFullYear() && c.paid;
  });
  const thisContribTotal = thisMonthContribs.length * 500;
  const lastContribTotal = lastMonthContribs.length * 500;

  const totalCollection = purse.filter((t: any) => t.type === 'inflow').reduce((s: number, t: any) => s + Number(t.amount), 0);
  const totalSpend = roomExpenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
  const purseBalance = purse.reduce((s: number, t: any) => s + (t.type === 'inflow' ? Number(t.amount) : -Number(t.amount)), 0);

  const burnRate = useMemo(() => {
    const total = thisMonthExp.reduce((s: number, e: any) => s + Number(e.amount), 0);
    const dayOfMonth = now.getDate();
    return dayOfMonth > 0 ? Math.round(total / dayOfMonth) : 0;
  }, [thisMonthExp]);

  const { termData, allCategories, categoryData } = useMemo(() => {
    const termTotals: Record<number, { total: number; categories: Record<string, number> }> = {
      1: { total: 0, categories: {} }, 2: { total: 0, categories: {} }, 3: { total: 0, categories: {} },
    };
    const catMap: Record<string, number> = {};

    thisMonthExp.forEach((e: any) => {
      const day = new Date(e.date).getDate();
      const term = getTermForDay(day);
      const amt = Number(e.amount);
      termTotals[term].total += amt;
      termTotals[term].categories[e.category] = (termTotals[term].categories[e.category] || 0) + amt;
      catMap[e.category] = (catMap[e.category] || 0) + amt;
    });

    const cats = new Set<string>();
    thisMonthExp.forEach((e: any) => cats.add(e.category));

    return {
      termData: [1, 2, 3].map(t => ({ term: TERM_LABELS[t], total: termTotals[t].total, ...termTotals[t].categories })),
      allCategories: Array.from(cats),
      categoryData: Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    };
  }, [thisMonthExp]);

  const ratio = totalCollection > 0 ? Math.min(100, Math.round((totalSpend / totalCollection) * 100)) : 0;

  const thisMonthLabel = now.toLocaleString('default', { month: 'short' });
  const lastMonthLabel = new Date(now.getFullYear(), now.getMonth() - 1).toLocaleString('default', { month: 'short' });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Room Insights</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Collection</CardTitle>
            <Wallet className="w-4 h-4 text-[hsl(var(--success))]" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-[hsl(var(--success))]">₹{totalCollection.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Spend</CardTitle>
            <Receipt className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">₹{totalSpend.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Purse Balance</CardTitle>
            <TrendingUp className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-foreground">₹{purseBalance.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Burn Rate</CardTitle>
            <Flame className="w-4 h-4 text-[hsl(var(--warning))]" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-[hsl(var(--warning))]">₹{burnRate.toLocaleString()}/day</div></CardContent>
        </Card>
      </div>

      {/* Monthly Comparison */}
      <Card>
        <CardHeader><CardTitle className="text-base">Monthly Comparison: {lastMonthLabel} vs {thisMonthLabel}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Expenses</p>
              <p className="text-lg font-bold text-foreground">₹{thisMonthTotal.toLocaleString()}</p>
              <div className="flex items-center gap-1 text-xs">
                {expenseChange >= 0 ? <ArrowUpRight className="w-3 h-3 text-destructive" /> : <ArrowDownRight className="w-3 h-3 text-[hsl(var(--success))]" />}
                <span className={expenseChange >= 0 ? 'text-destructive' : 'text-[hsl(var(--success))]'}>
                  {Math.abs(expenseChange)}% {expenseChange >= 0 ? 'increase' : 'decrease'} vs {lastMonthLabel}
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Contributions</p>
              <p className="text-lg font-bold text-foreground">₹{thisContribTotal.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Last month: ₹{lastContribTotal.toLocaleString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Balance Difference</p>
              <p className={`text-lg font-bold ${thisMonthTotal > lastMonthTotal ? 'text-destructive' : 'text-[hsl(var(--success))]'}`}>
                {thisMonthTotal > lastMonthTotal ? '+' : '-'}₹{Math.abs(thisMonthTotal - lastMonthTotal).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">
                {expenseChange !== 0
                  ? `This month expenses ${expenseChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(expenseChange)}% compared to last month.`
                  : 'No change from last month.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Collection vs Spend Progress */}
      <Card>
        <CardHeader><CardTitle className="text-base">Collection vs Spend</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Spent {ratio}% of collection</span>
            <span className="font-medium text-foreground">₹{totalSpend.toLocaleString()} / ₹{totalCollection.toLocaleString()}</span>
          </div>
          <Progress value={ratio} className={ratio > 90 ? '[&>div]:bg-destructive' : ratio > 70 ? '[&>div]:bg-[hsl(var(--warning))]' : ''} />
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Category Spending (This Month)</CardTitle></CardHeader>
          <CardContent>
            {categoryData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No expenses this month.</p>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="55%" height={220}>
                  <PieChart>
                    <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={35}>
                      {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {categoryData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <span className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-foreground">{d.name}</span>
                      <span className="text-muted-foreground">₹{d.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Term-Wise Breakdown (This Month)</CardTitle></CardHeader>
          <CardContent>
            {termData.every(t => t.total === 0) ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={termData}>
                  <XAxis dataKey="term" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  {allCategories.map((cat, i) => (
                    <Bar key={cat} dataKey={cat} stackId="a" fill={COLORS[i % COLORS.length]} radius={i === allCategories.length - 1 ? [4, 4, 0, 0] : undefined} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Term Totals */}
      <div className="grid grid-cols-3 gap-3">
        {termData.map((t, i) => (
          <Card key={i} className={t.total === Math.max(...termData.map(d => d.total)) && t.total > 0 ? 'border-destructive/40 bg-destructive/5' : ''}>
            <CardContent className="pt-4 text-center">
              <p className="text-xs text-muted-foreground">{t.term}</p>
              <p className="text-lg font-bold text-foreground mt-1">₹{t.total.toLocaleString()}</p>
              {t.total === Math.max(...termData.map(d => d.total)) && t.total > 0 && (
                <p className="text-xs text-destructive font-medium">Highest</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default RoomInsights;
