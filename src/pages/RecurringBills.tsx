import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { CalendarClock, Plus, Trash2, Pencil } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

const CATEGORIES = ['Rent', 'WiFi', 'Electricity', 'Netflix', 'Gas', 'Water', 'Insurance', 'Other'];

const RecurringBills = () => {
  const { profile, role } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const adminId = role === 'admin' ? profile?.id : profile?.admin_id;
  const isAdmin = role === 'admin';

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDay, setDueDay] = useState('1');
  const [category, setCategory] = useState('Bills');

  const { data: bills = [] } = useQuery({
    queryKey: ['recurring_bills', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase.from('recurring_bills').select('*').eq('admin_id', adminId).order('due_day');
      return data ?? [];
    },
    enabled: !!adminId,
  });

  useEffect(() => {
    if (!adminId) return;
    const channel = supabase
      .channel('bills-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recurring_bills', filter: `admin_id=eq.${adminId}` },
        () => qc.invalidateQueries({ queryKey: ['recurring_bills', adminId] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [adminId, qc]);

  const resetForm = () => { setName(''); setAmount(''); setDueDay('1'); setCategory('Bills'); setEditId(null); };

  const saveBill = useMutation({
    mutationFn: async () => {
      if (editId) {
        const { error } = await supabase.from('recurring_bills').update({ name, amount: Number(amount), due_day: Number(dueDay), category }).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('recurring_bills').insert({ admin_id: adminId!, name, amount: Number(amount), due_day: Number(dueDay), category });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring_bills'] });
      toast({ title: editId ? 'Bill updated' : 'Bill added' });
      resetForm();
      setOpen(false);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteBill = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recurring_bills').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring_bills'] });
      toast({ title: 'Bill removed' });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('recurring_bills').update({ active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring_bills'] }),
  });

  const openEdit = (bill: any) => {
    setEditId(bill.id);
    setName(bill.name);
    setAmount(String(bill.amount));
    setDueDay(String(bill.due_day));
    setCategory(bill.category);
    setOpen(true);
  };

  const today = new Date().getDate();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Recurring Bills</h1>
          <p className="text-sm text-muted-foreground">Fixed monthly expenses auto-tracked</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" />Add Bill</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editId ? 'Edit Bill' : 'Add Recurring Bill'}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Netflix" /></div>
                <div><Label>Amount (₹)</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} /></div>
                <div><Label>Due Day of Month</Label>
                  <Select value={dueDay} onValueChange={setDueDay}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Array.from({ length: 31 }, (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={() => saveBill.mutate()} disabled={!name || !amount}>
                  {editId ? 'Update' : 'Add Bill'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-3">
        {bills.length === 0 && <Card><CardContent className="py-8 text-center text-muted-foreground">No recurring bills set up yet.</CardContent></Card>}
        {bills.map((bill: any) => (
          <Card key={bill.id} className={!bill.active ? 'opacity-60' : ''}>
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <CalendarClock className={`w-5 h-5 ${bill.due_day <= today ? 'text-[hsl(var(--warning))]' : 'text-primary'}`} />
                <div>
                  <p className="font-medium text-foreground">{bill.name}</p>
                  <p className="text-xs text-muted-foreground">Due: {bill.due_day}{['st','nd','rd'][bill.due_day-1] || 'th'} · {bill.category}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-foreground">₹{Number(bill.amount).toLocaleString()}</span>
                {isAdmin && (
                  <>
                    <Switch checked={bill.active} onCheckedChange={(v) => toggleActive.mutate({ id: bill.id, active: v })} />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(bill)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteBill.mutate(bill.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default RecurringBills;
