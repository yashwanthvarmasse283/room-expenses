import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'admin' | 'user';

export interface Profile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  admin_code: string | null;
  admin_id: string | null;
  approved: boolean;
  avatar_url: string | null;
  mobile_number: string | null;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  signupAdmin: (name: string, email: string, password: string, mobileNumber: string) => Promise<string | null>;
  signupUser: (name: string, email: string, password: string, adminCode: string, mobileNumber: string) => Promise<string | null>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    setProfile(profileData as Profile | null);

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();
    
    setRole((roleData?.role as AppRole) ?? null);
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRole(null);
        }
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user]);

  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    return null;
  }, []);

  const signupAdmin = useCallback(async (name: string, email: string, password: string, mobileNumber: string): Promise<string | null> => {
    const redirectUrl = `${window.location.origin}/`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { name },
      },
    });
    if (error) return error.message;
    if (!data.user) return 'Signup failed';

    const adminCode = data.user.id.slice(0, 8).toUpperCase();

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ name, admin_code: adminCode, approved: true, mobile_number: mobileNumber })
      .eq('user_id', data.user.id);
    if (profileError) return profileError.message;

    // Assign admin role
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({ user_id: data.user.id, role: 'admin' });
    if (roleError) return roleError.message;

    await fetchProfile(data.user.id);
    return null;
  }, []);

  const signupUser = useCallback(async (name: string, email: string, password: string, adminCode: string, mobileNumber: string): Promise<string | null> => {
    const { data: adminProfile, error: adminError } = await supabase
      .from('profiles')
      .select('id')
      .eq('admin_code', adminCode.toUpperCase())
      .maybeSingle();
    
    if (adminError || !adminProfile) return 'Invalid Admin ID';

    const redirectUrl = `${window.location.origin}/`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { name },
      },
    });
    if (error) return error.message;
    if (!data.user) return 'Signup failed';

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ name, admin_id: adminProfile.id, approved: false, mobile_number: mobileNumber })
      .eq('user_id', data.user.id);
    if (profileError) return profileError.message;

    // Assign user role
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({ user_id: data.user.id, role: 'user' });
    if (roleError) return roleError.message;

    // Sign out since they need approval
    await supabase.auth.signOut();
    return null;
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, profile, role, loading, login, signupAdmin, signupUser, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
