import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { UtensilsCrossed, Home, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

const FoodToggle = () => {
  const { user, profile, role } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const adminId = role === 'admin' ? profile?.id : profile?.admin_id;
  const today = new Date().toISOString().split('T')[0];

  const { data: members = [] } = useQuery({
    queryKey: ['room_members_food', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase.from('profiles').select('id, user_id, name').or(`id.eq.${adminId},admin_id.eq.${adminId}`).eq('approved', true);
      return data ?? [];
    },
    enabled: !!adminId,
  });

  const { data: toggles = [] } = useQuery({
    queryKey: ['food_toggle', adminId, today],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase.from('food_toggle').select('*').eq('admin_id', adminId).eq('date', today);
      return data ?? [];
    },
    enabled: !!adminId,
  });

  useEffect(() => {
    if (!adminId) return;
    const channel = supabase
      .channel('food-toggle-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'food_toggle', filter: `admin_id=eq.${adminId}` },
        () => qc.invalidateQueries({ queryKey: ['food_toggle', adminId, today] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [adminId, today, qc]);

  const toggleMutation = useMutation({
    mutationFn: async ({ memberId, memberName, eatingHome }: { memberId: string; memberName: string; eatingHome: boolean }) => {
      const existing = toggles.find((t: any) => t.user_id === memberId);
      if (existing) {
        const { error } = await supabase.from('food_toggle').update({ eating_home: eatingHome }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('food_toggle').insert({
          admin_id: adminId!, user_id: memberId, user_name: memberName, date: today, eating_home: eatingHome,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['food_toggle'] }),
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const eatingCount = members.filter((m: any) => {
    const toggle = toggles.find((t: any) => t.user_id === m.user_id);
    return !toggle || toggle.eating_home;
  }).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <UtensilsCrossed className="w-6 h-6 text-primary" />
          Who's Home Today?
        </h1>
        <p className="text-sm text-muted-foreground">Toggle whether you're eating at home today</p>
      </div>

      <Card className="border-2 border-primary/30 bg-primary/5">
        <CardContent className="py-4 flex items-center justify-between">
          <div>
            <p className="text-lg font-bold text-foreground">{eatingCount} of {members.length}</p>
            <p className="text-xs text-muted-foreground">people eating at home today</p>
          </div>
          <div className="text-3xl">🍽️</div>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {members.map((m: any) => {
          const toggle = toggles.find((t: any) => t.user_id === m.user_id);
          const eatingHome = toggle ? toggle.eating_home : true;
          const canToggle = role === 'admin' || m.user_id === user?.id;

          return (
            <Card key={m.user_id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  {eatingHome ? (
                    <Home className="w-5 h-5 text-[hsl(var(--success))]" />
                  ) : (
                    <X className="w-5 h-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium text-foreground">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{eatingHome ? 'Eating at home' : 'Not eating at home'}</p>
                  </div>
                </div>
                {canToggle && (
                  <Switch
                    checked={eatingHome}
                    onCheckedChange={(v) => toggleMutation.mutate({ memberId: m.user_id, memberName: m.name, eatingHome: v })}
                  />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default FoodToggle;
