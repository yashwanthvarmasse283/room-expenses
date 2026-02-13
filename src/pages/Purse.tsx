import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, ArrowUpRight, ArrowDownLeft, Wallet, Pencil, Trash2, CreditCard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const UPI_ID = '9030726301@ybl';
const UPI_NAME = 'R. Yashwanth Varma';

const Purse = () => {
  const { profile, role } = useAuth();
  const isAdmin = role === 'admin';
  const [open, setOpen] = useState(false);
  const [txType, setTxType] = useState<'inflow' | 'outflow'>('inflow');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingUpi, setPendingUpi] = useState(false);
  const [upiAmount, setUpiAmount] = useState('');

  const adminId = isAdmin ? profile?.id : profile?.admin_id;

  const { data: transactions = [] } = useQuery({
    queryKey: ['purse_transactions', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase.from('purse_transactions').select('*').eq('admin_id', adminId).order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!adminId,
  });

  useEffect(() => {
    if (!adminId) return;
    const channel = supabase
      .channel('purse-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purse_transactions', filter: `admin_id=eq.${adminId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['purse_transactions', adminId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [adminId, queryClient]);

  const balance = transactions.reduce((s: number, t: any) => s + (t.type === 'inflow' ? Number(t.amount) : -Number(t.amount)), 0);
  const totalIn = transactions.filter((t: any) => t.type === 'inflow').reduce((s: number, t: any) => s + Number(t.amount), 0);
  const totalOut = transactions.filter((t: any) => t.type === 'outflow').reduce((s: number, t: any) => s + Number(t.amount), 0);

  const resetForm = () => { setAmount(''); setDate(''); setDescription(''); setEditingId(null); setTxType('inflow'); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminId) return;

    if (editingId) {
      const { error } = await supabase.from('purse_transactions')
        .update({ amount: Number(amount), date, description, type: txType })
        .eq('id', editingId);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Updated' });
    } else {
      const { error } = await supabase.from('purse_transactions')
        .insert({ admin_id: adminId, type: txType, amount: Number(amount), date, description });
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: txType === 'inflow' ? 'Money Added' : 'Expense Added', description: `₹${amount}` });
    }
    queryClient.invalidateQueries({ queryKey: ['purse_transactions'] });
    setOpen(false);
    resetForm();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('purse_transactions').delete().eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    queryClient.invalidateQueries({ queryKey: ['purse_transactions'] });
    toast({ title: 'Deleted' });
  };

  const startEdit = (t: any) => {
    setEditingId(t.id); setAmount(String(t.amount)); setDate(t.date);
    setDescription(t.description || ''); setTxType(t.type);
    setOpen(true);
  };

  const handlePayNow = () => {
    if (!upiAmount || Number(upiAmount) <= 0) {
      toast({ title: 'Enter amount', variant: 'destructive' });
      return;
    }
    const url = `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(UPI_NAME)}&am=${upiAmount}&cu=INR`;
    window.location.href = url;
    setPendingUpi(true);
  };

  const confirmUpiPayment = async () => {
    if (!adminId || !upiAmount) return;
    const { error } = await supabase.from('purse_transactions').insert({
      admin_id: adminId,
      type: 'inflow',
      amount: Number(upiAmount),
      date: new Date().toISOString().slice(0, 10),
      description: `${profile?.name} - UPI Payment`,
    });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    queryClient.invalidateQueries({ queryKey: ['purse_transactions'] });
    toast({ title: 'Payment confirmed!', description: `₹${upiAmount} added to purse` });
    setPendingUpi(false);
    setUpiAmount('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">Purse / Wallet</h1>
        <div className="flex gap-2">
          <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button onClick={() => setTxType('inflow')}><Plus className="w-4 h-4 mr-1" />Add Money</Button>
            </DialogTrigger>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={() => setTxType('outflow')}><ArrowUpRight className="w-4 h-4 mr-1" />Add Expense</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingId ? 'Edit' : txType === 'inflow' ? 'Add Money' : 'Add Expense'}</DialogTitle></DialogHeader>
              <form onSubmit={save} className="space-y-4">
                <div className="space-y-2"><Label>Amount (₹)</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} required /></div>
                <div className="space-y-2"><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} required /></div>
                <div className="space-y-2"><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} /></div>
                <Button className="w-full" type="submit">{editingId ? 'Update' : 'Save'}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* UPI Pay Now Card */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" />
            Quick UPI Payment
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingUpi ? (
            <div className="flex items-center justify-between flex-wrap gap-3">
              <p className="text-sm text-muted-foreground">Completed UPI payment of ₹{upiAmount}?</p>
              <div className="flex gap-2">
                <Button size="sm" onClick={confirmUpiPayment}>Confirm Payment</Button>
                <Button size="sm" variant="ghost" onClick={() => { setPendingUpi(false); setUpiAmount(''); }}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <Input type="number" placeholder="Amount" className="w-32" value={upiAmount} onChange={e => setUpiAmount(e.target.value)} />
              <Button size="sm" onClick={handlePayNow}>
                <CreditCard className="w-3 h-3 mr-1" />Pay Now
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Balance</CardTitle>
            <Wallet className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-foreground">₹{balance.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Inflow</CardTitle>
            <ArrowDownLeft className="w-4 h-4 text-[hsl(var(--success))]" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-[hsl(var(--success))]">₹{totalIn.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Outflow</CardTitle>
            <ArrowUpRight className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">₹{totalOut.toLocaleString()}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Transaction History</CardTitle></CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <div className="space-y-3">
              {transactions.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between text-sm border-b border-border pb-3 last:border-0">
                  <div className="flex items-center gap-3">
                    {t.type === 'inflow' ? <ArrowDownLeft className="w-4 h-4 text-[hsl(var(--success))]" /> : <ArrowUpRight className="w-4 h-4 text-destructive" />}
                    <div>
                      <p className="font-medium text-foreground">{t.description || (t.type === 'inflow' ? 'Money Added' : 'Expense')}</p>
                      <p className="text-xs text-muted-foreground">{t.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${t.type === 'inflow' ? 'text-[hsl(var(--success))]' : 'text-destructive'}`}>
                      {t.type === 'inflow' ? '+' : '-'}₹{Number(t.amount).toLocaleString()}
                    </span>
                    {isAdmin && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => startEdit(t)}><Pencil className="w-3 h-3" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(t.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Purse;
