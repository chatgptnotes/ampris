import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Network, Bell, TrendingUp, List, FileText, Settings } from 'lucide-react';
import { useAlarmStore } from '@/stores/alarmStore';
import clsx from 'clsx';

const navItems = [
  { path: '/app', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/app/sld', icon: Network, label: 'SLD' },
  { path: '/app/alarms', icon: Bell, label: 'Alarms' },
  { path: '/app/trends', icon: TrendingUp, label: 'Trends' },
  { path: '/app/events', icon: List, label: 'Events' },
  { path: '/app/reports', icon: FileText, label: 'Reports' },
  { path: '/app/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const alarmTotal = useAlarmStore((s) => s.summary.total);

  return (
    <aside className="w-16 bg-scada-panel border-r border-scada-border flex flex-col items-center py-3 gap-1 shrink-0">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/app'}
          className={({ isActive }) =>
            clsx(
              'relative flex flex-col items-center justify-center w-12 h-12 rounded-lg text-xs gap-0.5 transition-colors',
              isActive
                ? 'bg-scada-accent/20 text-scada-accent'
                : 'text-gray-400 hover:text-white hover:bg-scada-border/30',
            )
          }
        >
          <item.icon className="w-5 h-5" />
          <span className="text-[10px] leading-none">{item.label}</span>
          {item.path === '/app/alarms' && alarmTotal > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-scada-danger text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
              {alarmTotal > 9 ? '9+' : alarmTotal}
            </span>
          )}
        </NavLink>
      ))}
    </aside>
  );
}
