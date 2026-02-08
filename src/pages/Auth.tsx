import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

const Auth = () => {
  const location = window.location.pathname;
  const isSignup = location === '/signup';
  const navigate = useNavigate();
  const { login, signupAdmin, signupUser } = useAuth();
  const { toast } = useToast();

  // Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // Signup
  const [role, setRole] = useState<'admin' | 'user'>('admin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [adminId, setAdminId] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const err = login(loginEmail, loginPass);
    if (err) { toast({ title: 'Error', description: err, variant: 'destructive' }); return; }
    navigate('/dashboard');
  };

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    let err: string | null;
    if (role === 'admin') {
      err = signupAdmin(name, email, pass);
      if (!err) { navigate('/dashboard'); return; }
    } else {
      err = signupUser(name, email, pass, adminId);
      if (!err) {
        toast({ title: 'Request Sent', description: 'Wait for admin approval before logging in.' });
        setName(''); setEmail(''); setPass(''); setAdminId('');
        return;
      }
    }
    if (err) toast({ title: 'Error', description: err, variant: 'destructive' });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link to="/" className="text-lg font-bold font-['Space_Grotesk'] text-foreground mb-2 block">RoomExpense</Link>
          <CardTitle>{isSignup ? 'Create Account' : 'Welcome Back'}</CardTitle>
          <CardDescription>{isSignup ? 'Sign up to get started' : 'Sign in to your account'}</CardDescription>
        </CardHeader>
        <CardContent>
          {!isSignup ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required /></div>
              <div className="space-y-2"><Label>Password</Label><Input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} required /></div>
              <Button className="w-full" type="submit">Sign In</Button>
              <p className="text-center text-sm text-muted-foreground">Don't have an account? <Link to="/signup" className="text-primary font-medium">Sign Up</Link></p>
            </form>
          ) : (
            <div className="space-y-4">
              <Tabs value={role} onValueChange={v => setRole(v as any)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="admin">Admin</TabsTrigger>
                  <TabsTrigger value="user">User</TabsTrigger>
                </TabsList>
              </Tabs>
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
                <div className="space-y-2"><Label>Password</Label><Input type="password" value={pass} onChange={e => setPass(e.target.value)} required /></div>
                {role === 'user' && (
                  <div className="space-y-2"><Label>Admin ID</Label><Input placeholder="Enter admin's unique ID" value={adminId} onChange={e => setAdminId(e.target.value)} required /></div>
                )}
                <Button className="w-full" type="submit">{role === 'admin' ? 'Create Admin Account' : 'Request Access'}</Button>
                <p className="text-center text-sm text-muted-foreground">Already have an account? <Link to="/login" className="text-primary font-medium">Sign In</Link></p>
              </form>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
