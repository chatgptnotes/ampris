import type { LucideIcon } from 'lucide-react';
import { Download, ExternalLink } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
  version?: string;
  size?: string;
  available?: boolean;
  href?: string;
  downloadFile?: boolean;
  buttonLabel?: string;
}

export default function DownloadCard({ icon: Icon, title, description, version, size, available = false, href, downloadFile, buttonLabel }: Props) {
  const label = buttonLabel || (downloadFile ? 'Download' : 'View');
  const LinkIcon = downloadFile ? Download : ExternalLink;

  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-6 transition-all ${available ? 'hover:shadow-lg' : 'opacity-75'}`}>
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
          <Icon className="w-6 h-6 text-blue-600" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900">{title}</h3>
            {!available && (
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 rounded-full">
                COMING SOON
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mb-3">{description}</p>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            {version && <span>v{version}</span>}
            {size && <span>{size}</span>}
          </div>
        </div>
      </div>
      {available && href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          {...(downloadFile ? { download: '' } : {})}
          className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <LinkIcon className="w-4 h-4" />
          {label}
        </a>
      ) : (
        <button
          disabled
          className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-400 text-sm font-medium rounded-lg cursor-not-allowed"
        >
          Coming Soon
        </button>
      )}
    </div>
  );
}
