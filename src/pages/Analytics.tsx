import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const COLORS = [
  'hsl(215, 65%, 52%)', 'hsl(145, 55%, 42%)', 'hsl(38, 92%, 50%)',
  'hsl(0, 65%, 55%)', 'hsl(270, 50%, 55%)', 'hsl(180, 50%, 42%)',
];

const Analytics = () => {
  const { user, role, profile } = useAuth();
  const isAdmin = role === 'admin';
  const queryClient = useQueryClient();
  const adminId = isAdmin ? profile?.id : profile?.admin_id;

  // Room expenses for both roles
  const { data: roomExpenses = [] } = useQuery({
    queryKey: ['analytics_room', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase.from('room_expenses').select('*').eq('admin_id', adminId);
      return data ?? [];
    },
    enabled: !!adminId,
  });

  // Personal expenses (user only)
  const { data: personalExpenses = [] } = useQuery({
    queryKey: ['analytics_personal', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from('personal_expenses').select('*').eq('user_id', user.id);
      return data ?? [];
    },
    enabled: !!user && !isAdmin,
  });

  // Purse for both roles
  const { data: purse = [] } = useQuery({
    queryKey: ['analytics_purse', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase.from('purse_transactions').select('*').eq('admin_id', adminId);
      return data ?? [];
    },
    enabled: !!adminId,
  });

  // Real-time
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

  const expenses = roomExpenses;

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Analytics</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Expenses</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-foreground">₹{expenses.reduce((s: number, e: any) => s + Number(e.amount), 0).toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Purse Balance</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-[hsl(var(--success))]">₹{purseBalance.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Inflow / Outflow</CardTitle></CardHeader>
          <CardContent><div className="text-sm font-medium"><span className="text-[hsl(var(--success))]">₹{totalInflow.toLocaleString()}</span> / <span className="text-destructive">₹{totalOutflow.toLocaleString()}</span></div></CardContent>
        </Card>
      </div>

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
