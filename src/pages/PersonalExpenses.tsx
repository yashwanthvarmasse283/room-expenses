import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { storage } from '@/lib/storage';
import { PersonalExpense, PersonalCategory } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { useToast } from '@/hooks/use-toast';

const categories: PersonalCategory[] = ['Travel', 'Shopping', 'Food', 'Health', 'Entertainment', 'Others'];

const PersonalExpenses = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const allExpenses = storage.getPersonalExpenses();
  const [expenses, setExpenses] = useState(allExpenses.filter(e => e.userId === user?.id));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PersonalExpense | null>(null);

  const [date, setDate] = useState('');
  const [category, setCategory] = useState<PersonalCategory>('Food');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const resetForm = () => { setDate(''); setCategory('Food'); setAmount(''); setDescription(''); setEditing(null); };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const exp: PersonalExpense = {
      id: editing?.id || uuid(),
      userId: user!.id, date, category, amount: Number(amount), description,
      createdAt: editing?.createdAt || new Date().toISOString(),
    };
    let myExpenses: PersonalExpense[];
    if (editing) {
      myExpenses = expenses.map(x => x.id === editing.id ? exp : x);
    } else {
      myExpenses = [...expenses, exp];
    }
    setExpenses(myExpenses);
    const others = allExpenses.filter(e => e.userId !== user?.id);
    storage.setPersonalExpenses([...others, ...myExpenses]);
    setOpen(false); resetForm();
    toast({ title: editing ? 'Updated' : 'Added' });
  };

  const remove = (id: string) => {
    const updated = expenses.filter(e => e.id !== id);
    setExpenses(updated);
    const others = allExpenses.filter(e => e.userId !== user?.id);
    storage.setPersonalExpenses([...others, ...updated]);
    toast({ title: 'Deleted' });
  };

  const startEdit = (exp: PersonalExpense) => {
    setEditing(exp); setDate(exp.date); setCategory(exp.category);
    setAmount(String(exp.amount)); setDescription(exp.description);
    setOpen(true);
  };

  const monthTotal = expenses.filter(e => {
    const d = new Date(e.date); const n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }).reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Personal Expenses</h1>
          <p className="text-sm text-muted-foreground">This month: ₹{monthTotal.toLocaleString()}</p>
        </div>
        <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" />Add</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? 'Edit' : 'Add'} Expense</DialogTitle></DialogHeader>
            <form onSubmit={save} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} required /></div>
                <div className="space-y-2"><Label>Category</Label>
                  <Select value={category} onValueChange={v => setCategory(v as PersonalCategory)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2"><Label>Amount (₹)</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} required /></div>
              <div className="space-y-2"><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} /></div>
              <Button className="w-full" type="submit">{editing ? 'Update' : 'Add'}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {expenses.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">No personal expenses yet.</CardContent></Card>
        ) : [...expenses].reverse().map(e => (
          <Card key={e.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <span className="font-medium text-foreground">{e.description || e.category}</span>
                <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">{e.category}</span>
                <p className="text-xs text-muted-foreground mt-0.5">{e.date}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-foreground">₹{e.amount.toLocaleString()}</span>
                <Button variant="ghost" size="icon" onClick={() => startEdit(e)}><Pencil className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => remove(e.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default PersonalExpenses;
