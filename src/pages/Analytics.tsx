import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TrendingUp, TrendingDown } from 'lucide-react';
import GroceryAnalytics from '@/components/GroceryAnalytics';

const COLORS = [
  'hsl(215, 65%, 52%)', 'hsl(145, 55%, 42%)', 'hsl(38, 92%, 50%)',
  'hsl(0, 65%, 55%)', 'hsl(270, 50%, 55%)', 'hsl(180, 50%, 42%)',
  'hsl(330, 55%, 50%)', 'hsl(60, 70%, 45%)',
];

const TERM_LABELS: Record<number, string> = { 1: 'Term 1 (1-10)', 2: 'Term 2 (11-20)', 3: 'Term 3 (21-30)' };
const getTermForDay = (day: number) => (day <= 10 ? 1 : day <= 20 ? 2 : 3);

const Analytics = () => {
  const { profile, role } = useAuth();
  const isAdmin = role === 'admin';
  const queryClient = useQueryClient();
  const adminId = isAdmin ? profile?.id : profile?.admin_id;

  const { data: roomExpenses = [] } = useQuery({
    queryKey: ['analytics_room', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase.from('room_expenses').select('*').eq('admin_id', adminId);
      return data ?? [];
    },
    enabled: !!adminId,
  });

  const { data: purse = [] } = useQuery({
    queryKey: ['analytics_purse', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase.from('purse_transactions').select('*').eq('admin_id', adminId);
      return data ?? [];
    },
    enabled: !!adminId,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['analytics_members', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase.from('profiles').select('id, user_id, name').or(`id.eq.${adminId},admin_id.eq.${adminId}`).eq('approved', true);
      return data ?? [];
    },
    enabled: !!adminId,
  });

  const { data: virtualMembers = [] } = useQuery({
    queryKey: ['analytics_virtual', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase.from('virtual_roommates').select('*').eq('admin_id', adminId);
      return data ?? [];
    },
    enabled: !!adminId,
  });

  useEffect(() => {
    if (!adminId) return;
    const channel = supabase
      .channel('analytics-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_expenses', filter: `admin_id=eq.${adminId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['analytics_room', adminId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purse_transactions', filter: `admin_id=eq.${adminId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['analytics_purse', adminId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [adminId, queryClient]);

  const allMemberNames = useMemo(() => {
    const real = members.map((m: any) => m.name);
    const virtual = virtualMembers.map((v: any) => v.name);
    return [...real, ...virtual];
  }, [members, virtualMembers]);

  const expenses = roomExpenses;
  const now = new Date();

  // Last month vs month before
  const lastMonthExpenses = useMemo(() => {
    const lm = new Date(now.getFullYear(), now.getMonth() - 1);
    return expenses.filter((e: any) => {
      const d = new Date(e.date);
      return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
    });
  }, [expenses]);

  const monthBeforeExpenses = useMemo(() => {
    const mb = new Date(now.getFullYear(), now.getMonth() - 2);
    return expenses.filter((e: any) => {
      const d = new Date(e.date);
      return d.getMonth() === mb.getMonth() && d.getFullYear() === mb.getFullYear();
    });
  }, [expenses]);

  const lastMonthTotal = lastMonthExpenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
  const monthBeforeTotal = monthBeforeExpenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
  const lastMonthChange = monthBeforeTotal ? Math.round(((lastMonthTotal - monthBeforeTotal) / monthBeforeTotal) * 100) : 0;

  const thisMonthTotal = useMemo(() => {
    return expenses.filter((e: any) => {
      const d = new Date(e.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).reduce((s: number, e: any) => s + Number(e.amount), 0);
  }, [expenses]);

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e: any) => { map[e.category] = (map[e.category] || 0) + Number(e.amount); });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [expenses]);

  const monthlyData = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e: any) => {
      const key = e.date.slice(0, 7);
      map[key] = (map[key] || 0) + Number(e.amount);
    });
    return Object.entries(map).sort().slice(-6).map(([month, total]) => ({ month, total }));
  }, [expenses]);

  const purseBalance = useMemo(() =>
    purse.reduce((s: number, t: any) => s + (t.type === 'inflow' ? Number(t.amount) : -Number(t.amount)), 0),
  [purse]);

  const totalInflow = useMemo(() =>
    purse.filter((t: any) => t.type === 'inflow').reduce((s: number, t: any) => s + Number(t.amount), 0),
  [purse]);

  const totalOutflow = useMemo(() =>
    purse.filter((t: any) => t.type === 'outflow').reduce((s: number, t: any) => s + Number(t.amount), 0),
  [purse]);

  const termData = useMemo(() => {
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const thisMonthExpenses = expenses.filter((e: any) => {
      const d = new Date(e.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const termTotals: Record<number, { total: number; categories: Record<string, number> }> = {
      1: { total: 0, categories: {} }, 2: { total: 0, categories: {} }, 3: { total: 0, categories: {} },
    };
    thisMonthExpenses.forEach((e: any) => {
      const day = new Date(e.date).getDate();
      const term = getTermForDay(day);
      const amt = Number(e.amount);
      termTotals[term].total += amt;
      termTotals[term].categories[e.category] = (termTotals[term].categories[e.category] || 0) + amt;
    });
    return [1, 2, 3].map(t => ({ term: TERM_LABELS[t], total: termTotals[t].total, ...termTotals[t].categories }));
  }, [expenses]);

  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    expenses.forEach((e: any) => cats.add(e.category));
    return Array.from(cats);
  }, [expenses]);

  const paidByMemberData = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e: any) => {
      const payer = e.paid_by || 'Unknown';
      map[payer] = (map[payer] || 0) + Number(e.amount);
    });
    return Object.entries(map).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
  }, [expenses]);

  const spentByMemberData = useMemo(() => {
    if (allMemberNames.length === 0) return [];
    const totalExp = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
    const perPerson = allMemberNames.length > 0 ? totalExp / allMemberNames.length : 0;
    return allMemberNames.map(name => ({ name, total: Math.round(perPerson) }));
  }, [expenses, allMemberNames]);

  const lastMonthLabel = new Date(now.getFullYear(), now.getMonth() - 1).toLocaleString('default', { month: 'long' });
  const monthBeforeLabel = new Date(now.getFullYear(), now.getMonth() - 2).toLocaleString('default', { month: 'short' });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Analytics</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">This Month</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-foreground">₹{thisMonthTotal.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Last Month ({lastMonthLabel})</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">₹{lastMonthTotal.toLocaleString()}</div>
            {monthBeforeTotal > 0 && (
              <p className={`text-xs flex items-center gap-1 mt-1 ${lastMonthChange >= 0 ? 'text-destructive' : 'text-[hsl(var(--success))]'}`}>
                {lastMonthChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {lastMonthChange >= 0 ? '+' : ''}{lastMonthChange}% vs {monthBeforeLabel}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Purse Balance</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-[hsl(var(--success))]">₹{purseBalance.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Inflow / Outflow</CardTitle></CardHeader>
          <CardContent><div className="text-sm font-medium"><span className="text-[hsl(var(--success))]">₹{totalInflow.toLocaleString()}</span> / <span className="text-destructive">₹{totalOutflow.toLocaleString()}</span></div></CardContent>
        </Card>
      </div>

      {/* Grocery Analytics */}
      <GroceryAnalytics />

      {/* Total Paid by Each Member */}
      <Card>
        <CardHeader><CardTitle className="text-base">Total Paid by Each Member (All Time)</CardTitle></CardHeader>
        <CardContent>
          {paidByMemberData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={paidByMemberData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="total" fill="hsl(215, 65%, 52%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border"><th className="text-left py-2 px-3 text-muted-foreground">Member</th><th className="text-right py-2 px-3 text-muted-foreground">Total Paid</th></tr></thead>
                  <tbody>
                    {paidByMemberData.map(d => (
                      <tr key={d.name} className="border-b border-border/50">
                        <td className="py-2 px-3 text-foreground">{d.name}</td>
                        <td className="py-2 px-3 text-right font-bold text-foreground">₹{d.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Total Spent by Each Member */}
      <Card>
        <CardHeader><CardTitle className="text-base">Total Spent per Member (Equal Share, All Time)</CardTitle></CardHeader>
        <CardContent>
          {spentByMemberData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={spentByMemberData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="total" fill="hsl(145, 55%, 42%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border"><th className="text-left py-2 px-3 text-muted-foreground">Member</th><th className="text-right py-2 px-3 text-muted-foreground">Total Spent (Share)</th></tr></thead>
                  <tbody>
                    {spentByMemberData.map(d => (
                      <tr key={d.name} className="border-b border-border/50">
                        <td className="py-2 px-3 text-foreground">{d.name}</td>
                        <td className="py-2 px-3 text-right font-bold text-foreground">₹{d.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Term-Wise */}
      <Card>
        <CardHeader><CardTitle className="text-base">Term-Wise Expenditure (This Month)</CardTitle></CardHeader>
        <CardContent>
          {termData.every(t => t.total === 0) ? (
            <p className="text-sm text-muted-foreground">No expenses this month yet.</p>
          ) : (
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={280}>
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

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Monthly Trend</CardTitle></CardHeader>
          <CardContent>
            {monthlyData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthlyData}>
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="total" fill="hsl(215, 65%, 52%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Category Breakdown</CardTitle></CardHeader>
          <CardContent>
            {categoryData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="60%" height={250}>
                  <PieChart>
                    <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                      {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {categoryData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2 text-sm">
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
      </div>
    </div>
  );
};

export default Analytics;
