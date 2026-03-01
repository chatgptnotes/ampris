import { Link } from 'react-router-dom';
import {
  Zap, Monitor, Shield, Activity, Database, Wifi,
  ArrowRight, Network, Bell, BarChart3, Globe,
  ChevronRight
} from 'lucide-react';
import FeatureCard from '@/components/public/FeatureCard';
import StatsSection from '@/components/public/StatsSection';
import DigitalTwinHero from '@/components/public/DigitalTwinHero';

const features = [
  {
    icon: Network,
    title: 'Interactive SLD Viewer',
    description: 'Real-time single-line diagrams with SVG-based equipment components. Click to control breakers, view measurements, and monitor substation topology.',
    color: 'blue',
  },
  {
    icon: Activity,
    title: 'Live Telemetry',
    description: 'Millisecond-resolution voltage, current, and power measurements streamed via WebSocket. 2-second refresh for continuous monitoring.',
    color: 'green',
  },
  {
    icon: Bell,
    title: 'Alarm Management',
    description: 'Priority-based alarm system with acknowledgment workflow. Overcurrent, earth fault, and protection relay event handling.',
    color: 'red',
  },
  {
    icon: Shield,
    title: 'RBAC Security',
    description: 'Role-based access control with JWT authentication. Operator, engineer, and admin roles with audit logging.',
    color: 'purple',
  },
  {
    icon: Database,
    title: 'Historical Trends',
    description: 'TimescaleDB-backed trend analysis with configurable time ranges. Export data for post-event analysis.',
    color: 'orange',
  },
  {
    icon: Wifi,
    title: 'Multi-Protocol',
    description: 'Modbus, DNP3, and IEC 61850 protocol adapters. Connect to any RTU/IED in your distribution network.',
    color: 'indigo',
  },
];

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-50" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
            {/* Left: Text content */}
            <div className="flex-1 max-w-xl">
              <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-sm mb-6 backdrop-blur">
                <Zap className="w-4 h-4 text-yellow-300" />
                <span>Next-Generation SCADA Platform</span>
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
                Smart Distribution
                <br />
                <span className="text-blue-200">Substation Monitoring</span>
              </h1>
              <p className="text-lg text-blue-100 mb-8 leading-relaxed">
                GridVision delivers real-time SCADA visualization, control, and analytics
                for 33/11kV distribution substations. Built with modern web technology
                and industrial-grade reliability.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  to="/demo"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white text-blue-700 font-semibold rounded-xl hover:bg-blue-50 transition-colors shadow-lg"
                >
                  <Monitor className="w-5 h-5" />
                  Try Live Demo
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/docs"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-colors backdrop-blur border border-white/20"
                >
                  Get Started
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Right: Digital Twin Visualization */}
            <div className="flex-1 w-full lg:w-auto hidden md:block animate-fade-in">
              <DigitalTwinHero />
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <StatsSection />

      {/* Features */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Complete SCADA Solution
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Everything you need to monitor, control, and analyze your distribution
              substation — from live SLD visualization to historical trend analysis.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </div>
      </section>

      {/* Demo teaser */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-2xl p-8 md:p-12 text-white flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1">
              <h2 className="text-2xl md:text-3xl font-bold mb-4">
                See It In Action
              </h2>
              <p className="text-blue-100 mb-6 leading-relaxed">
                Our interactive demo features a complete 33/11kV substation with
                2 power transformers, 6 outgoing feeders, simulated measurements,
                and random trip events. No backend required — runs entirely in your browser.
              </p>
              <Link
                to="/demo"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-blue-700 font-semibold rounded-xl hover:bg-blue-50 transition-colors"
              >
                <Globe className="w-5 h-5" />
                Launch Interactive Demo
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="w-full md:w-80 h-48 bg-white/10 rounded-xl flex items-center justify-center border border-white/20 backdrop-blur">
              <div className="text-center">
                <BarChart3 className="w-12 h-12 mx-auto mb-2 text-blue-200" />
                <p className="text-sm text-blue-200">33/11kV SLD Preview</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto text-center px-4">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-gray-600 mb-8">
            GridVision is open-source and free to deploy. Get your substation
            monitoring system up and running in minutes with Docker.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/downloads"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
            >
              Download Now
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/docs"
              className="inline-flex items-center gap-2 px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:border-blue-300 hover:text-blue-700 transition-colors"
            >
              Read the Docs
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
