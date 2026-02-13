import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AppLayout } from "@/components/layout/AppLayout";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import RoomExpenses from "./pages/RoomExpenses";
import PersonalExpenses from "./pages/PersonalExpenses";
import Purse from "./pages/Purse";
import AdminControlCenter from "./pages/AdminControlCenter";
import Messages from "./pages/Messages";
import RoomChat from "./pages/RoomChat";
import NoticeBoard from "./pages/NoticeBoard";
import Analytics from "./pages/Analytics";
import SettingsPage from "./pages/SettingsPage";
import ProfileSettings from "./pages/ProfileSettings";
import NotFound from "./pages/NotFound";
import Contributions from "./pages/Contributions";
import RecurringBills from "./pages/RecurringBills";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children, adminOnly }: { children: React.ReactNode; adminOnly?: boolean }) => {
  const { user, role, loading, profile } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role === 'user' && !profile?.approved) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 text-center">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-2">Pending Approval</h2>
        <p className="text-muted-foreground">Your account is waiting for admin approval. Please check back later.</p>
      </div>
    </div>
  );
  if (adminOnly && role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
    <Route path="/login" element={<PublicRoute><Auth /></PublicRoute>} />
    <Route path="/signup" element={<PublicRoute><Auth /></PublicRoute>} />
    <Route path="/forgot-password" element={<ForgotPassword />} />
    <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/room-expenses" element={<RoomExpenses />} />
      <Route path="/personal-expenses" element={<PersonalExpenses />} />
      <Route path="/purse" element={<Purse />} />
      <Route path="/admin-control" element={<ProtectedRoute adminOnly><AdminControlCenter /></ProtectedRoute>} />
      <Route path="/messages" element={<Messages />} />
      <Route path="/room-chat" element={<RoomChat />} />
      <Route path="/notice-board" element={<NoticeBoard />} />
      <Route path="/contributions" element={<Contributions />} />
      <Route path="/recurring-bills" element={<RecurringBills />} />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/profile-settings" element={<ProfileSettings />} />
    </Route>
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
