import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { NavLink } from '@/components/NavLink';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import {
  LayoutDashboard, Receipt, PiggyBank, MessageSquare, BarChart3,
  Settings, LogOut, Menu, Sun, Moon, Wallet, Users
} from 'lucide-react';
import { useState } from 'react';

const adminLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/room-expenses', label: 'Room Expenses', icon: Receipt },
  { to: '/purse', label: 'Purse / Wallet', icon: Wallet },
  { to: '/manage-users', label: 'Manage Users', icon: Users },
  { to: '/messages', label: 'Messages', icon: MessageSquare },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const userLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/room-expenses', label: 'Room Expenses', icon: Receipt },
  { to: '/personal-expenses', label: 'Personal Expenses', icon: PiggyBank },
  { to: '/messages', label: 'Messages', icon: MessageSquare },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export const AppSidebar = () => {
  const { profile, role, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const links = role === 'admin' ? adminLinks : userLinks;

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-sidebar-border">
        <h2 className="text-lg font-bold tracking-tight text-sidebar-foreground font-['Space_Grotesk']">
          RoomExpense
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5 capitalize">{role} · {profile?.name}</p>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {links.map(l => (
          <NavLink
            key={l.to}
            to={l.to}
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
            activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
          >
            <l.icon className="w-4 h-4" />
            {l.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-sidebar-border space-y-1">
        <button onClick={toggle} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
          {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {dark ? 'Light Mode' : 'Dark Mode'}
        </button>
        <button onClick={logout} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors">
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:flex w-64 border-r border-sidebar-border bg-sidebar flex-col h-screen sticky top-0">
        <NavContent />
      </aside>
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-sidebar border-b border-sidebar-border px-4 py-3 flex items-center justify-between">
        <h2 className="text-base font-bold text-sidebar-foreground font-['Space_Grotesk']">RoomExpense</h2>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon"><Menu className="w-5 h-5" /></Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64 bg-sidebar">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <NavContent />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
};
