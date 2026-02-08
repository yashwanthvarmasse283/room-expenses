import { useAuth } from '@/contexts/AuthContext';
import { storage } from '@/lib/storage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Receipt, PiggyBank, Target, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';

const UserDashboard = () => {
  const { user } = useAuth();
  const roomExpenses = storage.getRoomExpenses();
  const personal = storage.getPersonalExpenses().filter(e => e.userId === user?.id);

  const totalRoom = useMemo(() => roomExpenses.reduce((s, e) => s + e.amount, 0), [roomExpenses]);
  const totalPersonal = useMemo(() => personal.reduce((s, e) => s + e.amount, 0), [personal]);

  const now = new Date();
  const thisMonthPersonal = personal.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const thisTotal = thisMonthPersonal.reduce((s, e) => s + e.amount, 0);

  const stats = [
    { label: 'Room Expenses', value: `₹${totalRoom.toLocaleString()}`, icon: Receipt, color: 'text-primary' },
    { label: 'Personal Total', value: `₹${totalPersonal.toLocaleString()}`, icon: PiggyBank, color: 'text-[hsl(var(--success))]' },
    { label: 'This Month', value: `₹${thisTotal.toLocaleString()}`, icon: TrendingUp, color: 'text-[hsl(var(--warning))]' },
    { label: 'Categories', value: new Set(personal.map(e => e.category)).size, icon: Target, color: 'text-muted-foreground' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Hello, {user?.name}</h1>
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

      <Card>
        <CardHeader><CardTitle className="text-base">Recent Personal Expenses</CardTitle></CardHeader>
        <CardContent>
          {personal.length === 0 ? (
            <p className="text-sm text-muted-foreground">No personal expenses yet. Start tracking in Personal Expenses.</p>
          ) : (
            <div className="space-y-3">
              {personal.slice(-5).reverse().map(e => (
                <div key={e.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-foreground">{e.description || e.category}</p>
                    <p className="text-xs text-muted-foreground">{e.date} · {e.category}</p>
                  </div>
                  <span className="font-semibold text-foreground">₹{e.amount}</span>
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
