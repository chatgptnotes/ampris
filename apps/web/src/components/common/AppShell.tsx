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
      <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-200 dark:border-gray-700">
        <a href="https://drmhope.com" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">drmhope.com</a> | A Bettroi Product
      </footer>
      <AlarmStatusBar />
      <AlarmBanner />
      <SessionTimeoutWarning />
    </div>
  );
}
