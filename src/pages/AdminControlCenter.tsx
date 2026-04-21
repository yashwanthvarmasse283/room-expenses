import { useState } from 'react';
import DayWiseLimits from '@/components/DayWiseLimits';
import GroceryManager from '@/components/GroceryManager';
import MonthlyBudgetTarget from '@/components/MonthlyBudgetTarget';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Check, X, UserMinus, Shield, Save, Ban, Eye, UserPlus, Users, Settings2, Lock, Clock, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const AdminControlCenter = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [budgetInput, setBudgetInput] = useState('');
  const [virtualName, setVirtualName] = useState('');
  const [addVirtualOpen, setAddVirtualOpen] = useState(false);
  const [limitsOpen, setLimitsOpen] = useState(false);
  const [limitsForUser, setLimitsForUser] = useState<any>(null);
  const [termLimits, setTermLimits] = useState<Record<number, string>>({ 1: '500', 2: '500', 3: '500' });
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberPassword, setNewMemberPassword] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [banOpen, setBanOpen] = useState(false);
  const [banForUser, setBanForUser] = useState<any>(null);
  const [banDuration, setBanDuration] = useState('1d');

  const { data: users = [] } = useQuery({
    queryKey: ['admin_users', profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase.from('profiles').select('*').eq('admin_id', profile.id);
      return data ?? [];
    },
    enabled: !!profile,
  });

  const { data: virtualMembers = [] } = useQuery({
    queryKey: ['virtual_roommates', profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase.from('virtual_roommates').select('*').eq('admin_id', profile.id);
      return data ?? [];
    },
    enabled: !!profile,
  });

  const { data: contribLimits = [] } = useQuery({
    queryKey: ['contribution_limits', profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase.from('contribution_limits').select('*').eq('admin_id', profile.id);
      return data ?? [];
    },
    enabled: !!profile,
  });

  const { data: adminProfile } = useQuery({
    queryKey: ['admin_profile_settings', profile?.id],
    queryFn: async () => {
      if (!profile) return null;
      const { data } = await supabase.from('profiles').select('daily_food_budget, admin_contributions_enabled').eq('id', profile.id).single();
      return data;
    },
    enabled: !!profile,
  });

  const currentBudget = (adminProfile as any)?.daily_food_budget ?? 120;
  const adminContribEnabled = (adminProfile as any)?.admin_contributions_enabled ?? true;

  const updateUser = async (id: string, approved: boolean) => {
    const { error } = await supabase.from('profiles').update({ approved }).eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    queryClient.invalidateQueries({ queryKey: ['admin_users'] });
    toast({ title: approved ? 'Approved' : 'Rejected' });
  };

  const removeMember = async (member: any) => {
    const { error } = await supabase.from('profiles').update({ admin_id: null, approved: false }).eq('id', member.id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    queryClient.invalidateQueries({ queryKey: ['admin_users'] });
    toast({ title: 'Member Removed', description: `${member.name} has been removed.` });
  };

  const saveBudget = async () => {
    const val = Number(budgetInput || currentBudget);
    if (!profile || isNaN(val) || val <= 0) return;
    const { error } = await supabase.from('profiles').update({ daily_food_budget: val } as any).eq('id', profile.id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    queryClient.invalidateQueries({ queryKey: ['admin_profile_settings'] });
    toast({ title: 'Budget Updated', description: `Daily food budget set to ₹${val}` });
    setBudgetInput('');
  };

  const toggleAdminContrib = async (enabled: boolean) => {
    if (!profile) return;
    const { error } = await supabase.from('profiles').update({ admin_contributions_enabled: enabled } as any).eq('id', profile.id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    queryClient.invalidateQueries({ queryKey: ['admin_profile_settings'] });
    toast({ title: enabled ? 'Admin Contributions Enabled' : 'Admin Contributions Disabled' });
  };

  const toggleDeactivated = async (member: any, deactivated: boolean) => {
    const { error } = await supabase.from('profiles').update({ deactivated } as any).eq('id', member.id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    queryClient.invalidateQueries({ queryKey: ['admin_users'] });
    toast({ title: deactivated ? 'User Deactivated' : 'User Activated', description: `${member.name} has been ${deactivated ? 'deactivated' : 'activated'}.` });
  };

  const toggleViewOnly = async (member: any, viewOnly: boolean) => {
    const { error } = await supabase.from('profiles').update({ view_only: viewOnly } as any).eq('id', member.id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    queryClient.invalidateQueries({ queryKey: ['admin_users'] });
    toast({ title: viewOnly ? 'View-Only Enabled' : 'View-Only Disabled', description: `${member.name} is now in ${viewOnly ? 'view-only' : 'full access'} mode.` });
  };

  const toggleBlocked = async (member: any, blocked: boolean) => {
    const { error } = await supabase.from('profiles').update({ blocked } as any).eq('id', member.id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    queryClient.invalidateQueries({ queryKey: ['admin_users'] });
    toast({ title: blocked ? 'User Blocked' : 'User Unblocked', description: `${member.name} ${blocked ? 'has been permanently blocked.' : 'can now access the room again.'}` });
  };

  const openBanDialog = (member: any) => {
    setBanForUser(member);
    setBanDuration('1d');
    setBanOpen(true);
  };

  const applyBan = async () => {
    if (!banForUser) return;
    const map: Record<string, number> = { '1h': 3600e3, '6h': 21600e3, '1d': 86400e3, '3d': 259200e3, '7d': 604800e3, '30d': 2592000e3 };
    const ms = map[banDuration] ?? 86400e3;
    const until = new Date(Date.now() + ms).toISOString();
    const { error } = await supabase.from('profiles').update({ banned_until: until } as any).eq('id', banForUser.id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    queryClient.invalidateQueries({ queryKey: ['admin_users'] });
    toast({ title: 'Member Banned', description: `${banForUser.name} is banned until ${new Date(until).toLocaleString()}.` });
    setBanOpen(false);
  };

  const liftBan = async (member: any) => {
    const { error } = await supabase.from('profiles').update({ banned_until: null } as any).eq('id', member.id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    queryClient.invalidateQueries({ queryKey: ['admin_users'] });
    toast({ title: 'Ban Lifted', description: `${member.name} can log in again.` });
  };

  const deleteMember = async (member: any) => {
    // Soft-delete: detach from room, mark as deleted, but keep history intact
    const { error } = await supabase
      .from('profiles')
      .update({ admin_id: null, approved: false, deleted_marker: true, blocked: true } as any)
      .eq('id', member.id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    queryClient.invalidateQueries({ queryKey: ['admin_users'] });
    toast({ title: 'Member Deleted', description: `${member.name} has been removed. Their history is preserved as "Deleted".` });
  };

  const addVirtualMember = async () => {
    if (!profile || !virtualName.trim()) return;
    const { error } = await supabase.from('virtual_roommates').insert({ admin_id: profile.id, name: virtualName.trim() });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    queryClient.invalidateQueries({ queryKey: ['virtual_roommates'] });
    toast({ title: 'Virtual Member Added', description: `${virtualName} has been added.` });
    setVirtualName('');
    setAddVirtualOpen(false);
  };

  const removeVirtualMember = async (id: string, name: string) => {
    const { error } = await supabase.from('virtual_roommates').delete().eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    queryClient.invalidateQueries({ queryKey: ['virtual_roommates'] });
    toast({ title: 'Removed', description: `${name} has been removed.` });
  };

  const openLimitsDialog = (member: any) => {
    const userId = member.user_id || member.id;
    setLimitsForUser({ ...member, resolvedId: userId });
    const limits: Record<number, string> = { 1: '500', 2: '500', 3: '500' };
    [1, 2, 3].forEach(term => {
      const existing = contribLimits.find((l: any) => l.user_id === userId && l.term === term);
      if (existing) limits[term] = String(existing.amount);
    });
    setTermLimits(limits);
    setLimitsOpen(true);
  };

  const saveLimits = async () => {
    if (!profile || !limitsForUser) return;
    const userId = limitsForUser.resolvedId;
    for (const term of [1, 2, 3]) {
      const amount = Number(termLimits[term]);
      if (isNaN(amount) || amount <= 0) continue;
      const { data: existing } = await supabase.from('contribution_limits')
        .select('id').eq('admin_id', profile.id).eq('user_id', userId).eq('term', term).maybeSingle();
      if (existing) {
        await supabase.from('contribution_limits').update({ amount }).eq('id', existing.id);
      } else {
        await supabase.from('contribution_limits').insert({ admin_id: profile.id, user_id: userId, term, amount });
      }
    }
    queryClient.invalidateQueries({ queryKey: ['contribution_limits'] });
    toast({ title: 'Limits Saved', description: `Contribution limits updated for ${limitsForUser.name}.` });
    setLimitsOpen(false);
  };

  const addMember = async () => {
    if (!newMemberName.trim() || !newMemberEmail.trim() || !newMemberPassword.trim()) return;
    setAddingMember(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('create-member', {
        body: { name: newMemberName.trim(), email: newMemberEmail.trim(), password: newMemberPassword },
      });
      if (res.error || res.data?.error) {
        toast({ title: 'Error', description: res.data?.error || res.error?.message || 'Failed to create member', variant: 'destructive' });
      } else {
        toast({ title: 'Member Created', description: `${newMemberName} can now log in with their email and password.` });
        setNewMemberName(''); setNewMemberEmail(''); setNewMemberPassword('');
        setAddMemberOpen(false);
        queryClient.invalidateQueries({ queryKey: ['admin_users'] });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setAddingMember(false);
  };

  const pending = users.filter((u: any) => !u.approved);
  const approved = users.filter((u: any) => u.approved);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin Control Center</h1>
        <p className="text-sm text-muted-foreground">Manage members, settings, and room configuration.</p>
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="virtual">Virtual Members</TabsTrigger>
          <TabsTrigger value="groceries">Groceries</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-4 space-y-4">
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

          {/* Add Member Button */}
          <div className="flex justify-end">
            <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><UserPlus className="w-4 h-4 mr-1" />Add Member</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add New Member</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Create a member account. They can log in directly with these credentials.</p>
                  <div className="space-y-2"><Label>Name</Label><Input value={newMemberName} onChange={e => setNewMemberName(e.target.value)} placeholder="Full name" /></div>
                  <div className="space-y-2"><Label>Email</Label><Input type="email" value={newMemberEmail} onChange={e => setNewMemberEmail(e.target.value)} placeholder="email@example.com" /></div>
                  <div className="space-y-2"><Label>Password</Label><Input type="password" value={newMemberPassword} onChange={e => setNewMemberPassword(e.target.value)} placeholder="Min 6 characters" /></div>
                  <Button className="w-full" onClick={addMember} disabled={addingMember || !newMemberName.trim() || !newMemberEmail.trim() || newMemberPassword.length < 6}>
                    {addingMember ? 'Creating...' : 'Create Member'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

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
                        <div className="flex gap-1 mt-1">
                          {(u as any).deactivated && <Badge variant="destructive" className="text-[10px]">Deactivated</Badge>}
                          {(u as any).view_only && <Badge variant="outline" className="text-[10px]">View-Only</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => openLimitsDialog(u)}>
                              <Settings2 className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Set Contribution Limits</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant={!(u as any).deactivated ? "ghost" : "default"}
                              size="icon"
                              className={!(u as any).deactivated ? "text-destructive hover:bg-destructive/10" : ""}
                              onClick={() => toggleDeactivated(u, !(u as any).deactivated)}
                            >
                              <Ban className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{(u as any).deactivated ? 'Activate' : 'Deactivate'}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant={!(u as any).view_only ? "ghost" : "default"}
                              size="icon"
                              onClick={() => toggleViewOnly(u, !(u as any).view_only)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{(u as any).view_only ? 'Grant Full Access' : 'Set View-Only'}</TooltipContent>
                        </Tooltip>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10">
                              <UserMinus className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove {u.name}?</AlertDialogTitle>
                              <AlertDialogDescription>This will remove the member from your room.</AlertDialogDescription>
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
        </TabsContent>

        <TabsContent value="virtual" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />Virtual Roommates
              </CardTitle>
              <Dialog open={addVirtualOpen} onOpenChange={setAddVirtualOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><UserPlus className="w-4 h-4 mr-1" />Add Virtual Member</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Virtual Roommate</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">Virtual roommates don't have login accounts but appear in contributions and expense splits.</p>
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input value={virtualName} onChange={e => setVirtualName(e.target.value)} placeholder="Enter name" />
                    </div>
                    <Button className="w-full" onClick={addVirtualMember} disabled={!virtualName.trim()}>Add Member</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {virtualMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No virtual members. Add one for roommates who don't use the app.</p>
              ) : (
                <div className="space-y-3">
                  {virtualMembers.map((v: any) => (
                    <div key={v.id} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                      <div>
                        <p className="font-medium text-foreground">{v.name}</p>
                        <Badge variant="outline" className="text-[10px]">Virtual</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => openLimitsDialog({ id: v.id, name: v.name, user_id: v.id })}>
                              <Settings2 className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Set Contribution Limits</TooltipContent>
                        </Tooltip>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10">
                              <UserMinus className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove {v.name}?</AlertDialogTitle>
                              <AlertDialogDescription>This virtual member will be removed from the room.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => removeVirtualMember(v.id, v.name)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove</AlertDialogAction>
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
        </TabsContent>

        <TabsContent value="groceries" className="mt-4 space-y-4">
          <GroceryManager />
        </TabsContent>

        <TabsContent value="settings" className="mt-4 space-y-4">
          {/* Daily Food Budget */}
          <Card>
            <CardHeader><CardTitle className="text-base">Daily Food Budget Limit</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">Current limit: <span className="font-bold text-foreground">₹{currentBudget}</span>.</p>
              <div className="flex items-center gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">New Limit (₹)</Label>
                  <Input type="number" className="w-32" placeholder={String(currentBudget)} value={budgetInput} onChange={e => setBudgetInput(e.target.value)} />
                </div>
                <Button size="sm" className="mt-5" onClick={saveBudget}>
                  <Save className="w-3 h-3 mr-1" />Save
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Per-Day Daily Limits */}
          <DayWiseLimits profileId={profile?.id} />

          {/* Monthly Budget Target */}
          <MonthlyBudgetTarget profileId={profile?.id} />

          {/* Admin Contribution Toggle */}
          <Card>
            <CardHeader><CardTitle className="text-base">Admin Contributions</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground font-medium">Enable Admin Contributions</p>
                  <p className="text-xs text-muted-foreground">When disabled, the Admin cannot add contributions for themselves.</p>
                </div>
                <Switch checked={adminContribEnabled} onCheckedChange={toggleAdminContrib} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Contribution Limits Dialog */}
      <Dialog open={limitsOpen} onOpenChange={setLimitsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Contribution Limits: {limitsForUser?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Set the contribution amount for each term.</p>
            {[1, 2, 3].map(term => (
              <div key={term} className="flex items-center justify-between gap-3">
                <Label className="text-sm whitespace-nowrap">Term {term}</Label>
                <Input
                  type="number"
                  className="w-32"
                  value={termLimits[term]}
                  onChange={e => setTermLimits(prev => ({ ...prev, [term]: e.target.value }))}
                  placeholder="500"
                />
              </div>
            ))}
            <Button className="w-full" onClick={saveLimits}>Save Limits</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminControlCenter;
