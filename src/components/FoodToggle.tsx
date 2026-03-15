import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { UtensilsCrossed } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface FoodToggleProps {
  adminId: string;
}

const FoodToggle = ({ adminId }: FoodToggleProps) => {
  const { user, profile, isViewOnly } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const todayStr = new Date().toISOString().slice(0, 10);

  const { data: toggles = [] } = useQuery({
    queryKey: ['food_toggle', adminId, todayStr],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase.from('food_toggle').select('*').eq('admin_id', adminId).eq('date', todayStr);
      return data ?? [];
    },
    enabled: !!adminId,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['room_members_food', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase.from('profiles').select('id, user_id, name').or(`id.eq.${adminId},admin_id.eq.${adminId}`).eq('approved', true);
      return data ?? [];
    },
    enabled: !!adminId,
  });

  const getToggle = (userId: string) => toggles.find((t: any) => t.user_id === userId);
  const eatingCount = toggles.filter((t: any) => t.eating_home).length;

  const handleToggle = async (memberId: string, memberName: string, eating: boolean) => {
    if (isViewOnly) return;
    const existing = getToggle(memberId);
    if (existing) {
      await supabase.from('food_toggle').update({ eating_home: eating, updated_at: new Date().toISOString() }).eq('id', existing.id);
    } else {
      await supabase.from('food_toggle').insert({
        admin_id: adminId, user_id: memberId, user_name: memberName, eating_home: eating, date: todayStr,
      });
    }
    qc.invalidateQueries({ queryKey: ['food_toggle', adminId, todayStr] });
    toast({ title: eating ? `${memberName} is eating at home` : `${memberName} is eating out` });
  };

  if (members.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <UtensilsCrossed className="w-4 h-4 text-primary" />
          Eating at Home Today
          <span className="text-xs font-normal text-muted-foreground ml-auto">{eatingCount}/{members.length} eating home</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {members.map((m: any) => {
            const userId = m.user_id || m.id;
            const toggle = getToggle(userId);
            const eating = toggle?.eating_home ?? true;
            const canToggle = !isViewOnly && (user?.id === userId || profile?.id === adminId);

            return (
              <div key={m.id} className={`flex items-center justify-between p-2 rounded-lg text-sm ${eating ? 'bg-[hsl(var(--success))]/10' : 'bg-muted/50'}`}>
                <span className="text-foreground font-medium truncate">{m.name}</span>
                <Switch
                  checked={eating}
                  onCheckedChange={v => handleToggle(userId, m.name, v)}
                  disabled={!canToggle}
                  className="scale-75"
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default FoodToggle;
