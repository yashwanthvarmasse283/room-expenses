import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const ManageUsers = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ['admin_users', profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase.from('profiles').select('*').eq('admin_id', profile.id);
      return data ?? [];
    },
    enabled: !!profile,
  });

  const updateUser = async (id: string, approved: boolean) => {
    const { error } = await supabase.from('profiles').update({ approved }).eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    queryClient.invalidateQueries({ queryKey: ['admin_users'] });
    toast({ title: approved ? 'Approved' : 'Rejected', description: `User ${approved ? 'approved' : 'rejected'}.` });
  };

  const pending = users.filter((u: any) => !u.approved);
  const approved = users.filter((u: any) => u.approved);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Manage Users</h1>

      {pending.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Pending Requests ({pending.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {pending.map((u: any) => (
              <div key={u.id} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <div>
                  <p className="font-medium text-foreground">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => updateUser(u.id, true)}><Check className="w-4 h-4 mr-1" />Approve</Button>
                  <Button size="sm" variant="destructive" onClick={() => updateUser(u.id, false)}><X className="w-4 h-4 mr-1" />Reject</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Approved Users ({approved.length})</CardTitle></CardHeader>
        <CardContent>
          {approved.length === 0 ? (
            <p className="text-sm text-muted-foreground">No approved users yet.</p>
          ) : (
            <div className="space-y-3">
              {approved.map((u: any) => (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <div>
                    <p className="font-medium text-foreground">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <Badge variant="secondary">Active</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ManageUsers;
