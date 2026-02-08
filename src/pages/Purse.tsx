import { useState } from 'react';
import { storage } from '@/lib/storage';
import { PurseTransaction } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, ArrowUpRight, ArrowDownLeft, Wallet } from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { useToast } from '@/hooks/use-toast';

const Purse = () => {
  const [transactions, setTransactions] = useState(storage.getPurseTransactions());
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');

  const balance = transactions.reduce((s, t) => s + (t.type === 'inflow' ? t.amount : -t.amount), 0);
  const totalIn = transactions.filter(t => t.type === 'inflow').reduce((s, t) => s + t.amount, 0);
  const totalOut = transactions.filter(t => t.type === 'outflow').reduce((s, t) => s + t.amount, 0);

  const addMoney = (e: React.FormEvent) => {
    e.preventDefault();
    const tx: PurseTransaction = {
      id: uuid(), type: 'inflow', amount: Number(amount), date, description,
      createdAt: new Date().toISOString(),
    };
    const updated = [...transactions, tx];
    storage.setPurseTransactions(updated);
    setTransactions(updated);
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
              {[...transactions].reverse().map(t => (
                <div key={t.id} className="flex items-center justify-between text-sm border-b border-border pb-3 last:border-0">
                  <div className="flex items-center gap-3">
                    {t.type === 'inflow' ? <ArrowDownLeft className="w-4 h-4 text-[hsl(var(--success))]" /> : <ArrowUpRight className="w-4 h-4 text-destructive" />}
                    <div>
                      <p className="font-medium text-foreground">{t.description || (t.type === 'inflow' ? 'Money Added' : 'Expense')}</p>
                      <p className="text-xs text-muted-foreground">{t.date}</p>
                    </div>
                  </div>
                  <span className={`font-bold ${t.type === 'inflow' ? 'text-[hsl(var(--success))]' : 'text-destructive'}`}>
                    {t.type === 'inflow' ? '+' : '-'}₹{t.amount.toLocaleString()}
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
