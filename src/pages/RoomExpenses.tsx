import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { storage } from '@/lib/storage';
import { RoomExpense, ExpenseCategory } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { useToast } from '@/hooks/use-toast';

const categories: ExpenseCategory[] = ['Food', 'Rent', 'Electricity', 'Internet', 'Misc'];

const RoomExpenses = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { toast } = useToast();
  const [expenses, setExpenses] = useState(storage.getRoomExpenses());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RoomExpense | null>(null);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<string>('all');

  // Form
  const [date, setDate] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Food');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paidBy, setPaidBy] = useState('');

  const resetForm = () => { setDate(''); setCategory('Food'); setAmount(''); setDescription(''); setPaidBy(''); setEditing(null); };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const exp: RoomExpense = {
      id: editing?.id || uuid(),
      date, category, amount: Number(amount), description, paidBy,
      splitAmong: [], createdAt: editing?.createdAt || new Date().toISOString(),
    };
    let updated: RoomExpense[];
    if (editing) {
      updated = expenses.map(x => x.id === editing.id ? exp : x);
    } else {
      updated = [...expenses, exp];
      // Auto-deduct from purse
      const purse = storage.getPurseTransactions();
      purse.push({ id: uuid(), type: 'outflow', amount: Number(amount), date, description: `Room: ${description || category}`, createdAt: new Date().toISOString() });
      storage.setPurseTransactions(purse);
    }
    storage.setRoomExpenses(updated);
    setExpenses(updated);
    setOpen(false);
    resetForm();
    toast({ title: editing ? 'Updated' : 'Added', description: `Expense ${editing ? 'updated' : 'added'} successfully.` });
  };

  const remove = (id: string) => {
    const updated = expenses.filter(e => e.id !== id);
    storage.setRoomExpenses(updated);
    setExpenses(updated);
    toast({ title: 'Deleted', description: 'Expense removed.' });
  };

  const startEdit = (exp: RoomExpense) => {
    setEditing(exp); setDate(exp.date); setCategory(exp.category);
    setAmount(String(exp.amount)); setDescription(exp.description); setPaidBy(exp.paidBy);
    setOpen(true);
  };

  const filtered = expenses.filter(e => {
    const matchSearch = !search || e.description.toLowerCase().includes(search.toLowerCase()) || e.category.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === 'all' || e.category === filterCat;
    return matchSearch && matchCat;
  }).reverse();

  const monthlyTotal = expenses.filter(e => {
    const d = new Date(e.date); const n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }).reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Room Expenses</h1>
          <p className="text-sm text-muted-foreground">Monthly total: ₹{monthlyTotal.toLocaleString()}</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-1" />Add Expense</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? 'Edit' : 'Add'} Expense</DialogTitle></DialogHeader>
              <form onSubmit={save} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} required /></div>
                  <div className="space-y-2"><Label>Category</Label>
                    <Select value={category} onValueChange={v => setCategory(v as ExpenseCategory)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Amount (₹)</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} required /></div>
                  <div className="space-y-2"><Label>Paid By</Label><Input value={paidBy} onChange={e => setPaidBy(e.target.value)} /></div>
                </div>
                <div className="space-y-2"><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} /></div>
                <Button className="w-full" type="submit">{editing ? 'Update' : 'Add'} Expense</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search expenses..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">No expenses found.</CardContent></Card>
        ) : filtered.map(e => (
          <Card key={e.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{e.description || e.category}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">{e.category}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{e.date}{e.paidBy && ` · Paid by ${e.paidBy}`}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-foreground">₹{e.amount.toLocaleString()}</span>
                {isAdmin && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(e)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(e.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default RoomExpenses;
