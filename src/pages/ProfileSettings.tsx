import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const ProfileSettings = () => {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [dailyLimit, setDailyLimit] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setMobileNumber((profile as any).mobile_number || '');
    }
  }, [profile]);

  // Fetch personal_daily_limit
  const fetchLimit = async () => {
    if (!profile) return;
    const { data } = await supabase.from('profiles').select('personal_daily_limit').eq('id', profile.id).single();
    if (data) setDailyLimit(String((data as any).personal_daily_limit || 0));
  };

  useEffect(() => { fetchLimit(); }, [profile]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase.from('profiles')
      .update({ name, mobile_number: mobileNumber, personal_daily_limit: Number(dailyLimit) || 0 } as any)
      .eq('id', profile.id);
    setSaving(false);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    await refreshProfile();
    toast({ title: 'Profile Updated' });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground">Profile Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Edit Profile</CardTitle>
          <CardDescription>Update your name, contact details, and daily spending limit</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={profile?.email || ''} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Mobile Number (with country code, e.g. +91...)</Label>
              <Input value={mobileNumber} onChange={e => setMobileNumber(e.target.value)} placeholder="+919876543210" />
            </div>
            <div className="space-y-2">
              <Label>Daily Spending Limit (₹) — Personal Wallet</Label>
              <Input type="number" value={dailyLimit} onChange={e => setDailyLimit(e.target.value)} placeholder="0 = no limit" />
              <p className="text-xs text-muted-foreground">Set to 0 to disable. If set, your dashboard will show today's spending in red when exceeded.</p>
            </div>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfileSettings;
