import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Clock, History, CalendarDays } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

const TERM_LABELS: Record<number, string> = { 1: '1st – 10th', 2: '11th – 20th', 3: '21st – 30th' };

const getCurrentTerm = () => {
  const day = new Date().getDate();
  if (day <= 10) return 1;
  if (day <= 20) return 2;
  return 3;
};

const Contributions = () => {
  const { user, profile, role } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const adminId = role === 'admin' ? profile?.id : profile?.admin_id;

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [showHistory, setShowHistory] = useState(false);
  const currentTerm = getCurrentTerm();

  // Fetch members
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

  // Fetch contributions
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

  // Real-time listener
  useEffect(() => {
    if (!adminId) return;
    const channel = supabase
      .channel('contributions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_contributions', filter: `admin_id=eq.${adminId}` },
        () => qc.invalidateQueries({ queryKey: ['contributions', adminId, year, month] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [adminId, year, month, qc]);

  const markPaid = useMutation({
    mutationFn: async ({ memberId, memberName, term }: { memberId: string; memberName: string; term: number }) => {
      const { data: existing } = await supabase
        .from('monthly_contributions')
        .select('id')
        .eq('admin_id', adminId!)
        .eq('user_id', memberId)
        .eq('year', year)
        .eq('month', month)
        .eq('term', term)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('monthly_contributions')
          .update({ paid: true, paid_at: new Date().toISOString(), marked_by: user!.id })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('monthly_contributions')
          .insert({
            admin_id: adminId!,
            user_id: memberId,
            user_name: memberName,
            year, month, term,
            paid: true,
            paid_at: new Date().toISOString(),
            marked_by: user!.id,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contributions'] });
      toast({ title: 'Marked as paid!' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const markUnpaid = useMutation({
    mutationFn: async ({ memberId, term }: { memberId: string; term: number }) => {
      const { error } = await supabase
        .from('monthly_contributions')
        .delete()
        .eq('admin_id', adminId!)
        .eq('user_id', memberId)
        .eq('year', year)
        .eq('month', month)
        .eq('term', term);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contributions'] });
      toast({ title: 'Marked as unpaid' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const getStatus = (memberId: string, term: number) => {
    return contributions.find((c: any) => c.user_id === memberId && c.term === term);
  };

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  const monthOptions = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({
      value: String(i + 1),
      label: new Date(2000, i).toLocaleString('default', { month: 'long' }),
    })), []);

  const yearOptions = useMemo(() => {
    const y = now.getFullYear();
    return [y - 1, y, y + 1].map(v => ({ value: String(v), label: String(v) }));
  }, []);

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
          <Button variant={showHistory ? 'default' : 'outline'} size="sm" onClick={() => setShowHistory(!showHistory)}>
            <History className="w-4 h-4 mr-1" />
            {showHistory ? 'Current' : 'History'}
          </Button>
        </div>
      </div>

      {showHistory && (
        <Card>
          <CardContent className="pt-4 flex gap-3 flex-wrap">
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {monthOptions.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {yearOptions.map(y => <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Term Cards */}
      <div className="grid gap-4">
        {[1, 2, 3].map(term => (
          <Card key={term} className={isCurrentMonth && term === currentTerm ? 'border-2 border-primary/50' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-primary" />
                  Term {term}: {TERM_LABELS[term]}
                </CardTitle>
                {isCurrentMonth && term === currentTerm && (
                  <Badge variant="default" className="text-xs">Current</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {members.map((m: any) => {
                  const record = getStatus(m.user_id, term);
                  const isPaid = record?.paid === true;
                  const canMark = role === 'admin' || m.user_id === user?.id;

                  return (
                    <div key={m.user_id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        {isPaid ? (
                          <CheckCircle2 className="w-4 h-4 text-[hsl(var(--success))]" />
                        ) : (
                          <Clock className="w-4 h-4 text-[hsl(var(--warning))]" />
                        )}
                        <span className="text-sm font-medium text-foreground">{m.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isPaid ? (
                          <>
                            <Badge variant="secondary" className="text-xs bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]">Paid</Badge>
                            {role === 'admin' && (
                              <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => markUnpaid.mutate({ memberId: m.user_id, term })}>
                                Undo
                              </Button>
                            )}
                          </>
                        ) : (
                          canMark && (
                            <Button size="sm" className="h-7 text-xs" onClick={() => markPaid.mutate({ memberId: m.user_id, memberName: m.name, term })}>
                              Mark Paid
                            </Button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
                {members.length === 0 && <p className="text-sm text-muted-foreground">No members found.</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Contributions;
