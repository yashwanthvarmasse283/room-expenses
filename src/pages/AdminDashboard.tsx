import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Receipt, Users, Wallet, MessageSquare, TrendingUp, TrendingDown, Megaphone } from 'lucide-react';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = [
  'hsl(215, 65%, 52%)', 'hsl(145, 55%, 42%)', 'hsl(38, 92%, 50%)',
  'hsl(0, 65%, 55%)', 'hsl(270, 50%, 55%)', 'hsl(180, 50%, 42%)',
];

const AdminDashboard = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const { data: expenses = [] } = useQuery({
    queryKey: ['room_expenses', profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase.from('room_expenses').select('*').eq('admin_id', profile.id).order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!profile,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['admin_users', profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase.from('profiles').select('*').eq('admin_id', profile.id);
      return data ?? [];
    },
    enabled: !!profile,
  });

  const { data: purse = [] } = useQuery({
    queryKey: ['purse_transactions', profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase.from('purse_transactions').select('*').eq('admin_id', profile.id);
      return data ?? [];
    },
    enabled: !!profile,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['messages_admin', profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase.from('messages').select('*').eq('to_admin_id', profile.id).order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!profile,
  });

  const { data: notices = [] } = useQuery({
    queryKey: ['notices_dashboard', profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase.from('notices').select('*').eq('admin_id', profile.id).order('created_at', { ascending: false }).limit(3);
      return data ?? [];
    },
    enabled: !!profile,
  });

  const pending = users.filter((u: any) => !u.approved);
  const unread = messages.filter((m: any) => !m.read).length;

  const totalExpenses = useMemo(() => expenses.reduce((s: number, e: any) => s + Number(e.amount), 0), [expenses]);
  const purseBalance = useMemo(() => purse.reduce((s: number, t: any) => s + (t.type === 'inflow' ? Number(t.amount) : -Number(t.amount)), 0), [purse]);

  const now = new Date();
  const thisMonth = expenses.filter((e: any) => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const lastMonth = expenses.filter((e: any) => {
    const d = new Date(e.date);
    const lm = new Date(now.getFullYear(), now.getMonth() - 1);
    return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
  });
  const thisTotal = thisMonth.reduce((s: number, e: any) => s + Number(e.amount), 0);
  const lastTotal = lastMonth.reduce((s: number, e: any) => s + Number(e.amount), 0);
  const changePercent = lastTotal ? Math.round(((thisTotal - lastTotal) / lastTotal) * 100) : 0;

  // Category breakdown for this month
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    thisMonth.forEach((e: any) => { map[e.category] = (map[e.category] || 0) + Number(e.amount); });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [thisMonth]);

  // Monthly comparison data (last 2 months)
  const comparisonData = useMemo(() => {
    const thisLabel = now.toLocaleString('default', { month: 'short' });
    const lastLabel = new Date(now.getFullYear(), now.getMonth() - 1).toLocaleString('default', { month: 'short' });
    return [
      { month: lastLabel, total: lastTotal },
      { month: thisLabel, total: thisTotal },
    ];
  }, [thisTotal, lastTotal, now]);

  const stats = [
    { label: 'Total Expenses', value: `₹${totalExpenses.toLocaleString()}`, icon: Receipt, color: 'text-primary' },
    { label: 'This Month', value: `₹${thisTotal.toLocaleString()}`, icon: changePercent >= 0 ? TrendingUp : TrendingDown, color: changePercent >= 0 ? 'text-destructive' : 'text-[hsl(var(--success))]', sub: `${changePercent >= 0 ? '+' : ''}${changePercent}% vs last month` },
    { label: 'Purse Balance', value: `₹${purseBalance.toLocaleString()}`, icon: Wallet, color: 'text-[hsl(var(--success))]' },
    { label: 'Pending Users', value: pending.length, icon: Users, color: 'text-[hsl(var(--warning))]' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Welcome back, {profile?.name}</h1>
        <p className="text-muted-foreground text-sm">Admin ID: <span className="font-mono font-semibold text-primary">{profile?.admin_code}</span></p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{s.value}</div>
              {s.sub && <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Notice Board */}
      {notices.length > 0 && (
        <Card className="border-2 border-primary/40 bg-primary/5 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">📢 Notice Board</CardTitle>
            </div>
            <button onClick={() => navigate('/notice-board')} className="text-xs text-primary hover:underline">View All</button>
          </CardHeader>
          <CardContent className="space-y-3">
            {notices.map((n: any) => (
              <div key={n.id} className="border-l-4 border-primary pl-3">
                <p className="font-semibold text-sm text-foreground">{n.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{n.content}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* This Month vs Last Month + Category Breakdown */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">This Month vs Last Month</CardTitle></CardHeader>
          <CardContent>
            {comparisonData.every(d => d.total === 0) ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={comparisonData}>
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
          <CardHeader><CardTitle className="text-base">Category Breakdown (This Month)</CardTitle></CardHeader>
          <CardContent>
            {categoryData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No expenses this month.</p>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="55%" height={200}>
                  <PieChart>
                    <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
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
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Recent Expenses</CardTitle></CardHeader>
          <CardContent>
            {expenses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No expenses yet.</p>
            ) : (
              <div className="space-y-3">
                {expenses.slice(0, 5).map((e: any) => (
                  <div key={e.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-foreground">{e.description || e.category}</p>
                      <p className="text-xs text-muted-foreground">{e.date} · {e.category}</p>
                    </div>
                    <span className="font-semibold text-foreground">₹{Number(e.amount).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Messages ({unread} unread)</CardTitle></CardHeader>
          <CardContent>
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No messages yet.</p>
            ) : (
              <div className="space-y-3">
                {messages.slice(0, 5).map((m: any) => (
                  <div key={m.id} className="text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{m.from_user_name}</span>
                      {!m.read && <span className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <p className="text-muted-foreground text-xs truncate">{m.content}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
