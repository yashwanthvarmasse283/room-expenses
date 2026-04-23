import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, RadialBarChart, RadialBar,
} from 'recharts';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, Wallet, Receipt, Flame, ArrowUpRight, ArrowDownRight,
  Calendar, Target, Activity,
} from 'lucide-react';

const COLORS = [
  'hsl(215, 65%, 52%)', 'hsl(145, 55%, 42%)', 'hsl(38, 92%, 50%)',
  'hsl(0, 65%, 55%)', 'hsl(270, 50%, 55%)', 'hsl(180, 50%, 42%)',
  'hsl(330, 55%, 50%)', 'hsl(60, 70%, 45%)',
];

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

  const { data: adminProfile } = useQuery({
    queryKey: ['insights_admin_profile', adminId],
    queryFn: async () => {
      if (!adminId) return null;
      const { data } = await supabase.from('profiles').select('monthly_budget_target').eq('id', adminId).maybeSingle();
      return data;
    },
    enabled: !!adminId,
  });
  const monthlyBudgetTarget = Number((adminProfile as any)?.monthly_budget_target) || 0;

  const now = new Date();
  const thisMonthLabel = now.toLocaleString('default', { month: 'short' });
  const lastMonthLabel = new Date(now.getFullYear(), now.getMonth() - 1).toLocaleString('default', { month: 'short' });
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = daysInMonth - dayOfMonth;

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

  const totalCollection = purse.filter((t: any) => t.type === 'inflow').reduce((s: number, t: any) => s + Number(t.amount), 0);
  const totalSpend = roomExpenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
  const purseBalance = purse.reduce((s: number, t: any) => s + (t.type === 'inflow' ? Number(t.amount) : -Number(t.amount)), 0);

  // Daily average (this month)
  const dailyAverage = dayOfMonth > 0 ? Math.round(thisMonthTotal / dayOfMonth) : 0;

  // Burn rate gauge: budget remaining vs days remaining
  const budgetRemaining = Math.max(0, monthlyBudgetTarget - thisMonthTotal);
  const burnRateData = useMemo(() => {
    if (!monthlyBudgetTarget) return [];
    const usedPct = Math.min(100, Math.round((thisMonthTotal / monthlyBudgetTarget) * 100));
    return [{ name: 'Used', value: usedPct, fill: usedPct > 90 ? 'hsl(0, 65%, 55%)' : usedPct > 70 ? 'hsl(38, 92%, 50%)' : 'hsl(145, 55%, 42%)' }];
  }, [thisMonthTotal, monthlyBudgetTarget]);

  // Projected spend for the month (linear extrapolation)
  const projectedSpend = dayOfMonth > 0 ? Math.round((thisMonthTotal / dayOfMonth) * daysInMonth) : 0;
  const projectedOver = monthlyBudgetTarget > 0 && projectedSpend > monthlyBudgetTarget;

  // Category split donut (this month)
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    thisMonthExp.forEach((e: any) => {
      map[e.category] = (map[e.category] || 0) + Number(e.amount);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [thisMonthExp]);

  // Monthly trend (last 6 months)
  const monthlyTrend = useMemo(() => {
    const map: Record<string, number> = {};
    roomExpenses.forEach((e: any) => {
      const key = e.date.slice(0, 7);
      map[key] = (map[key] || 0) + Number(e.amount);
    });
    return Object.entries(map).sort().slice(-6).map(([month, total]) => ({ month, total }));
  }, [roomExpenses]);

  // Cumulative spend curve vs budget pace line
  const cumulativeData = useMemo(() => {
    const dailyMap: Record<number, number> = {};
    thisMonthExp.forEach((e: any) => {
      const d = new Date(e.date).getDate();
      dailyMap[d] = (dailyMap[d] || 0) + Number(e.amount);
    });
    let running = 0;
    const arr: { day: number; cumulative: number; pace: number }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      if (d <= dayOfMonth) {
        running += dailyMap[d] || 0;
      }
      arr.push({
        day: d,
        cumulative: d <= dayOfMonth ? running : NaN as any,
        pace: monthlyBudgetTarget ? Math.round((monthlyBudgetTarget / daysInMonth) * d) : 0,
      });
    }
    return arr;
  }, [thisMonthExp, monthlyBudgetTarget, daysInMonth, dayOfMonth]);

  const ratio = totalCollection > 0 ? Math.min(100, Math.round((totalSpend / totalCollection) * 100)) : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Room Insights</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs text-muted-foreground">Total Collection</CardTitle>
            <Wallet className="w-4 h-4 text-[hsl(var(--success))]" />
          </CardHeader>
          <CardContent><div className="text-xl font-bold text-[hsl(var(--success))]">₹{totalCollection.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs text-muted-foreground">Total Spend</CardTitle>
            <Receipt className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent><div className="text-xl font-bold text-destructive">₹{totalSpend.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs text-muted-foreground">Purse Balance</CardTitle>
            <TrendingUp className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-xl font-bold text-foreground">₹{purseBalance.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs text-muted-foreground">Daily Avg</CardTitle>
            <Activity className="w-4 h-4 text-[hsl(var(--warning))]" />
          </CardHeader>
          <CardContent><div className="text-xl font-bold text-foreground">₹{dailyAverage.toLocaleString()}</div></CardContent>
        </Card>
      </div>

      {/* This Month Summary */}
      <Card>
        <CardHeader><CardTitle className="text-base">{thisMonthLabel}'s Snapshot</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Spent</p>
              <p className="text-lg font-bold text-foreground">₹{thisMonthTotal.toLocaleString()}</p>
              {lastMonthTotal > 0 && (
                <div className="flex items-center gap-1 text-xs">
                  {expenseChange >= 0 ? <ArrowUpRight className="w-3 h-3 text-destructive" /> : <ArrowDownRight className="w-3 h-3 text-[hsl(var(--success))]" />}
                  <span className={expenseChange >= 0 ? 'text-destructive' : 'text-[hsl(var(--success))]'}>
                    {Math.abs(expenseChange)}% vs {lastMonthLabel}
                  </span>
                </div>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Days Left</p>
              <p className="text-lg font-bold text-foreground">{daysRemaining}</p>
              <p className="text-[10px] text-muted-foreground">of {daysInMonth}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Projected</p>
              <p className={`text-lg font-bold ${projectedOver ? 'text-destructive' : 'text-foreground'}`}>₹{projectedSpend.toLocaleString()}</p>
              {monthlyBudgetTarget > 0 && (
                <p className={`text-[10px] ${projectedOver ? 'text-destructive' : 'text-[hsl(var(--success))]'}`}>
                  {projectedOver ? `Over by ₹${(projectedSpend - monthlyBudgetTarget).toLocaleString()}` : 'Within budget'}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Burn Rate Gauge + Category Donut */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Flame className="w-4 h-4 text-[hsl(var(--warning))]" />Burn Rate</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyBudgetTarget === 0 ? (
              <div className="text-center py-6 space-y-2">
                <p className="text-sm text-muted-foreground">No monthly budget set.</p>
                <p className="text-xs text-muted-foreground">Set one in Admin Control Center to see burn rate.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <ResponsiveContainer width="100%" height={180}>
                  <RadialBarChart innerRadius="65%" outerRadius="100%" data={burnRateData} startAngle={180} endAngle={0}>
                    <RadialBar dataKey="value" cornerRadius={10} background={{ fill: 'hsl(var(--muted))' }} />
                    <text x="50%" y="55%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-2xl font-bold">
                      {burnRateData[0]?.value ?? 0}%
                    </text>
                    <text x="50%" y="72%" textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-xs">
                      of budget used
                    </text>
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-muted/50">
                    <p className="text-[10px] text-muted-foreground">Budget Left</p>
                    <p className="text-sm font-bold text-[hsl(var(--success))]">₹{budgetRemaining.toLocaleString()}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/50">
                    <p className="text-[10px] text-muted-foreground">Days Left</p>
                    <p className="text-sm font-bold text-foreground">{daysRemaining}</p>
                  </div>
                </div>
                {daysRemaining > 0 && (
                  <p className="text-xs text-center text-muted-foreground">
                    Safe daily spend: <span className="font-bold text-foreground">₹{Math.round(budgetRemaining / Math.max(1, daysRemaining)).toLocaleString()}/day</span>
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Target className="w-4 h-4 text-primary" />Category Split ({thisMonthLabel})</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No expenses this month.</p>
            ) : (
              <div className="space-y-3">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={45} paddingAngle={2}>
                      {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5">
                  {categoryData.slice(0, 5).map((d, i) => {
                    const pct = Math.round((d.value / thisMonthTotal) * 100);
                    return (
                      <div key={d.name} className="flex items-center gap-2 text-xs">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-foreground truncate flex-1">{d.name}</span>
                        <span className="text-muted-foreground">₹{d.value.toLocaleString()} · {pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Spend Pace vs Budget Pace */}
      {monthlyBudgetTarget > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />Spend Pace ({thisMonthLabel})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={cumulativeData}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => typeof v === 'number' ? `₹${v.toLocaleString()}` : '—'} />
                <Line type="monotone" dataKey="pace" stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" dot={false} name="Budget pace" />
                <Line type="monotone" dataKey="cumulative" stroke="hsl(215, 65%, 52%)" strokeWidth={2} dot={false} name="Actual" connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Solid line = your spend so far · Dashed = ideal pace at ₹{Math.round(monthlyBudgetTarget / daysInMonth).toLocaleString()}/day
            </p>
          </CardContent>
        </Card>
      )}

      {/* Monthly Trend */}
      <Card>
        <CardHeader><CardTitle className="text-base">Monthly Expense Trend</CardTitle></CardHeader>
        <CardContent>
          {monthlyTrend.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyTrend}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} />
                <Bar dataKey="total" fill="hsl(215, 65%, 52%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Collection coverage – kept compact */}
      {totalCollection > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Collection Coverage</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{ratio}% of total collection spent</span>
              <span className="font-medium text-foreground">₹{totalSpend.toLocaleString()} / ₹{totalCollection.toLocaleString()}</span>
            </div>
            <Progress value={ratio} className={ratio > 90 ? '[&>div]:bg-destructive' : ratio > 70 ? '[&>div]:bg-[hsl(var(--warning))]' : ''} />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RoomInsights;
