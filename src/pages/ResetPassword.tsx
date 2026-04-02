import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

const ResetPassword = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Check for recovery event from the URL hash
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');

    if (type === 'recovery' && accessToken) {
      // Set the session from the recovery tokens
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken || '',
      }).then(({ error }) => {
        if (error) {
          setStatus('error');
          setErrorMsg(error.message || 'Invalid or expired reset link. Please request a new one.');
        } else {
          setStatus('ready');
        }
      });
    } else {
      // Also listen for auth state change (Supabase may auto-handle the token)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setStatus('ready');
        }
      });

      // Give it a moment, then check if we have a session
      const timer = setTimeout(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            setStatus('ready');
          } else if (status === 'loading') {
            setStatus('error');
            setErrorMsg('Invalid or expired reset link. Please request a new one.');
          }
        });
      }, 2000);

      return () => {
        subscription.unsubscribe();
        clearTimeout(timer);
      };
    }
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: 'Error', description: 'Passwords do not match.', variant: 'destructive' });
      return;
    }
    if (password.length < 6) {
      toast({ title: 'Error', description: 'Password must be at least 6 characters.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (error) {
      if (error.message.includes('same')) {
        toast({ title: 'Error', description: 'New password must be different from the old one.', variant: 'destructive' });
      } else {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
      return;
    }

    setStatus('success');
    toast({ title: 'Password Updated', description: 'Your password has been reset successfully.' });
    // Sign out so they can log in fresh
    await supabase.auth.signOut();
    setTimeout(() => navigate('/login'), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link to="/" className="text-lg font-bold font-['Space_Grotesk'] text-foreground mb-2 block">RoomExpense</Link>
          <CardTitle>Reset Password</CardTitle>
          <CardDescription>Enter your new password below</CardDescription>
        </CardHeader>
        <CardContent>
          {status === 'loading' && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Verifying reset link...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center space-y-4">
              <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
              <p className="text-sm text-muted-foreground">{errorMsg}</p>
              <Link to="/forgot-password">
                <Button variant="outline" className="w-full">Request New Reset Link</Button>
              </Link>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-[hsl(var(--success))] mx-auto" />
              <p className="text-sm text-muted-foreground">Password updated! Redirecting to login...</p>
            </div>
          )}

          {status === 'ready' && (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="At least 6 characters" />
              </div>
              <div className="space-y-2">
                <Label>Confirm Password</Label>
                <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} placeholder="Re-enter password" />
              </div>
              <Button className="w-full" type="submit" disabled={submitting}>
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Update Password
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
