import { createBrowserRouter } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import AppShell from '@/components/common/AppShell';
import PublicLayout from '@/components/public/PublicLayout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import SLDView from '@/pages/SLDView';
import Alarms from '@/pages/Alarms';
import Trends from '@/pages/Trends';
import Events from '@/pages/Events';
import Reports from '@/pages/Reports';
import Analytics from '@/pages/Analytics';
import AuditLog from '@/pages/AuditLog';
import Settings from '@/pages/Settings';
import ControlPanel from '@/pages/ControlPanel';
import SLDGenerator from '@/pages/SLDGenerator';
import HomePage from '@/pages/public/HomePage';
import FeaturesPage from '@/pages/public/FeaturesPage';
import DemoPage from '@/pages/public/DemoPage';
import DownloadsPage from '@/pages/public/DownloadsPage';
import DocumentationPage from '@/pages/public/DocumentationPage';
import ContactPage from '@/pages/public/ContactPage';

export const router = createBrowserRouter([
  // Public pages with light theme
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/features', element: <FeaturesPage /> },
      { path: '/demo', element: <DemoPage /> },
      { path: '/downloads', element: <DownloadsPage /> },
      { path: '/docs', element: <DocumentationPage /> },
      { path: '/contact', element: <ContactPage /> },
    ],
  },
  // Standalone pages (dark theme, no public layout)
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/generate',
    element: <SLDGenerator />,
  },
  // Protected SCADA app pages (dark theme)
  {
    path: '/app',
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: 'sld', element: <SLDView /> },
          { path: 'sld/:substationId', element: <SLDView /> },
          { path: 'alarms', element: <Alarms /> },
          { path: 'trends', element: <Trends /> },
          { path: 'events', element: <Events /> },
          { path: 'reports', element: <Reports /> },
          { path: 'analytics', element: <Analytics /> },
          { path: 'control', element: <ControlPanel /> },
          { path: 'audit', element: <AuditLog /> },
          { path: 'settings', element: <Settings /> },
        ],
      },
    ],
  },
]);
