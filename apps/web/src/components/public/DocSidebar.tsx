import clsx from 'clsx';

interface Section {
  id: string;
  label: string;
}

interface Props {
  sections: Section[];
  activeSection: string;
  onSectionClick: (id: string) => void;
}

export default function DocSidebar({ sections, activeSection, onSectionClick }: Props) {
  return (
    <nav className="w-56 shrink-0 hidden lg:block">
      <div className="sticky top-24 space-y-1">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          On this page
        </h3>
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => onSectionClick(section.id)}
            className={clsx(
              'block w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors',
              activeSection === section.id
                ? 'text-blue-600 bg-blue-50 font-medium'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
            )}
          >
            {section.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
