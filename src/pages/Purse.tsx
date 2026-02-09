import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, ArrowUpRight, ArrowDownLeft, Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const Purse = () => {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');

  const { data: transactions = [] } = useQuery({
    queryKey: ['purse_transactions', profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase.from('purse_transactions').select('*').eq('admin_id', profile.id).order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!profile,
  });

  const balance = transactions.reduce((s: number, t: any) => s + (t.type === 'inflow' ? Number(t.amount) : -Number(t.amount)), 0);
  const totalIn = transactions.filter((t: any) => t.type === 'inflow').reduce((s: number, t: any) => s + Number(t.amount), 0);
  const totalOut = transactions.filter((t: any) => t.type === 'outflow').reduce((s: number, t: any) => s + Number(t.amount), 0);

  const addMoney = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const { error } = await supabase.from('purse_transactions')
      .insert({ admin_id: profile.id, type: 'inflow', amount: Number(amount), date, description });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    queryClient.invalidateQueries({ queryKey: ['purse_transactions'] });
    setOpen(false); setAmount(''); setDate(''); setDescription('');
    toast({ title: 'Money Added', description: `₹${amount} added to purse.` });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">Purse / Wallet</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" />Add Money</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Money to Purse</DialogTitle></DialogHeader>
            <form onSubmit={addMoney} className="space-y-4">
              <div className="space-y-2"><Label>Amount (₹)</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} required /></div>
              <div className="space-y-2"><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} required /></div>
              <div className="space-y-2"><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} /></div>
              <Button className="w-full" type="submit">Add Money</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

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
                  <span className={`font-bold ${t.type === 'inflow' ? 'text-[hsl(var(--success))]' : 'text-destructive'}`}>
                    {t.type === 'inflow' ? '+' : '-'}₹{Number(t.amount).toLocaleString()}
                  </span>
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
