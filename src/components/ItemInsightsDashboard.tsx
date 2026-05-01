import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line,
  PieChart, Pie, Cell, ReferenceLine,
} from 'recharts';
import {
  Lightbulb, Trophy, Layers, TrendingUp, TrendingDown, AlertTriangle,
  ShoppingBasket, Users, Calendar, Sparkles, Repeat, Package,
} from 'lucide-react';
import {
  enrichItems, computeInsights, type RawExpense, type RawItem,
} from '@/lib/itemAnalytics';

const COLORS = [
  'hsl(215, 65%, 52%)', 'hsl(145, 55%, 42%)', 'hsl(38, 92%, 50%)',
  'hsl(0, 65%, 55%)', 'hsl(270, 50%, 55%)', 'hsl(180, 50%, 42%)',
  'hsl(330, 55%, 50%)', 'hsl(60, 70%, 45%)',
];

const ItemInsightsDashboard = () => {
  const { profile, role } = useAuth();
  const isAdmin = role === 'admin';
  const adminId = isAdmin ? profile?.id : profile?.admin_id;

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month0, setMonth0] = useState(now.getMonth());

  const { data: expenses = [] } = useQuery({
    queryKey: ['ii_expenses', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase
        .from('room_expenses')
        .select('id, date, amount, category, description, paid_by, created_by_name')
        .eq('admin_id', adminId);
      return (data ?? []) as RawExpense[];
    },
    enabled: !!adminId,
  });

  const { data: items = [] } = useQuery({
    queryKey: ['ii_items', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase
        .from('expense_grocery_items')
        .select('id, expense_id, item_name, quantity, unit_price');
      return (data ?? []) as RawItem[];
    },
    enabled: !!adminId,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['ii_members', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase
        .from('profiles')
        .select('name')
        .or(`id.eq.${adminId},admin_id.eq.${adminId}`)
        .eq('approved', true);
      return (data ?? []) as { name: string }[];
    },
    enabled: !!adminId,
  });

  const enriched = useMemo(() => enrichItems(items, expenses), [items, expenses]);
  const ins = useMemo(
    () => computeInsights(enriched, expenses, members, year, month0),
    [enriched, expenses, members, year, month0],
  );

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i, label: new Date(2000, i).toLocaleString('default', { month: 'long' }),
  }));
  const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i);

  const maxDailyTotal = Math.max(...ins.trends.dailyTrend.map(d => d.total), 1);

  return (
    <div className="space-y-6">
      {/* Header + Period filter */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />Item-Level Insights
          </h2>
          <p className="text-xs text-muted-foreground">
            Smart household analytics based on every item you've logged.
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={String(month0)} onValueChange={v => setMonth0(Number(v))}>
            <SelectTrigger className="w-[140px] h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {months.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
            <SelectTrigger className="w-[100px] h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Smart Suggestions */}
      {ins.suggestions.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-primary" />Smart Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {ins.suggestions.map((s, i) => (
                <li
                  key={i}
                  className={`text-sm flex items-start gap-2 p-2 rounded-md ${
                    s.tone === 'warn' ? 'bg-destructive/5 text-foreground' :
                    s.tone === 'good' ? 'bg-[hsl(var(--success))]/5 text-foreground' :
                    'bg-muted/50 text-foreground'
                  }`}
                >
                  <span className="text-base flex-shrink-0">{s.icon}</span>
                  <span>{s.text}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Monthly Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />Monthly Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Stat label="Total Spend" value={`₹${ins.basic.totalSpend.toLocaleString()}`} />
            <Stat label="Items Bought" value={String(ins.basic.totalItems)} />
            <Stat label="Unique Items" value={String(ins.basic.totalUniqueItems)} />
            <Stat label="Daily Avg" value={`₹${ins.basic.avgDailySpend.toLocaleString()}`} />
            <Stat label="Avg ₹/item" value={`₹${ins.basic.avgCostPerItem.toLocaleString()}`} />
          </div>

          {ins.basic.totalSpend > 0 ? (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Daily spending</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={ins.trends.dailyTrend}>
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} />
                  <ReferenceLine
                    y={ins.basic.avgDailySpend}
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="3 3"
                    label={{ value: 'Avg', position: 'insideTopRight', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  {ins.trends.dailyTrend.map((d, i) => null /* coloring done via Cell */).filter(Boolean)}
                  <Bar dataKey="total" radius={[3, 3, 0, 0]}>
                    {ins.trends.dailyTrend.map((d, i) => {
                      const isSpike = ins.trends.spendingSpikes.some(s => s.day === d.day);
                      return <Cell key={i} fill={isSpike ? 'hsl(0, 65%, 55%)' : 'hsl(215, 65%, 52%)'} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {ins.trends.spendingSpikes.length > 0 && (
                <p className="text-[10px] text-muted-foreground text-center mt-1">
                  Red bars = abnormal spending days
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">No spending recorded for this month.</p>
          )}
        </CardContent>
      </Card>

      {/* Term Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />Term Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {ins.terms.map(t => {
              const isTopSpend = t.term === ins.mostExpensiveTerm.term && t.spend > 0;
              const isTopActive = t.term === ins.mostActiveTerm.term && t.itemCount > 0;
              return (
                <div
                  key={t.term}
                  className={`p-3 rounded-lg border ${isTopSpend ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-muted/30'}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">{t.label}</p>
                    {isTopSpend && <Badge variant="destructive" className="text-[10px]">Highest</Badge>}
                  </div>
                  <p className="text-xl font-bold text-foreground mt-1">₹{t.spend.toLocaleString()}</p>
                  <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                    <p>{t.itemCount} items {isTopActive && <span className="text-primary">· most active</span>}</p>
                    <p>Top: <span className="text-foreground font-medium">{t.topItem || '—'}</span></p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Item Insights */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[hsl(38,92%,50%)]" />Top 5 Items by Spend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ins.items.sortedBySpend.length === 0 ? (
              <p className="text-sm text-muted-foreground">No items logged yet.</p>
            ) : (
              <div className="space-y-2">
                {ins.items.sortedBySpend.slice(0, 5).map((it, i) => (
                  <div key={it.name} className="flex items-center gap-2 text-sm">
                    <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                    <span className="text-foreground flex-1 truncate">{it.name}</span>
                    <span className="text-muted-foreground text-xs">×{it.count}</span>
                    <span className="font-bold text-foreground">₹{it.spend.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Repeat className="w-4 h-4 text-primary" />Item Frequency
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ins.items.sortedByCount.length === 0 ? (
              <p className="text-sm text-muted-foreground">No items logged yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={ins.items.sortedByCount.slice(0, 8)} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(145, 55%, 42%)" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Notable items grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <NotableItem
          label="Most Purchased"
          name={ins.basic.mostPurchased?.name}
          sub={ins.basic.mostPurchased ? `${ins.basic.mostPurchased.count}× this month` : ''}
        />
        <NotableItem
          label="Least Purchased"
          name={ins.basic.leastPurchased?.name}
          sub={ins.basic.leastPurchased ? `${ins.basic.leastPurchased.count}× this month` : ''}
        />
        <NotableItem
          label="Most Expensive"
          name={ins.basic.mostExpensiveItem?.name}
          sub={ins.basic.mostExpensiveItem ? `₹${ins.basic.mostExpensiveItem.maxPrice}/unit` : ''}
        />
        <NotableItem
          label="Cheapest"
          name={ins.basic.cheapestItem?.name}
          sub={ins.basic.cheapestItem ? `₹${ins.basic.cheapestItem.minPrice}/unit` : ''}
        />
      </div>

      {/* Cost distribution + Category */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />Cost Distribution (Top Items)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ins.items.sortedBySpend.length === 0 ? (
              <p className="text-sm text-muted-foreground">No items.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={ins.items.sortedBySpend.slice(0, 8)}
                    dataKey="spend"
                    nameKey="name"
                    cx="50%" cy="50%" outerRadius={80} innerRadius={45}
                  >
                    {ins.items.sortedBySpend.slice(0, 8).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingBasket className="w-4 h-4 text-primary" />Category Spending
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ins.intelligence.categorySpend.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data.</p>
            ) : (
              <div className="space-y-2">
                {ins.intelligence.categorySpend.map((c, i) => {
                  const pct = ins.basic.totalSpend > 0
                    ? Math.round((c.value / ins.basic.totalSpend) * 100) : 0;
                  return (
                    <div key={c.name} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-foreground font-medium flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                          {c.name}
                        </span>
                        <span className="text-muted-foreground">₹{c.value.toLocaleString()} · {pct}%</span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                  );
                })}
                {ins.basic.totalSpend > 0 && (
                  <div className="pt-2 mt-2 border-t border-border text-xs text-muted-foreground flex justify-between">
                    <span>Essentials vs non-essentials</span>
                    <span className="font-medium text-foreground">
                      {ins.intelligence.essentialRatio}% / {100 - ins.intelligence.essentialRatio}%
                    </span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Member Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />Member Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {ins.behavior.memberLeaderboard.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-2 text-muted-foreground">#</th>
                      <th className="text-left py-2 px-2 text-muted-foreground">Member</th>
                      <th className="text-right py-2 px-2 text-muted-foreground">Spend</th>
                      <th className="text-right py-2 px-2 text-muted-foreground">Items</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ins.behavior.memberLeaderboard.map((m, i) => (
                      <tr key={m.name} className="border-b border-border/50">
                        <td className="py-2 px-2 text-muted-foreground">{i + 1}</td>
                        <td className="py-2 px-2 text-foreground font-medium">
                          {m.name}
                          {m.name === ins.behavior.highestSpendingUser?.name && m.spend > 0 && (
                            <Badge variant="secondary" className="ml-2 text-[10px]">Top spender</Badge>
                          )}
                          {m.name === ins.behavior.mostActiveContributor?.name && m.itemCount > 0 && (
                            <Badge variant="outline" className="ml-2 text-[10px]">Most active</Badge>
                          )}
                        </td>
                        <td className="py-2 px-2 text-right font-bold text-foreground">₹{m.spend.toLocaleString()}</td>
                        <td className="py-2 px-2 text-right text-muted-foreground">{m.itemCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {ins.basic.totalSpend > 0 && members.length > 1 && (
                <div className="flex items-center justify-between p-2 rounded-md bg-muted/40">
                  <span className="text-xs text-muted-foreground">Contribution fairness</span>
                  <span className={`text-sm font-bold ${
                    ins.behavior.fairnessScore >= 75 ? 'text-[hsl(var(--success))]' :
                    ins.behavior.fairnessScore >= 50 ? 'text-[hsl(38,92%,50%)]' : 'text-destructive'
                  }`}>
                    {ins.behavior.fairnessScore}/100
                  </span>
                </div>
              )}
              {ins.behavior.commonCombinations.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Frequently bought together</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ins.behavior.commonCombinations.map(c => (
                      <Badge key={c.pair} variant="outline" className="text-xs">
                        {c.pair} <span className="ml-1 text-muted-foreground">×{c.count}</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Trends Section */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />6-Month Spend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={ins.trends.monthlyTotals}>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} />
                <Line type="monotone" dataKey="total" stroke="hsl(215, 65%, 52%)" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
            <div className="text-center text-xs mt-2">
              <span className="text-muted-foreground">Month-over-month: </span>
              <span className={`font-bold ${
                ins.trends.monthOverMonthGrowth > 0 ? 'text-destructive' :
                ins.trends.monthOverMonthGrowth < 0 ? 'text-[hsl(var(--success))]' : 'text-muted-foreground'
              }`}>
                {ins.trends.monthOverMonthGrowth > 0 ? '+' : ''}{ins.trends.monthOverMonthGrowth}%
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[hsl(38,92%,50%)]" />Price Movement
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ins.trends.priceChanges.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No notable price changes.</p>
            ) : (
              <div className="space-y-2">
                {ins.trends.priceChanges.slice(0, 6).map(p => (
                  <div key={p.name} className="flex items-center justify-between text-sm">
                    <span className="text-foreground truncate">{p.name}</span>
                    <span className={`flex items-center gap-1 text-xs font-medium ${
                      p.changePct > 0 ? 'text-destructive' : 'text-[hsl(var(--success))]'
                    }`}>
                      {p.changePct > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      ₹{p.oldAvg} → ₹{p.newAvg} ({p.changePct > 0 ? '+' : ''}{p.changePct}%)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Item Intelligence */}
      {(ins.intelligence.bulkItems.length > 0 || ins.intelligence.frequentItems.length > 0 || ins.intelligence.oneTimeItems.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />Item Intelligence
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {ins.intelligence.bulkItems.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">📦 Bulk purchases</p>
                <div className="flex flex-wrap gap-1.5">
                  {ins.intelligence.bulkItems.map(b => (
                    <Badge key={b.name} variant="secondary" className="text-xs">
                      {b.name} <span className="ml-1 text-muted-foreground">qty {b.qty}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {ins.intelligence.frequentItems.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">🔁 Frequent purchases</p>
                <div className="flex flex-wrap gap-1.5">
                  {ins.intelligence.frequentItems.map(b => (
                    <Badge key={b.name} variant="secondary" className="text-xs">
                      {b.name} <span className="ml-1 text-muted-foreground">×{b.count}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {ins.intelligence.oneTimeItems.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">⚠️ One-time / possible waste</p>
                <div className="flex flex-wrap gap-1.5">
                  {ins.intelligence.oneTimeItems.map(b => (
                    <Badge key={b.name} variant="outline" className="text-xs">
                      {b.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="p-3 rounded-lg bg-muted/40">
    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="text-lg font-bold text-foreground">{value}</p>
  </div>
);

const NotableItem = ({ label, name, sub }: { label: string; name?: string; sub?: string }) => (
  <Card>
    <CardContent className="p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-base font-bold text-foreground truncate">{name || '—'}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </CardContent>
  </Card>
);

export default ItemInsightsDashboard;
