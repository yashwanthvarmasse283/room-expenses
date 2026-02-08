import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AppUser, UserRole } from '@/lib/types';
import { storage } from '@/lib/storage';
import { v4 as uuid } from 'uuid';

interface AuthContextType {
  user: AppUser | null;
  login: (email: string, password: string) => string | null;
  signupAdmin: (name: string, email: string, password: string) => string | null;
  signupUser: (name: string, email: string, password: string, adminId: string) => string | null;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(storage.getCurrentUser());

  useEffect(() => {
    storage.setCurrentUser(user);
  }, [user]);

  const login = useCallback((email: string, password: string): string | null => {
    const users = storage.getUsers();
    const found = users.find(u => u.email === email && u.password === password);
    if (!found) return 'Invalid email or password';
    if (found.role === 'user' && !found.approved) return 'Your account is pending admin approval';
    setUser(found);
    return null;
  }, []);

  const signupAdmin = useCallback((name: string, email: string, password: string): string | null => {
    const users = storage.getUsers();
    if (users.find(u => u.email === email)) return 'Email already exists';
    const newUser: AppUser = {
      id: uuid().slice(0, 8).toUpperCase(),
      name, email, password, role: 'admin', approved: true,
      createdAt: new Date().toISOString(),
    };
    storage.setUsers([...users, newUser]);
    setUser(newUser);
    return null;
  }, []);

  const signupUser = useCallback((name: string, email: string, password: string, adminId: string): string | null => {
    const users = storage.getUsers();
    if (users.find(u => u.email === email)) return 'Email already exists';
    const admin = users.find(u => u.role === 'admin' && u.id === adminId);
    if (!admin) return 'Invalid Admin ID';
    const newUser: AppUser = {
      id: uuid().slice(0, 8).toUpperCase(),
      name, email, password, role: 'user', adminId, approved: false,
      createdAt: new Date().toISOString(),
    };
    storage.setUsers([...users, newUser]);
    return null;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, signupAdmin, signupUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
