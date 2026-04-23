import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CheckCircle2, Clock, History, CalendarDays, CreditCard, Copy, Users, Wallet } from 'lucide-react';
import BulkMarkPaid from '@/components/BulkMarkPaid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getUpiVpa } from '@/lib/upiHelper';
import UpiPaymentSelector from '@/components/UpiPaymentSelector';

const TERM_LABELS: Record<number, string> = { 1: '1st – 10th', 2: '11th – 20th', 3: '21st – 30th' };

const getCurrentTerm = () => {
  const day = new Date().getDate();
  if (day <= 10) return 1;
  if (day <= 20) return 2;
  return 3;
};

const Contributions = () => {
  const { user, profile, role, isViewOnly } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isAdmin = role === 'admin';
  const adminId = isAdmin ? profile?.id : profile?.admin_id;

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [showHistory, setShowHistory] = useState(false);
  const currentTerm = getCurrentTerm();
  const [pendingPayment, setPendingPayment] = useState<{ memberId: string; memberName: string; term: number } | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [upiSelectorOpen, setUpiSelectorOpen] = useState(false);
  const [partialOpen, setPartialOpen] = useState(false);
  const [partialFor, setPartialFor] = useState<{ memberId: string; memberName: string; term: number; alreadyPaid: number; expected: number } | null>(null);
  const [partialAmount, setPartialAmount] = useState('');
  // Track in-flight mutations to prevent double clicks
  const processingRef = useRef<Set<string>>(new Set());

  const { data: adminProfile } = useQuery({
    queryKey: ['admin_profile_contrib', adminId],
    queryFn: async () => {
      if (!adminId) return null;
      const { data } = await supabase.from('profiles').select('admin_contributions_enabled').eq('id', adminId).single();
      return data;
    },
    enabled: !!adminId,
  });
  const adminContribEnabled = (adminProfile as any)?.admin_contributions_enabled ?? true;

  const { data: members = [] } = useQuery({
    queryKey: ['room_members_contrib', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase
        .from('profiles')
        .select('id, user_id, name')
        .or(`id.eq.${adminId},admin_id.eq.${adminId}`)
        .eq('approved', true);
      return data ?? [];
    },
    enabled: !!adminId,
  });

  const { data: virtualMembers = [] } = useQuery({
    queryKey: ['virtual_roommates_contrib', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase.from('virtual_roommates').select('*').eq('admin_id', adminId);
      return data ?? [];
    },
    enabled: !!adminId,
  });

  const { data: contributions = [] } = useQuery({
    queryKey: ['contributions', adminId, year, month],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase
        .from('monthly_contributions')
        .select('*')
        .eq('admin_id', adminId)
        .eq('year', year)
        .eq('month', month);
      return data ?? [];
    },
    enabled: !!adminId,
  });

  const { data: contribLimits = [] } = useQuery({
    queryKey: ['contribution_limits', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase.from('contribution_limits').select('*').eq('admin_id', adminId);
      return data ?? [];
    },
    enabled: !!adminId,
  });

  const getLimit = (userId: string, term: number) => {
    const limit = contribLimits.find((l: any) => l.user_id === userId && l.term === term);
    return limit ? Number(limit.amount) : 500;
  };

  useEffect(() => {
    if (!adminId) return;
    const channel = supabase
      .channel('contributions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_contributions', filter: `admin_id=eq.${adminId}` },
        () => {
          qc.invalidateQueries({ queryKey: ['contributions', adminId, year, month] });
          qc.invalidateQueries({ queryKey: ['purse_transactions'] });
          qc.invalidateQueries({ queryKey: ['personal_wallet'] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [adminId, year, month, qc]);

  // Records a payment of `addAmount` toward (memberId, term).
  // If addAmount is omitted → marks fully paid (amount_paid = expected).
  // The DB trigger credits the wallet/purse only by the DELTA, so partial
  // top-ups never double-count.
  const recordPayment = async (
    memberId: string,
    memberName: string,
    term: number,
    addAmount?: number, // undefined => mark fully paid
  ) => {
    if (!adminId) return;
    const key = `${memberId}-${term}-${month}-${year}`;
    if (processingRef.current.has(key)) return;
    processingRef.current.add(key);

    try {
      const expected = getLimit(memberId, term);

      const { data: existing } = await supabase.from('monthly_contributions')
        .select('id, amount_paid, expected_amount, paid')
        .eq('admin_id', adminId).eq('user_id', memberId)
        .eq('year', year).eq('month', month).eq('term', term)
        .maybeSingle();

      const currentPaid = Number(existing?.amount_paid ?? 0);
      const newPaid = addAmount === undefined
        ? expected                        // full payment
        : currentPaid + addAmount;        // partial top-up
      const fullyPaid = newPaid >= expected;

      if (existing) {
        // Idempotency: skip if no change
        if (currentPaid >= newPaid) return;
        const { error } = await supabase.from('monthly_contributions')
          .update({
            amount_paid: newPaid,
            expected_amount: expected,
            paid: fullyPaid,
            paid_at: fullyPaid ? new Date().toISOString() : null,
            marked_by: user!.id,
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('monthly_contributions')
          .insert({
            admin_id: adminId,
            user_id: memberId,
            user_name: memberName,
            year, month, term,
            amount_paid: newPaid,
            expected_amount: expected,
            paid: fullyPaid,
            paid_at: fullyPaid ? new Date().toISOString() : null,
            marked_by: user!.id,
          });
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ['contributions'] });
      qc.invalidateQueries({ queryKey: ['purse_transactions'] });
      qc.invalidateQueries({ queryKey: ['personal_wallet'] });
    } finally {
      processingRef.current.delete(key);
    }
  };

  // Backwards-compatible name used elsewhere
  const silentMarkPaid = (memberId: string, memberName: string, term: number) =>
    recordPayment(memberId, memberName, term);

  const handlePayNow = (memberId: string, memberName: string, term: number) => {
    setPendingPayment({ memberId, memberName, term });
    setUpiSelectorOpen(true);
  };

  const openPartialDialog = (memberId: string, memberName: string, term: number) => {
    const expected = getLimit(memberId, term);
    const record = getStatus(memberId, term);
    const alreadyPaid = Number(record?.amount_paid ?? 0);
    setPartialFor({ memberId, memberName, term, alreadyPaid, expected });
    setPartialAmount('');
    setPartialOpen(true);
  };

  const submitPartial = useMutation({
    mutationFn: async () => {
      if (!partialFor) throw new Error('No partial selected');
      const amt = Number(partialAmount);
      if (!amt || amt <= 0) throw new Error('Enter a valid amount');
      const remaining = partialFor.expected - partialFor.alreadyPaid;
      if (amt > remaining) throw new Error(`Amount exceeds remaining ₹${remaining}`);
      await recordPayment(partialFor.memberId, partialFor.memberName, partialFor.term, amt);
    },
    onSuccess: () => {
      toast({ title: 'Partial payment recorded', description: 'Purse credited.' });
      setPartialOpen(false);
      setPartialFor(null);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const confirmPayment = useMutation({
    mutationFn: async () => {
      if (!pendingPayment) throw new Error('No pending payment');
      await silentMarkPaid(pendingPayment.memberId, pendingPayment.memberName, pendingPayment.term);
    },
    onSuccess: () => { toast({ title: 'Payment confirmed & marked as paid!' }); setPendingPayment(null); setShowFallback(false); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const markPaid = useMutation({
    mutationFn: async ({ memberId, memberName, term }: { memberId: string; memberName: string; term: number }) => {
      await silentMarkPaid(memberId, memberName, term);
    },
    onSuccess: () => toast({ title: 'Marked as paid!' }),
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const markUnpaid = useMutation({
    mutationFn: async ({ memberId, term }: { memberId: string; term: number }) => {
      const { error } = await supabase.from('monthly_contributions').delete().eq('admin_id', adminId!).eq('user_id', memberId).eq('year', year).eq('month', month).eq('term', term);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contributions'] }); toast({ title: 'Marked as unpaid' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const getStatus = (memberId: string, term: number) => contributions.find((c: any) => c.user_id === memberId && c.term === term);
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: new Date(2000, i).toLocaleString('default', { month: 'long' }) })), []);
  const yearOptions = useMemo(() => { const y = now.getFullYear(); return [y - 1, y, y + 1].map(v => ({ value: String(v), label: String(v) })); }, []);

  const copyVpa = () => {
    navigator.clipboard.writeText(getUpiVpa());
    toast({ title: 'VPA Copied', description: getUpiVpa() });
  };

  // Combine real + virtual members for display
  const allDisplayMembers = useMemo(() => {
    const real = members.map((m: any) => ({ id: m.user_id, name: m.name, profileId: m.id, isVirtual: false }));
    const virtual = virtualMembers.map((v: any) => ({ id: v.id, name: v.name, profileId: null, isVirtual: true }));
    return [...real, ...virtual];
  }, [members, virtualMembers]);

  // Admin overview data
  const overviewData = useMemo(() => {
    return allDisplayMembers.map((m: any) => {
      const termStatuses = [1, 2, 3].map(term => {
        const record = getStatus(m.id, term);
        const limit = getLimit(m.id, term);
        const paidAmount = Number(record?.amount_paid ?? (record?.paid ? limit : 0));
        return {
          term,
          paid: record?.paid === true,
          partial: paidAmount > 0 && paidAmount < limit,
          paidAt: record?.paid_at,
          amount: paidAmount,
          remaining: Math.max(0, limit - paidAmount),
          limit,
        };
      });
      return { ...m, termStatuses };
    });
  }, [allDisplayMembers, contributions, contribLimits]);

  const TermCards = () => (
    <div className="grid gap-4">
      {[1, 2, 3].map(term => (
        <Card key={term} className={isCurrentMonth && term === currentTerm ? 'border-2 border-primary/50' : ''}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-primary" />Term {term}: {TERM_LABELS[term]}
              </CardTitle>
              <div className="flex items-center gap-2">
                {isCurrentMonth && term === currentTerm && <Badge variant="default" className="text-xs">Current</Badge>}
                {isAdmin && !isViewOnly && adminId && (
                  <BulkMarkPaid
                    adminId={adminId}
                    year={year}
                    month={month}
                    term={term}
                    members={allDisplayMembers.map(m => ({ id: m.id, name: m.name }))}
                    contributions={contributions}
                  />
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {allDisplayMembers.map((m: any) => {
                const record = getStatus(m.id, term);
                const isPaid = record?.paid === true;
                const isSelf = m.id === user?.id;
                const isAdminMember = m.profileId === adminId;
                const canMark = (isAdmin || isSelf) && !isViewOnly;
                const hideContribButton = isAdmin && isAdminMember && !adminContribEnabled;
                const limit = getLimit(m.id, term);
                const paidAmount = Number(record?.amount_paid ?? (isPaid ? limit : 0));
                const remaining = Math.max(0, limit - paidAmount);
                const isPartial = paidAmount > 0 && paidAmount < limit;
                const pct = limit > 0 ? Math.min(100, Math.round((paidAmount / limit) * 100)) : 0;
                const isProcessing = markPaid.isPending || confirmPayment.isPending || submitPartial.isPending;

                return (
                  <div key={m.id} className="py-2 px-3 rounded-lg bg-muted/50 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {isPaid ? <CheckCircle2 className="w-4 h-4 text-[hsl(var(--success))] flex-shrink-0" /> : <Clock className="w-4 h-4 text-[hsl(var(--warning))] flex-shrink-0" />}
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-foreground">{m.name}</span>
                          {m.isVirtual && <span className="text-[10px] text-muted-foreground ml-1">(Virtual)</span>}
                          {isPartial ? (
                            <p className="text-[10px] text-[hsl(var(--warning))] font-medium">₹{remaining} remaining of ₹{limit}</p>
                          ) : (
                            <p className="text-[10px] text-muted-foreground">Limit: ₹{limit}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap justify-end">
                        {isPaid ? (
                          <>
                            <Badge variant="secondary" className="text-xs bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]">₹{limit} Paid</Badge>
                            {isAdmin && !isViewOnly && (
                              <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => markUnpaid.mutate({ memberId: m.id, term })} disabled={markUnpaid.isPending}>Undo</Button>
                            )}
                          </>
                        ) : (
                          canMark && !hideContribButton && (
                            <>
                              {isPartial && <Badge variant="outline" className="text-[10px] border-[hsl(var(--warning))] text-[hsl(var(--warning))]">₹{paidAmount} paid</Badge>}
                              {isSelf && !m.isVirtual && (
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handlePayNow(m.id, m.name, term)} disabled={isProcessing}>
                                  <CreditCard className="w-3 h-3 mr-1" />Pay
                                </Button>
                              )}
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openPartialDialog(m.id, m.name, term)} disabled={isProcessing}>
                                <Wallet className="w-3 h-3 mr-1" />Partial
                              </Button>
                              <Button size="sm" className="h-7 text-xs"
                                onClick={() => markPaid.mutate({ memberId: m.id, memberName: m.name, term })}
                                disabled={isProcessing}
                              >
                                {isProcessing ? '…' : 'Mark Paid'}
                              </Button>
                            </>
                          )
                        )}
                      </div>
                    </div>
                    {isPartial && (
                      <Progress value={pct} className="h-1.5 [&>div]:bg-[hsl(var(--warning))]" />
                    )}
                  </div>
                );
              })}
              {allDisplayMembers.length === 0 && <p className="text-sm text-muted-foreground">No members found.</p>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const AdminOverview = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />Contributions Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">User</th>
                <th className="text-center py-2 px-3 text-muted-foreground font-medium">Term 1</th>
                <th className="text-center py-2 px-3 text-muted-foreground font-medium">Term 2</th>
                <th className="text-center py-2 px-3 text-muted-foreground font-medium">Term 3</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Total Paid</th>
              </tr>
            </thead>
            <tbody>
              {overviewData.map((m: any) => (
                <tr key={m.id} className="border-b border-border/50">
                  <td className="py-2 px-3 font-medium text-foreground">
                    {m.name}
                    {m.isVirtual && <span className="text-[10px] text-muted-foreground ml-1">(V)</span>}
                  </td>
                  {m.termStatuses.map((ts: any) => (
                    <td key={ts.term} className="text-center py-2 px-3">
                      {ts.paid ? (
                        <div>
                          <Badge variant="secondary" className="text-[10px] bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]">₹{ts.limit}</Badge>
                          {ts.paidAt && <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(ts.paidAt).toLocaleDateString()}</p>}
                        </div>
                      ) : (
                        <div>
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">Pending</Badge>
                          <p className="text-[10px] text-muted-foreground mt-0.5">Limit: ₹{ts.limit}</p>
                        </div>
                      )}
                    </td>
                  ))}
                  <td className="text-right py-2 px-3 font-bold text-foreground">
                    ₹{m.termStatuses.reduce((s: number, ts: any) => s + ts.amount, 0).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Monthly Contributions</h1>
          <p className="text-sm text-muted-foreground">
            {isCurrentMonth ? `Current Term: ${TERM_LABELS[currentTerm]}` : `Viewing: ${monthOptions[month - 1].label} ${year}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={copyVpa}>
            <Copy className="w-3 h-3 mr-1" />Copy UPI: {getUpiVpa()}
          </Button>
          <Button variant={showHistory ? 'default' : 'outline'} size="sm" onClick={() => setShowHistory(!showHistory)}>
            <History className="w-4 h-4 mr-1" />{showHistory ? 'Current' : 'History'}
          </Button>
        </div>
      </div>

      {pendingPayment && (
        <UpiPaymentSelector
          open={upiSelectorOpen}
          onOpenChange={setUpiSelectorOpen}
          amount={getLimit(pendingPayment.memberId, pendingPayment.term)}
          onPaymentConfirmed={() => {
            confirmPayment.mutate();
          }}
          onCancel={() => {
            setPendingPayment(null);
            setShowFallback(false);
          }}
        />
      )}

      {showHistory && (
        <Card>
          <CardContent className="pt-4 flex gap-3 flex-wrap">
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>{monthOptions.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>{yearOptions.map(y => <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>)}</SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="manage">
        <TabsList>
          <TabsTrigger value="manage">{isAdmin ? 'Manage' : 'My Contributions'}</TabsTrigger>
          <TabsTrigger value="overview">Everyone's Status</TabsTrigger>
        </TabsList>
        <TabsContent value="manage" className="mt-4">
          <TermCards />
        </TabsContent>
        <TabsContent value="overview" className="mt-4">
          <AdminOverview />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Contributions;
