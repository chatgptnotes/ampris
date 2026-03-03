import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import AlarmStatusBar from './AlarmStatusBar';
import AlarmBanner from '../AlarmBanner';
import SessionTimeoutWarning from './SessionTimeoutWarning';
import { useWebSocket } from '@/hooks/useWebSocket';

export default function AppShell() {
  useWebSocket();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="h-screen flex flex-col overflow-hidden scada-dark">
      <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 overflow-auto p-2 sm:p-4 bg-scada-bg">
          <Outlet />
        </main>
      </div>
      <AlarmStatusBar />
      <AlarmBanner />
      <SessionTimeoutWarning />
    </div>
  );
}
