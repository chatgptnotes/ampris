import {
  Network, Activity, Bell, Shield, Database, Wifi,
  Monitor, Cpu, Layers, FileText, Settings, BarChart3,
  Zap, Lock, Globe, Code
} from 'lucide-react';
import FeatureCard from '@/components/public/FeatureCard';

const categories = [
  {
    title: 'Visualization & Control',
    description: 'Real-time monitoring with interactive SVG diagrams',
    features: [
      {
        icon: Network,
        title: 'Single Line Diagrams',
        description: 'Auto-generated SVG-based SLDs with 10+ equipment components. Support for 33/11kV and 132/33kV layouts with live status indication.',
        color: 'blue',
      },
      {
        icon: Monitor,
        title: 'Real-Time Dashboard',
        description: 'Comprehensive overview with parameter cards, power factor gauges, load distribution charts, and substation status summary.',
        color: 'blue',
      },
      {
        icon: Zap,
        title: 'Equipment Control',
        description: 'Remote circuit breaker operations with SBO (Select-Before-Operate) protocol, command confirmation dialogs, and interlocking.',
        color: 'blue',
      },
    ],
  },
  {
    title: 'Data & Analytics',
    description: 'Historical data storage and trend analysis',
    features: [
      {
        icon: BarChart3,
        title: 'Trend Analysis',
        description: 'TimescaleDB-backed historical trends with configurable time ranges. Zoom, pan, and overlay multiple parameters.',
        color: 'green',
      },
      {
        icon: Database,
        title: 'Event Logging',
        description: 'Complete audit trail of all operations, state changes, alarms, and control commands with timestamped records.',
        color: 'green',
      },
      {
        icon: FileText,
        title: 'Report Generation',
        description: 'Automated daily, weekly, and monthly reports. Export to PDF with substation performance metrics and event summaries.',
        color: 'green',
      },
    ],
  },
  {
    title: 'Alarm Management',
    description: 'Priority-based alert system with workflows',
    features: [
      {
        icon: Bell,
        title: 'Priority-Based Alarms',
        description: 'Four-level priority system (Critical, High, Medium, Low) with audio notifications, visual indicators, and escalation rules.',
        color: 'red',
      },
      {
        icon: Activity,
        title: 'Real-Time Notifications',
        description: 'WebSocket-pushed alarm events with alarm banner, status bar indicators, and browser notifications for critical alerts.',
        color: 'red',
      },
      {
        icon: Settings,
        title: 'Alarm Configuration',
        description: 'Configurable alarm setpoints, deadbands, and shelving. Group alarms by equipment, feeder, or protection type.',
        color: 'red',
      },
    ],
  },
  {
    title: 'Architecture & Security',
    description: 'Enterprise-grade infrastructure',
    features: [
      {
        icon: Shield,
        title: 'Role-Based Access',
        description: 'JWT authentication with role-based permissions (Admin, Engineer, Operator). All actions are audited and logged.',
        color: 'purple',
      },
      {
        icon: Wifi,
        title: 'Protocol Support',
        description: 'Native adapters for Modbus TCP/RTU, DNP3, and IEC 61850 (MMS/GOOSE). Simulator adapter for development and testing.',
        color: 'purple',
      },
      {
        icon: Layers,
        title: 'Modern Stack',
        description: 'React + TypeScript frontend, Express + Socket.IO backend, PostgreSQL + TimescaleDB + Redis. Docker deployment ready.',
        color: 'purple',
      },
      {
        icon: Cpu,
        title: 'Edge Computing',
        description: 'Designed to run on industrial PCs at the substation level. Offline-capable with data sync when connectivity is restored.',
        color: 'purple',
      },
      {
        icon: Lock,
        title: 'Secure by Design',
        description: 'Helmet security headers, CORS policies, rate limiting, encrypted credentials, and SQL injection prevention via Prisma ORM.',
        color: 'purple',
      },
      {
        icon: Globe,
        title: 'Web-Based Access',
        description: 'Access from any modern browser — no plugins required. Responsive design works on tablets for field operators.',
        color: 'purple',
      },
      {
        icon: Code,
        title: 'Open Source',
        description: 'Fully open-source with MIT license. Extensible architecture for custom equipment types, protocols, and analytics.',
        color: 'purple',
      },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Features</h1>
          <p className="text-gray-600 max-w-2xl mx-auto text-lg">
            GridVision provides a complete SCADA solution for distribution substation
            monitoring, control, and analysis.
          </p>
        </div>

        {/* Categories */}
        <div className="space-y-16">
          {categories.map((category) => (
            <div key={category.title}>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900">{category.title}</h2>
                <p className="text-gray-500 mt-1">{category.description}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {category.features.map((feature) => (
                  <FeatureCard key={feature.title} {...feature} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
