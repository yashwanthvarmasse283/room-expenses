import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { ShoppingCart, TrendingUp, TrendingDown, Target, Activity } from 'lucide-react';

const COLORS = [
  'hsl(215, 65%, 52%)', 'hsl(145, 55%, 42%)', 'hsl(38, 92%, 50%)',
  'hsl(0, 65%, 55%)', 'hsl(270, 50%, 55%)', 'hsl(180, 50%, 42%)',
  'hsl(330, 55%, 50%)', 'hsl(60, 70%, 45%)',
];

const GroceryAnalytics = () => {
  const { profile, role } = useAuth();
  const isAdmin = role === 'admin';
  const adminId = isAdmin ? profile?.id : profile?.admin_id;

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [drillItem, setDrillItem] = useState<string | null>(null);
  const [volatilityItem, setVolatilityItem] = useState<string>('');

  const { data: groceryItems = [] } = useQuery({
    queryKey: ['grocery_analytics_items', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase.from('expense_grocery_items').select('*');
      return data ?? [];
    },
    enabled: !!adminId,
  });

  const { data: roomExpenses = [] } = useQuery({
    queryKey: ['grocery_analytics_expenses', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase.from('room_expenses').select('id, date, amount, description, paid_by, category').eq('admin_id', adminId);
      return data ?? [];
    },
    enabled: !!adminId,
  });

  const { data: groceries = [] } = useQuery({
    queryKey: ['groceries_list', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase.from('groceries').select('*').eq('admin_id', adminId);
      return data ?? [];
    },
    enabled: !!adminId,
  });

  const { data: itemBudgets = [] } = useQuery({
    queryKey: ['item_budgets', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase.from('item_budgets').select('*').eq('admin_id', adminId);
      return data ?? [];
    },
    enabled: !!adminId,
  });

  // Map expense IDs to dates
  const expenseDateMap = useMemo(() => {
    const map: Record<string, string> = {};
    roomExpenses.forEach((e: any) => { map[e.id] = e.date; });
    return map;
  }, [roomExpenses]);

  // Enrich grocery items with dates
  const enrichedItems = useMemo(() => {
    return groceryItems.map((gi: any) => ({
      ...gi,
      date: expenseDateMap[gi.expense_id] || '',
    })).filter((gi: any) => gi.date);
  }, [groceryItems, expenseDateMap]);

  // Filter by selected month
  const selectedMonthItems = useMemo(() => {
    return enrichedItems.filter((gi: any) => {
      const d = new Date(gi.date);
      return d.getFullYear() === selectedYear && d.getMonth() + 1 === selectedMonth;
    });
  }, [enrichedItems, selectedYear, selectedMonth]);

  // Previous month items
  const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
  const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
  const prevMonthItems = useMemo(() => {
    return enrichedItems.filter((gi: any) => {
      const d = new Date(gi.date);
      return d.getFullYear() === prevYear && d.getMonth() + 1 === prevMonth;
    });
  }, [enrichedItems, prevYear, prevMonth]);

  // Item-wise aggregation for selected month
  const itemWiseData = useMemo(() => {
    const map: Record<string, { total: number; qty: number; count: number }> = {};
    selectedMonthItems.forEach((gi: any) => {
      const name = gi.item_name || 'Unknown';
      if (!map[name]) map[name] = { total: 0, qty: 0, count: 0 };
      map[name].total += Number(gi.quantity) * Number(gi.unit_price);
      map[name].qty += Number(gi.quantity);
      map[name].count += 1;
    });
    // Previous month
    const prevMap: Record<string, number> = {};
    prevMonthItems.forEach((gi: any) => {
      const name = gi.item_name || 'Unknown';
      prevMap[name] = (prevMap[name] || 0) + Number(gi.quantity) * Number(gi.unit_price);
    });
    return Object.entries(map)
      .map(([name, d]) => ({
        name,
        total: d.total,
        qty: d.qty,
        count: d.count,
        avgPrice: d.qty > 0 ? d.total / d.qty : 0,
        prevTotal: prevMap[name] || 0,
        change: prevMap[name] ? d.total - prevMap[name] : d.total,
        changePct: prevMap[name] ? Math.round(((d.total - prevMap[name]) / prevMap[name]) * 100) : 100,
      }))
      .sort((a, b) => b.total - a.total);
  }, [selectedMonthItems, prevMonthItems]);

  // Monthly trend (last 6 months)
  const monthlyTrend = useMemo(() => {
    const months: { key: string; label: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(selectedYear, selectedMonth - 1 - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
      const total = enrichedItems
        .filter((gi: any) => gi.date.startsWith(key))
        .reduce((s: number, gi: any) => s + Number(gi.quantity) * Number(gi.unit_price), 0);
      months.push({ key, label, total });
    }
    return months;
  }, [enrichedItems, selectedYear, selectedMonth]);

  // Top 10 most spent
  const top10Spent = itemWiseData.slice(0, 10);

  // Top 10 most frequently purchased
  const top10Frequent = useMemo(() => {
    return [...itemWiseData].sort((a, b) => b.count - a.count).slice(0, 10);
  }, [itemWiseData]);

  // All distinct item names (for the volatility selector)
  const allItemNames = useMemo(() => {
    const set = new Set<string>();
    enrichedItems.forEach((gi: any) => {
      if (gi.item_name) set.add(gi.item_name);
    });
    return Array.from(set).sort();
  }, [enrichedItems]);

  // Auto-select the highest-spend item if no selection yet
  const effectiveVolatilityItem = volatilityItem || top10Spent[0]?.name || allItemNames[0] || '';

  // Price volatility for the selected item — last 6 months avg ₹/unit
  const volatilityData = useMemo(() => {
    if (!effectiveVolatilityItem) return [];
    const months: { key: string; label: string; avgPrice: number; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(selectedYear, selectedMonth - 1 - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('default', { month: 'short' });
      const itemsInMonth = enrichedItems.filter(
        (gi: any) => gi.date.startsWith(key) && gi.item_name === effectiveVolatilityItem
      );
      const totalQty = itemsInMonth.reduce((s: number, gi: any) => s + Number(gi.quantity), 0);
      const totalSpend = itemsInMonth.reduce((s: number, gi: any) => s + Number(gi.quantity) * Number(gi.unit_price), 0);
      months.push({
        key,
        label,
        avgPrice: totalQty > 0 ? Math.round(totalSpend / totalQty) : 0,
        total: totalSpend,
      });
    }
    return months;
  }, [enrichedItems, effectiveVolatilityItem, selectedYear, selectedMonth]);

  const volatilityFirstNonZero = volatilityData.find(d => d.avgPrice > 0)?.avgPrice ?? 0;
  const volatilityLastNonZero = [...volatilityData].reverse().find(d => d.avgPrice > 0)?.avgPrice ?? 0;
  const volatilityChangePct = volatilityFirstNonZero > 0
    ? Math.round(((volatilityLastNonZero - volatilityFirstNonZero) / volatilityFirstNonZero) * 100)
    : 0;

  // Budget vs actual
  const budgetData = useMemo(() => {
    const groceryMap: Record<string, string> = {};
    groceries.forEach((g: any) => { groceryMap[g.id] = g.name; });

    return itemBudgets.map((b: any) => {
      const name = groceryMap[b.grocery_id] || 'Unknown';
      const actual = itemWiseData.find(d => d.name === name)?.total || 0;
      const budget = Number(b.monthly_budget);
      const pct = budget > 0 ? Math.round((actual / budget) * 100) : 0;
      return { name, budget, actual, pct, over: actual > budget };
    }).sort((a, b) => b.pct - a.pct);
  }, [itemBudgets, groceries, itemWiseData]);

  const overBudgetCount = budgetData.filter(b => b.over).length;
  const underBudgetCount = budgetData.filter(b => !b.over).length;

  // Drill-down expenses for selected item
  const drillExpenses = useMemo(() => {
    if (!drillItem) return [];
    return selectedMonthItems
      .filter((gi: any) => gi.item_name === drillItem)
      .map((gi: any) => {
        const expense = roomExpenses.find((e: any) => e.id === gi.expense_id);
        return {
          date: gi.date,
          qty: Number(gi.quantity),
          unitPrice: Number(gi.unit_price),
          total: Number(gi.quantity) * Number(gi.unit_price),
          paidBy: expense?.paid_by || '',
          description: expense?.description || '',
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [drillItem, selectedMonthItems, roomExpenses]);

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(2000, i).toLocaleString('default', { month: 'long' }),
  }));

  const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i);

  return (
    <div className="space-y-6">
      {/* Month/Year Filter */}
      <div className="flex gap-3 items-center flex-wrap">
        <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(Number(v))}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {months.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
          <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Monthly Grocery Trend */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-primary" />Monthly Grocery Spending Trend</CardTitle></CardHeader>
        <CardContent>
          {monthlyTrend.every(m => m.total === 0) ? (
            <p className="text-sm text-muted-foreground">No grocery data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyTrend}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} />
                <Bar dataKey="total" fill="hsl(145, 55%, 42%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Price Volatility */}
      {allItemNames.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />Price Volatility (Last 6 Months)
              </CardTitle>
              <Select value={effectiveVolatilityItem} onValueChange={setVolatilityItem}>
                <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue placeholder="Pick item" /></SelectTrigger>
                <SelectContent>
                  {allItemNames.map(name => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {volatilityData.every(d => d.avgPrice === 0) ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No price history for "{effectiveVolatilityItem}".</p>
            ) : (
              <div className="space-y-3">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={volatilityData}>
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => `₹${v}/unit`} />
                    <Line type="monotone" dataKey="avgPrice" stroke="hsl(38, 92%, 50%)" strokeWidth={2} dot={{ r: 4 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-3 text-xs">
                  <span className="text-muted-foreground">6mo change:</span>
                  <span className={`flex items-center gap-1 font-bold ${volatilityChangePct > 0 ? 'text-destructive' : volatilityChangePct < 0 ? 'text-[hsl(var(--success))]' : 'text-muted-foreground'}`}>
                    {volatilityChangePct > 0 ? <TrendingUp className="w-3 h-3" /> : volatilityChangePct < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                    {volatilityChangePct > 0 ? '+' : ''}{volatilityChangePct}%
                  </span>
                  <span className="text-muted-foreground">
                    (₹{volatilityFirstNonZero} → ₹{volatilityLastNonZero}/unit)
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Grocery Item Analysis</CardTitle></CardHeader>
        <CardContent>
          {itemWiseData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No itemized grocery data for this month.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 text-muted-foreground">Item</th>
                    <th className="text-right py-2 px-2 text-muted-foreground">This Month</th>
                    <th className="text-right py-2 px-2 text-muted-foreground">Last Month</th>
                    <th className="text-right py-2 px-2 text-muted-foreground">Change</th>
                    <th className="text-right py-2 px-2 text-muted-foreground">Qty</th>
                    <th className="text-right py-2 px-2 text-muted-foreground">Avg ₹/unit</th>
                  </tr>
                </thead>
                <tbody>
                  {itemWiseData.map(d => (
                    <tr
                      key={d.name}
                      className="border-b border-border/50 cursor-pointer hover:bg-muted/50"
                      onClick={() => setDrillItem(drillItem === d.name ? null : d.name)}
                    >
                      <td className="py-2 px-2 text-foreground font-medium">{d.name}</td>
                      <td className="py-2 px-2 text-right text-foreground">₹{d.total.toLocaleString()}</td>
                      <td className="py-2 px-2 text-right text-muted-foreground">₹{d.prevTotal.toLocaleString()}</td>
                      <td className="py-2 px-2 text-right">
                        <span className={`flex items-center justify-end gap-1 ${d.change > 0 ? 'text-destructive' : 'text-[hsl(var(--success))]'}`}>
                          {d.change > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {d.changePct}%
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right text-muted-foreground">{d.qty}</td>
                      <td className="py-2 px-2 text-right text-muted-foreground">₹{Math.round(d.avgPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drill-down */}
      {drillItem && drillExpenses.length > 0 && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>📋 {drillItem} — Expense Details</span>
              <button onClick={() => setDrillItem(null)} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1.5 px-2 text-muted-foreground">Date</th>
                    <th className="text-right py-1.5 px-2 text-muted-foreground">Qty</th>
                    <th className="text-right py-1.5 px-2 text-muted-foreground">₹/unit</th>
                    <th className="text-right py-1.5 px-2 text-muted-foreground">Total</th>
                    <th className="text-left py-1.5 px-2 text-muted-foreground">Paid By</th>
                  </tr>
                </thead>
                <tbody>
                  {drillExpenses.map((d, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-1.5 px-2 text-foreground">{d.date}</td>
                      <td className="py-1.5 px-2 text-right text-foreground">{d.qty}</td>
                      <td className="py-1.5 px-2 text-right text-muted-foreground">₹{d.unitPrice}</td>
                      <td className="py-1.5 px-2 text-right font-medium text-foreground">₹{d.total.toLocaleString()}</td>
                      <td className="py-1.5 px-2 text-muted-foreground">{d.paidBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top 10 Rankings */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">🏆 Top 10 Most Spent Items</CardTitle></CardHeader>
          <CardContent>
            {top10Spent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data.</p>
            ) : (
              <div className="space-y-2">
                {top10Spent.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                      <span className="text-foreground">{d.name}</span>
                    </span>
                    <span className="font-medium text-foreground">₹{d.total.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">📊 Top 10 Most Purchased</CardTitle></CardHeader>
          <CardContent>
            {top10Frequent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data.</p>
            ) : (
              <div className="space-y-2">
                {top10Frequent.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                      <span className="text-foreground">{d.name}</span>
                    </span>
                    <span className="text-muted-foreground">{d.count} times · Qty {d.qty} · Avg ₹{Math.round(d.avgPrice)}/unit</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Budget vs Actual */}
      {budgetData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />Item Budget vs Actual
            </CardTitle>
            <div className="flex gap-2 mt-1">
              <Badge variant="destructive" className="text-xs">{overBudgetCount} Over</Badge>
              <Badge className="text-xs bg-[hsl(var(--success))] text-white">{underBudgetCount} Under</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {budgetData.map(b => (
              <div key={b.name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground font-medium">{b.name}</span>
                  <span className={`text-xs ${b.over ? 'text-destructive' : 'text-[hsl(var(--success))]'}`}>
                    ₹{b.actual.toLocaleString()} / ₹{b.budget.toLocaleString()} ({b.pct}%)
                  </span>
                </div>
                <Progress
                  value={Math.min(b.pct, 100)}
                  className={`h-1.5 ${b.over ? '[&>div]:bg-destructive' : '[&>div]:bg-[hsl(var(--success))]'}`}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GroceryAnalytics;
