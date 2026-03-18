import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { CheckCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Props {
  adminId: string;
  year: number;
  month: number;
  term: number;
  members: { id: string; name: string }[];
  contributions: any[];
}

const BulkMarkPaid = ({ adminId, year, month, term, members, contributions }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [processing, setProcessing] = useState(false);
  const processingRef = useRef(false);

  const unpaidMembers = members.filter(m => {
    const record = contributions.find((c: any) => c.user_id === m.id && c.term === term);
    return !record?.paid;
  });

  if (unpaidMembers.length === 0) return null;

  const bulkMark = async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    try {
      for (const m of unpaidMembers) {
        const { data: existing } = await supabase.from('monthly_contributions')
          .select('id, paid')
          .eq('admin_id', adminId).eq('user_id', m.id)
          .eq('year', year).eq('month', month).eq('term', term)
          .maybeSingle();

        if (existing?.paid) continue;

        if (existing) {
          await supabase.from('monthly_contributions')
            .update({ paid: true, paid_at: new Date().toISOString(), marked_by: user!.id })
            .eq('id', existing.id);
        } else {
          await supabase.from('monthly_contributions')
            .insert({ admin_id: adminId, user_id: m.id, user_name: m.name, year, month, term, paid: true, paid_at: new Date().toISOString(), marked_by: user!.id });
        }
      }
      qc.invalidateQueries({ queryKey: ['contributions'] });
      qc.invalidateQueries({ queryKey: ['purse_transactions'] });
      qc.invalidateQueries({ queryKey: ['personal_wallet'] });
      toast({ title: `Marked ${unpaidMembers.length} members as paid for Term ${term}` });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
      processingRef.current = false;
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs">
          <CheckCheck className="w-3 h-3 mr-1" />Mark All Paid ({unpaidMembers.length})
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Bulk Mark Paid?</AlertDialogTitle>
          <AlertDialogDescription>
            This will mark {unpaidMembers.length} unpaid members as paid for Term {term}. 
            Each member's wallet and the room purse will be credited automatically.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={bulkMark} disabled={processing}>
            {processing ? 'Processing...' : 'Confirm'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default BulkMarkPaid;
