import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, CheckCircle2, HandCoins } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const Settlements = () => {
  const { profile, role, isViewOnly } = useAuth();
  const isAdmin = role === 'admin';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const adminId = isAdmin ? profile?.id : profile?.admin_id;

  const { data: expenses = [] } = useQuery({
    queryKey: ['room_expenses_settle', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase.from('room_expenses').select('*').eq('admin_id', adminId);
      return data ?? [];
    },
    enabled: !!adminId,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['room_members_settle', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase.from('profiles').select('id, user_id, name').or(`id.eq.${adminId},admin_id.eq.${adminId}`).eq('approved', true);
      return data ?? [];
    },
    enabled: !!adminId,
  });

  const { data: virtualMembers = [] } = useQuery({
    queryKey: ['virtual_roommates_settle', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase.from('virtual_roommates').select('*').eq('admin_id', adminId);
      return data ?? [];
    },
    enabled: !!adminId,
  });

  const { data: settlements = [] } = useQuery({
    queryKey: ['settlements', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase.from('settlements').select('*').eq('admin_id', adminId).order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!adminId,
  });

  useEffect(() => {
    if (!adminId) return;
    const channel = supabase
      .channel('settlements-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settlements', filter: `admin_id=eq.${adminId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['settlements', adminId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [adminId, queryClient]);

  const allMemberNames = useMemo(() => {
    const real = members.map((m: any) => m.name);
    const virtual = virtualMembers.map((v: any) => v.name);
    return [...real, ...virtual];
  }, [members, virtualMembers]);

  // Calculate who owes whom from expense splits
  const netBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    allMemberNames.forEach(name => { balances[name] = 0; });

    expenses.forEach((e: any) => {
      const paidBy = e.paid_by || 'Unknown';
      const splitAmong = e.split_among && e.split_among.length > 0 ? e.split_among : allMemberNames;
      const share = Number(e.amount) / splitAmong.length;

      // Person who paid gets credit
      if (balances[paidBy] !== undefined) {
        balances[paidBy] += Number(e.amount);
      }
      // Each person in split owes their share
      splitAmong.forEach((name: string) => {
        if (balances[name] !== undefined) {
          balances[name] -= share;
        }
      });
    });

    return balances;
  }, [expenses, allMemberNames]);

  // Calculate settlements (simplified: who owes whom)
  const pendingSettlements = useMemo(() => {
    const debtors: { name: string; amount: number }[] = [];
    const creditors: { name: string; amount: number }[] = [];

    Object.entries(netBalances).forEach(([name, balance]) => {
      if (balance < -1) debtors.push({ name, amount: -balance });
      else if (balance > 1) creditors.push({ name, amount: balance });
    });

    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const result: { from: string; to: string; amount: number }[] = [];
    let di = 0, ci = 0;
    const dAmts = debtors.map(d => d.amount);
    const cAmts = creditors.map(c => c.amount);

    while (di < debtors.length && ci < creditors.length) {
      const amt = Math.min(dAmts[di], cAmts[ci]);
      if (amt > 1) {
        result.push({ from: debtors[di].name, to: creditors[ci].name, amount: Math.round(amt) });
      }
      dAmts[di] -= amt;
      cAmts[ci] -= amt;
      if (dAmts[di] < 1) di++;
      if (cAmts[ci] < 1) ci++;
    }

    return result;
  }, [netBalances]);

  const settleUp = async (from: string, to: string, amount: number) => {
    if (!adminId || isViewOnly) return;
    const { error } = await supabase.from('settlements').insert({
      admin_id: adminId, from_user: from, to_user: to, amount, settled: true, settled_at: new Date().toISOString(),
    });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    queryClient.invalidateQueries({ queryKey: ['settlements'] });
    toast({ title: 'Settled!', description: `${from} → ${to}: ₹${amount}` });
  };

  const recentSettlements = settlements.filter((s: any) => s.settled).slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settlements</h1>
        <p className="text-sm text-muted-foreground">See who owes whom and settle up.</p>
      </div>

      {/* Net Balances */}
      <Card>
        <CardHeader><CardTitle className="text-base">Net Balances</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.entries(netBalances).filter(([_, b]) => Math.abs(b) > 1).map(([name, balance]) => (
              <div key={name} className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-sm font-medium text-foreground">{name}</p>
                <p className={`text-lg font-bold ${balance > 0 ? 'text-[hsl(var(--success))]' : 'text-destructive'}`}>
                  {balance > 0 ? '+' : ''}₹{Math.round(balance).toLocaleString()}
                </p>
                <p className="text-[10px] text-muted-foreground">{balance > 0 ? 'to receive' : 'to pay'}</p>
              </div>
            ))}
          </div>
          {Object.values(netBalances).every(b => Math.abs(b) <= 1) && (
            <p className="text-sm text-muted-foreground text-center py-4">All settled! No outstanding balances.</p>
          )}
        </CardContent>
      </Card>

      {/* Pending Settlements */}
      {pendingSettlements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <HandCoins className="w-4 h-4 text-primary" />Who Owes Whom
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingSettlements.map((s, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-foreground">{s.from}</span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">{s.to}</span>
                  <span className="font-bold text-destructive">₹{s.amount.toLocaleString()}</span>
                </div>
                {!isViewOnly && (
                  <Button size="sm" variant="outline" onClick={() => settleUp(s.from, s.to, s.amount)}>
                    <CheckCircle2 className="w-3 h-3 mr-1" />Settle Up
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Settlement History */}
      {recentSettlements.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Recent Settlements</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {recentSettlements.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between text-sm py-2 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[hsl(var(--success))]" />
                  <span className="text-foreground">{s.from_user}</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                  <span className="text-foreground">{s.to_user}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground">₹{Number(s.amount).toLocaleString()}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {new Date(s.settled_at).toLocaleDateString()}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Settlements;
