import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Receipt, PiggyBank, TrendingUp, Wallet, Megaphone } from 'lucide-react';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';


const UserDashboard = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const adminId = profile?.admin_id ?? profile?.id;
  const { data: roomExpenses = [] } = useQuery({
    queryKey: ['room_expenses_user', profile?.admin_id],
    queryFn: async () => {
      if (!profile?.admin_id) return [];
      const { data } = await supabase.from('room_expenses').select('*').eq('admin_id', profile.admin_id);
      return data ?? [];
    },
    enabled: !!profile?.admin_id,
  });

  const { data: personal = [] } = useQuery({
    queryKey: ['personal_expenses', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from('personal_expenses').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });
  const { data: purse = [] } = useQuery({
  queryKey: ['purse_transactions_user', profile?.admin_id],
  queryFn: async () => {
    if (!profile?.admin_id) return [];
    const { data } = await supabase
      .from('purse_transactions')
      .select('*')
      .eq('admin_id', profile.admin_id);
    return data ?? [];
  },
  enabled: !!profile?.admin_id,
});

  const { data: notices = [] } = useQuery({
    queryKey: ['notices_dashboard', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase.from('notices').select('*').eq('admin_id', adminId).order('created_at', { ascending: false }).limit(3);
      return data ?? [];
    },
    enabled: !!adminId,
  });

  const totalRoom = useMemo(() => roomExpenses.reduce((s: number, e: any) => s + Number(e.amount), 0), [roomExpenses]);
  const totalPersonal = useMemo(() => personal.reduce((s: number, e: any) => s + Number(e.amount), 0), [personal]);

  const now = new Date();
  const thisMonthPersonal = personal.filter((e: any) => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const thisTotal = thisMonthPersonal.reduce((s: number, e: any) => s + Number(e.amount), 0);
  const purseBalance = useMemo(
    () =>
      purse.reduce(
        (s: number, t: any) =>
          s + (t.type === 'inflow' ? Number(t.amount) : -Number(t.amount)),
        0
      ),
    [purse]
  );

  const stats = [
    { label: 'Room Expenses', value: `₹${totalRoom.toLocaleString()}`, icon: Receipt, color: 'text-primary' },
    { label: 'Personal Total', value: `₹${totalPersonal.toLocaleString()}`, icon: PiggyBank, color: 'text-[hsl(var(--success))]' },
    { label: 'This Month', value: `₹${thisTotal.toLocaleString()}`, icon: TrendingUp, color: 'text-[hsl(var(--warning))]' },
    { label: 'Purse Balance', value: `₹${purseBalance.toLocaleString()}`, icon: Wallet, color: 'text-[hsl(var(--success))]' },
  ];

  


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Hello, {profile?.name}</h1>
        <p className="text-sm text-muted-foreground">Your expense overview</p>
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
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Prominent Notice Board */}
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

      <Card>
        <CardHeader><CardTitle className="text-base">Recent Personal Expenses</CardTitle></CardHeader>
        <CardContent>
          {personal.length === 0 ? (
            <p className="text-sm text-muted-foreground">No personal expenses yet. Start tracking in Personal Expenses.</p>
          ) : (
            <div className="space-y-3">
              {personal.slice(0, 5).map((e: any) => (
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
    </div>
  );
};

export default UserDashboard;
