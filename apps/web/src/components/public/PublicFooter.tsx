import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';

const footerLinks = {
  Product: [
    { label: 'Features', path: '/features' },
    { label: 'Live Demo', path: '/demo' },
    { label: 'Downloads', path: '/downloads' },
    { label: 'SLD Generator', path: '/generate' },
  ],
  Resources: [
    { label: 'Documentation', path: '/docs' },
    { label: 'Installation Guide', path: '/docs' },
    { label: 'API Reference', path: '/docs' },
  ],
  Company: [
    { label: 'About', path: '/contact' },
    { label: 'Contact', path: '/contact' },
    { label: 'GitHub', path: 'https://github.com/gridvision' },
  ],
};

export default function PublicFooter() {
  return (
    <footer className="bg-gray-900 text-gray-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-6 h-6 text-blue-500" />
              <span className="text-lg font-bold">
                <span className="text-blue-500">Grid</span>
                <span className="text-white">Vision</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed">
              Next-generation SCADA platform for smart distribution substation monitoring and control.
            </p>
            <p className="text-xs mt-3 text-gray-500">
              MSEDCL Smart Distribution Initiative
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h3 className="text-white font-semibold text-sm mb-3">{title}</h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    {link.path.startsWith('http') ? (
                      <a
                        href={link.path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm hover:text-white transition-colors"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link to={link.path} className="text-sm hover:text-white transition-colors">
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs">&copy; {new Date().getFullYear()} GridVision SCADA. All rights reserved.</p>
          <p className="text-xs text-gray-500">Built for MSEDCL Smart Distribution Substations</p>
        </div>
      </div>
    </footer>
  );
}
