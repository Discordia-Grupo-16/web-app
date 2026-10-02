import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface ServerHeaderProps {
    title: string;
    /** Buttons next to the title. The chevron only shows when there are actions. */
    actions?: ReactNode;
}

export const ServerHeader = ({ title, actions }: ServerHeaderProps) => (
    <div
        className="flex items-center justify-between px-4 py-3 shadow-md cursor-pointer select-none"
        style={{ minHeight: 48, borderBottom: '1px solid #202225' }}
    >
        <span className="font-bold text-sm text-white truncate">{title}</span>
        <div className="flex items-center gap-2 shrink-0">
            {actions}
            {actions && <ChevronDown size={16} style={{ color: '#99aab5' }} />}
        </div>
    </div>
);
