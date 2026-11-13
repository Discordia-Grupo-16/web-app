import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface ServerHeaderProps {
    title: string;
    /** Buttons next to the title. The chevron only shows when there are actions. */
    actions?: ReactNode;
    bannerUrl?: string | null;
    iconUrl?: string | null;
}

export const ServerHeader = ({ title, actions, bannerUrl, iconUrl }: ServerHeaderProps) => (
    <div>
        {bannerUrl && (
            <div style={{ height: 72, overflow: 'hidden' }}>
                <img
                    src={bannerUrl}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
            </div>
        )}
        <div
            className="flex items-center justify-between px-4 py-3 shadow-md cursor-pointer select-none"
            style={{ minHeight: 48, borderBottom: '1px solid #202225' }}
        >
            <div className="flex items-center gap-2 min-w-0">
                {iconUrl && (
                    <img
                        src={iconUrl}
                        alt=""
                        style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0 }}
                    />
                )}
                <span className="font-bold text-sm text-white truncate">{title}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                {actions}
                {actions && <ChevronDown size={16} style={{ color: '#99aab5' }} />}
            </div>
        </div>
    </div>
);
