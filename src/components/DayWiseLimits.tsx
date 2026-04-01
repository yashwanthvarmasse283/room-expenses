import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const DAY_LABELS: Record<string, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};

interface DayWiseLimitsProps {
  profileId: string | undefined;
}

const DayWiseLimits = ({ profileId }: DayWiseLimitsProps) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [limits, setLimits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profileId) return;
    supabase.from('profiles').select('daily_limits_by_day').eq('id', profileId).single()
      .then(({ data }) => {
        const saved = (data as any)?.daily_limits_by_day || {};
        const init: Record<string, string> = {};
        DAYS.forEach(d => { init[d] = saved[d] ? String(saved[d]) : ''; });
        setLimits(init);
      });
  }, [profileId]);

  const save = async () => {
    if (!profileId) return;
    setLoading(true);
    const parsed: Record<string, number> = {};
    DAYS.forEach(d => {
      const v = Number(limits[d]);
      if (v > 0) parsed[d] = v;
    });
    const { error } = await supabase.from('profiles')
      .update({ daily_limits_by_day: parsed } as any)
      .eq('id', profileId);
    setLoading(false);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    qc.invalidateQueries({ queryKey: ['admin_profile_settings'] });
    toast({ title: 'Day-wise limits saved!' });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Day-Wise Spending Limits</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">Set different daily limits for each day of the week. Leave blank to use the default daily budget.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {DAYS.map(day => (
            <div key={day} className="space-y-1">
              <Label className="text-xs">{DAY_LABELS[day]}</Label>
              <Input
                type="number"
                placeholder="Default"
                value={limits[day] || ''}
                onChange={e => setLimits(prev => ({ ...prev, [day]: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
          ))}
        </div>
        <Button size="sm" onClick={save} disabled={loading}>
          <Save className="w-3 h-3 mr-1" />{loading ? 'Saving...' : 'Save Limits'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default DayWiseLimits;
