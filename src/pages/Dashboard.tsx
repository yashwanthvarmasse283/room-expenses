import { useAuth } from '@/contexts/AuthContext';
import AdminDashboard from './AdminDashboard';
import UserDashboard from './UserDashboard';

const Dashboard = () => {
  const { role } = useAuth();
  return role === 'admin' ? <AdminDashboard /> : <UserDashboard />;
};

export default Dashboard;
