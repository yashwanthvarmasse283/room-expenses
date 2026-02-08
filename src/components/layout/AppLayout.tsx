import { AppSidebar } from './AppSidebar';
import { Outlet } from 'react-router-dom';

export const AppLayout = () => (
  <div className="flex min-h-screen">
    <AppSidebar />
    <main className="flex-1 lg:p-6 p-4 pt-20 lg:pt-6 overflow-x-hidden">
      <Outlet />
    </main>
  </div>
);
