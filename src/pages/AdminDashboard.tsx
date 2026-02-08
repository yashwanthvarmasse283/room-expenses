import { useAuth } from '@/contexts/AuthContext';
import { storage } from '@/lib/storage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Receipt, Users, Wallet, MessageSquare, TrendingUp, TrendingDown } from 'lucide-react';
import { useMemo } from 'react';

const AdminDashboard = () => {
  const { user } = useAuth();
  const expenses = storage.getRoomExpenses();
  const users = storage.getUsers().filter(u => u.role === 'user' && u.adminId === user?.id);
  const pending = users.filter(u => !u.approved);
  const purse = storage.getPurseTransactions();
  const messages = storage.getMessages().filter(m => m.toAdminId === user?.id);
  const unread = messages.filter(m => !m.read).length;

  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);
  const purseBalance = useMemo(() => purse.reduce((s, t) => s + (t.type === 'inflow' ? t.amount : -t.amount), 0), [purse]);

  const now = new Date();
  const thisMonth = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const lastMonth = expenses.filter(e => {
    const d = new Date(e.date);
    const lm = new Date(now.getFullYear(), now.getMonth() - 1);
    return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
  });
  const thisTotal = thisMonth.reduce((s, e) => s + e.amount, 0);
  const lastTotal = lastMonth.reduce((s, e) => s + e.amount, 0);
  const changePercent = lastTotal ? Math.round(((thisTotal - lastTotal) / lastTotal) * 100) : 0;

  const stats = [
    { label: 'Total Expenses', value: `₹${totalExpenses.toLocaleString()}`, icon: Receipt, color: 'text-primary' },
    { label: 'This Month', value: `₹${thisTotal.toLocaleString()}`, icon: changePercent >= 0 ? TrendingUp : TrendingDown, color: changePercent >= 0 ? 'text-destructive' : 'text-[hsl(var(--success))]', sub: `${changePercent >= 0 ? '+' : ''}${changePercent}% vs last month` },
    { label: 'Purse Balance', value: `₹${purseBalance.toLocaleString()}`, icon: Wallet, color: 'text-[hsl(var(--success))]' },
    { label: 'Pending Users', value: pending.length, icon: Users, color: 'text-[hsl(var(--warning))]' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Welcome back, {user?.name}</h1>
        <p className="text-muted-foreground text-sm">Admin ID: <span className="font-mono font-semibold text-primary">{user?.id}</span></p>
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

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Recent Expenses</CardTitle></CardHeader>
          <CardContent>
            {expenses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No expenses yet.</p>
            ) : (
              <div className="space-y-3">
                {expenses.slice(-5).reverse().map(e => (
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

        <Card>
          <CardHeader><CardTitle className="text-base">Messages ({unread} unread)</CardTitle></CardHeader>
          <CardContent>
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No messages yet.</p>
            ) : (
              <div className="space-y-3">
                {messages.slice(-5).reverse().map(m => (
                  <div key={m.id} className="text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{m.fromUserName}</span>
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
