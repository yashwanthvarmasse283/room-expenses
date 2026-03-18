import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Save, Target } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  profileId: string | undefined;
}

const MonthlyBudgetTarget = ({ profileId }: Props) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [target, setTarget] = useState('');
  const [currentTarget, setCurrentTarget] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profileId) return;
    supabase.from('profiles').select('monthly_budget_target').eq('id', profileId).single()
      .then(({ data }) => {
        const val = (data as any)?.monthly_budget_target ?? 0;
        setCurrentTarget(val);
      });
  }, [profileId]);

  const save = async () => {
    if (!profileId) return;
    setLoading(true);
    const val = Number(target) || 0;
    const { error } = await supabase.from('profiles')
      .update({ monthly_budget_target: val } as any)
      .eq('id', profileId);
    setLoading(false);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    setCurrentTarget(val);
    setTarget('');
    qc.invalidateQueries({ queryKey: ['admin_profile_settings'] });
    toast({ title: 'Monthly budget target updated!' });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />Monthly Budget Target
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">
          Current target: <span className="font-bold text-foreground">
            {currentTarget > 0 ? `₹${currentTarget.toLocaleString()}` : 'Not set'}
          </span>
        </p>
        <div className="flex items-center gap-3">
          <div className="space-y-1">
            <Label className="text-xs">New Target (₹)</Label>
            <Input type="number" className="w-40" placeholder={currentTarget ? String(currentTarget) : '10000'} value={target} onChange={e => setTarget(e.target.value)} />
          </div>
          <Button size="sm" className="mt-5" onClick={save} disabled={loading}>
            <Save className="w-3 h-3 mr-1" />{loading ? 'Saving...' : 'Save'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Set 0 to disable. This target shows progress on the dashboard.</p>
      </CardContent>
    </Card>
  );
};

export default MonthlyBudgetTarget;
