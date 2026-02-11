import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, UserMinus, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const RoomSettings = () => {
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
    toast({ title: approved ? 'Approved' : 'Rejected' });
  };

  const removeMember = async (member: any) => {
    // Remove admin_id link and set approved false (effectively removing from room)
    const { error } = await supabase.from('profiles').update({ admin_id: null, approved: false }).eq('id', member.id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    queryClient.invalidateQueries({ queryKey: ['admin_users'] });
    toast({ title: 'Member Removed', description: `${member.name} has been removed from the room.` });
  };

  const pending = users.filter((u: any) => !u.approved);
  const approved = users.filter((u: any) => u.approved);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Room Settings</h1>
        <p className="text-sm text-muted-foreground">Manage members, approve requests, and configure your room.</p>
      </div>

      {/* Admin Info */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <Shield className="w-5 h-5 text-primary" />
          <CardTitle className="text-base">Room Admin</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-medium text-foreground">{profile?.name}</p>
          <p className="text-xs text-muted-foreground">{profile?.email}</p>
          <p className="text-xs text-muted-foreground mt-1">Admin Code: <span className="font-mono font-semibold text-primary">{profile?.admin_code}</span></p>
        </CardContent>
      </Card>

      {/* Pending */}
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

      {/* Approved Members */}
      <Card>
        <CardHeader><CardTitle className="text-base">Room Members ({approved.length})</CardTitle></CardHeader>
        <CardContent>
          {approved.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members yet. Share your Admin Code to invite users.</p>
          ) : (
            <div className="space-y-3">
              {approved.map((u: any) => (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <div>
                    <p className="font-medium text-foreground">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                    {u.mobile_number && <p className="text-xs text-muted-foreground">{u.mobile_number}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Active</Badge>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10">
                          <UserMinus className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove {u.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove the member from your room. They will lose access to all room data.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => removeMember(u)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RoomSettings;
