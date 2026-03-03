import { Link, NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';

const navLinks = [
  { path: '/', label: 'Home' },
  { path: '/features', label: 'Features' },
  { path: '/demo', label: 'Live Demo' },
  { path: '/downloads', label: 'Downloads' },
  { path: '/docs', label: 'Documentation' },
  { path: '/contact', label: 'Contact' },
];

export default function PublicNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <img src="/gridvision-logo.jpg" alt="GridVision" className="h-12 w-12 rounded object-cover" />
            <span className="text-2xl font-bold">
              <span className="text-[#1B3054]">Grid</span>
              <span className="text-[#2DB8C4]">Vision</span>
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                end={link.path === '/'}
                className={({ isActive }) =>
                  clsx(
                    'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'text-[#2DB8C4] bg-gridvision-teal-light border-b-2 border-[#2DB8C4]'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </div>

          {/* CTA buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/generate"
              className="px-4 py-2 text-sm font-medium text-[#1B3054] border border-[#1B3054] rounded-lg hover:bg-[#1B3054] hover:text-white transition-colors"
            >
              SLD Generator
            </Link>
            <Link
              to="/login"
              className="px-4 py-2 text-sm font-medium text-white bg-[#2DB8C4] rounded-lg hover:bg-[#259DA8] transition-colors"
            >
              Login
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 text-gray-600 hover:text-gray-900"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-gray-200 px-4 py-3 space-y-1">
          {navLinks.map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              end={link.path === '/'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                clsx(
                  'block px-3 py-2 rounded-lg text-sm font-medium',
                  isActive ? 'text-[#2DB8C4] bg-gridvision-teal-light' : 'text-gray-600 hover:bg-gray-100',
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
          <div className="pt-3 border-t border-gray-200 flex gap-2">
            <Link
              to="/generate"
              onClick={() => setMobileOpen(false)}
              className="flex-1 text-center px-4 py-2 text-sm font-medium text-[#1B3054] border border-[#1B3054] rounded-lg"
            >
              SLD Generator
            </Link>
            <Link
              to="/login"
              onClick={() => setMobileOpen(false)}
              className="flex-1 text-center px-4 py-2 text-sm font-medium text-white bg-[#2DB8C4] rounded-lg"
            >
              Login
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}