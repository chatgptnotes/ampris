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
import SetupWizard from '@/pages/SetupWizard';
import ConnectionManager from '@/pages/ConnectionManager';
import ComponentLibrary from '@/pages/ComponentLibrary';
import SLDGenerator from '@/pages/SLDGenerator';
import ProjectHub from '@/pages/ProjectHub';
import MimicEditor from '@/pages/MimicEditor';
import MimicViewer from '@/pages/MimicViewer';
import ProjectMembers from '@/pages/ProjectMembers';
import TagManager from '@/pages/TagManager';
import TagTestPanel from '@/pages/TagTestPanel';
import AILoadForecasting from '@/pages/AILoadForecasting';
import AIEquipmentHealth from '@/pages/AIEquipmentHealth';
import AIPredictiveMaintenance from '@/pages/AIPredictiveMaintenance';
import AIPowerQuality from '@/pages/AIPowerQuality';
import AIOperationsCenter from '@/pages/AIOperationsCenter';
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
          { path: 'projects', element: <ProjectHub /> },
          { path: 'projects/:projectId', element: <MimicViewer /> },
          { path: 'projects/:projectId/edit', element: <MimicEditor /> },
          { path: 'projects/:projectId/edit/:pageId', element: <MimicEditor /> },
          { path: 'projects/:projectId/members', element: <ProjectMembers /> },
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
          { path: 'setup', element: <SetupWizard /> },
          { path: 'connections', element: <ConnectionManager /> },
          { path: 'components', element: <ComponentLibrary /> },
          { path: 'tags', element: <TagManager /> },
          { path: 'tag-test', element: <TagTestPanel /> },
          { path: 'ai/load-forecast', element: <AILoadForecasting /> },
          { path: 'ai/equipment-health', element: <AIEquipmentHealth /> },
          { path: 'ai/maintenance', element: <AIPredictiveMaintenance /> },
          { path: 'ai/power-quality', element: <AIPowerQuality /> },
          { path: 'ai/ops-center', element: <AIOperationsCenter /> },
        ],
      },
    ],
  },
]);
