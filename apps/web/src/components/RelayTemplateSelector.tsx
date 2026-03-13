import { useState, useEffect } from 'react';
import { Shield, ChevronDown, Check } from 'lucide-react';
import axios from 'axios';

interface RelayTemplate {
  model: string;
  manufacturer: string;
  series: string;
  description: string;
  defaultPort: number;
  defaultSlaveId: number;
  registerCount: number;
  categories: { measurement: number; protection: number; status: number; energy: number };
}

interface Props {
  value: string;
  onChange: (model: string) => void;
  disabled?: boolean;
}

export default function RelayTemplateSelector({ value, onChange, disabled }: Props) {
  const [templates, setTemplates] = useState<RelayTemplate[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    axios.get('/api/relay-explorer/templates')
      .then(({ data }) => setTemplates(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const selected = templates.find(t => t.model === value);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen(!open)}
        className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-left text-sm flex items-center justify-between focus:border-cyan-500 focus:outline-none disabled:opacity-50"
      >
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-cyan-400" />
          <span className={selected ? 'text-white' : 'text-gray-500'}>
            {selected ? `${selected.model} — ${selected.description}` : 'Select relay template...'}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-gray-800 border border-gray-600 rounded-lg shadow-xl max-h-64 overflow-y-auto">
          {templates.map((t) => (
            <button
              key={t.model}
              type="button"
              onClick={() => { onChange(t.model); setOpen(false); }}
              className={`w-full px-3 py-2.5 text-left text-sm hover:bg-gray-700 flex items-center justify-between border-b border-gray-700/50 last:border-0 ${
                value === t.model ? 'bg-cyan-500/10' : ''
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">{t.model}</span>
                  <span className="text-gray-500 text-xs">({t.series} series)</span>
                </div>
                <p className="text-gray-400 text-xs mt-0.5">{t.description}</p>
                <div className="flex gap-2 mt-1">
                  <span className="text-xs bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded">{t.categories.measurement} meas</span>
                  <span className="text-xs bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded">{t.categories.protection} prot</span>
                  <span className="text-xs bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded">{t.categories.energy} energy</span>
                </div>
              </div>
              {value === t.model && <Check className="w-4 h-4 text-cyan-400 flex-shrink-0" />}
            </button>
          ))}
          {templates.length === 0 && !loading && (
            <div className="px-3 py-4 text-gray-500 text-sm text-center">No templates available</div>
          )}
        </div>
      )}
    </div>
  );
}
