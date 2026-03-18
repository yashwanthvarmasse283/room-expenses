import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

const QUICK_CATEGORIES = ['Food', 'Water', 'Rent', 'Electricity', 'Internet', 'Misc'];

const QuickAddExpense = () => {
  const { profile, role, isViewOnly } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isAdmin = role === 'admin';
  const adminId = isAdmin ? profile?.id : profile?.admin_id;

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  if (isViewOnly) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminId || !profile || !amount) return;
    setSaving(true);
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from('room_expenses').insert({
      admin_id: adminId,
      date: today,
      category,
      amount: Number(amount),
      description: description || category,
      paid_by: profile.name,
      created_by_name: profile.name,
    });
    if (!error) {
      await supabase.from('purse_transactions').insert({
        admin_id: adminId,
        type: 'outflow',
        amount: Number(amount),
        date: today,
        description: `Room: ${description || category}`,
      });
      qc.invalidateQueries({ queryKey: ['room_expenses'] });
      qc.invalidateQueries({ queryKey: ['purse_transactions'] });
      toast({ title: 'Expense added!', description: `₹${amount} for ${category}` });
      setAmount('');
      setDescription('');
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />Quick Add Expense
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex items-end gap-2 flex-wrap">
          <div className="space-y-1">
            <Input
              type="number"
              placeholder="₹ Amount"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
              className="w-24 h-8 text-sm"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-28 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {QUICK_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            placeholder="Note (optional)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-32 h-8 text-sm"
          />
          <Button size="sm" type="submit" disabled={saving} className="h-8">
            {saving ? '...' : 'Add'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default QuickAddExpense;
