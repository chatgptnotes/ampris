import { Link } from 'react-router-dom';
import {
  Zap, Monitor, Shield, Activity, Database, Wifi,
  ArrowRight, Network, Bell, BarChart3, Globe,
  ChevronRight, CheckCircle
} from 'lucide-react';
import FeatureCard from '@/components/public/FeatureCard';
import StatsSection from '@/components/public/StatsSection';

const features = [
  {
    icon: Network,
    title: 'Interactive SLD Viewer',
    description: 'Real-time single-line diagrams with SVG-based equipment components. Click to control breakers, view measurements, and monitor substation topology.',
    color: 'teal',
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
    color: 'navy',
  },
];

const workSteps = [
  {
    number: '1',
    title: 'Connect RTUs',
    description: 'Configure Modbus/DNP3/IEC 61850 communication with your substation equipment.',
  },
  {
    number: '2',
    title: 'Design SLD',
    description: 'Use our drag-drop SLD editor to create single-line diagrams matching your substation.',
  },
  {
    number: '3',
    title: 'Monitor Live',
    description: 'Real-time monitoring, control operations, and alarm management from any device.',
  },
];

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
            {/* Left: Text content */}
            <div className="flex-1 max-w-xl">
              <div className="inline-flex items-center gap-2 bg-gridvision-teal-light rounded-full px-4 py-1.5 text-sm mb-6 border border-[#2DB8C4]/20">
                <Zap className="w-4 h-4 text-[#2DB8C4]" />
                <span className="text-[#1B3054]">Next-Generation SCADA Platform</span>
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6 text-[#1B3054]">
                Smart Distribution
                <br />
                Substation Monitoring
              </h1>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                GridVision delivers real-time SCADA visualization, control, and analytics
                for 33/11kV distribution substations. Built with modern web technology
                and industrial-grade reliability.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  to="/demo"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#2DB8C4] text-white font-semibold rounded-xl hover:bg-[#259DA8] transition-colors shadow-lg"
                >
                  <Monitor className="w-5 h-5" />
                  Try Live Demo
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/docs"
                  className="inline-flex items-center gap-2 px-6 py-3 border-2 border-[#1B3054] text-[#1B3054] font-semibold rounded-xl hover:bg-[#1B3054] hover:text-white transition-colors"
                >
                  Get Started
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Right: Logo as hero image */}
            <div className="flex-1 w-full lg:w-auto flex justify-center">
              <div className="relative">
                <img 
                  src="/gridvision-logo.jpg" 
                  alt="GridVision SCADA" 
                  className="w-80 h-80 object-contain rounded-2xl shadow-2xl"
                />
                <div className="absolute -inset-4 bg-gradient-to-r from-[#1B3054] to-[#2DB8C4] rounded-3xl blur-2xl opacity-20"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <StatsSection />

      {/* Features */}
      <section className="py-20 bg-gridvision-teal-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-[#1B3054] mb-4">
              Complete SCADA Solution
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Everything you need to monitor, control, and analyze your distribution
              substation — from live SLD visualization to historical trend analysis.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-white/50"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-[#2DB8C4]/10 rounded-lg flex items-center justify-center">
                    <feature.icon className="w-6 h-6 text-[#2DB8C4]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[#1B3054] mb-2">{feature.title}</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-[#1B3054] mb-4">
              How It Works
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Get your substation monitoring system up and running in three simple steps.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {workSteps.map((step, index) => (
              <div key={step.number} className="text-center relative">
                <div className="w-16 h-16 bg-[#2DB8C4] text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-6">
                  {step.number}
                </div>
                <h3 className="text-lg font-semibold text-[#1B3054] mb-3">{step.title}</h3>
                <p className="text-gray-600">{step.description}</p>
                {index < workSteps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-full w-full">
                    <ArrowRight className="w-6 h-6 text-gray-300 mx-auto -ml-3" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo teaser */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-[#1B3054] to-[#2DB8C4] rounded-2xl p-8 md:p-12 text-white flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1">
              <h2 className="text-2xl md:text-3xl font-bold mb-4">
                See It In Action
              </h2>
              <p className="text-gray-100 mb-6 leading-relaxed">
                Our interactive demo features a complete 33/11kV substation with
                2 power transformers, 6 outgoing feeders, simulated measurements,
                and random trip events. No backend required — runs entirely in your browser.
              </p>
              <Link
                to="/demo"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[#1B3054] font-semibold rounded-xl hover:bg-gray-100 transition-colors"
              >
                <Globe className="w-5 h-5" />
                Launch Interactive Demo
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="w-full md:w-80 h-48 bg-white/10 rounded-xl flex items-center justify-center border border-white/20 backdrop-blur">
              <div className="text-center">
                <BarChart3 className="w-12 h-12 mx-auto mb-2 text-gray-200" />
                <p className="text-sm text-gray-200">33/11kV SLD Preview</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto text-center px-4">
          <h2 className="text-3xl font-bold text-[#1B3054] mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-gray-600 mb-8">
            GridVision is open-source and free to deploy. Get your substation
            monitoring system up and running in minutes with Docker.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/downloads"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#2DB8C4] text-white font-semibold rounded-xl hover:bg-[#259DA8] transition-colors"
            >
              Download Now
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/docs"
              className="inline-flex items-center gap-2 px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:border-[#2DB8C4] hover:text-[#2DB8C4] transition-colors"
            >
              Read the Docs
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}