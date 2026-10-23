import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { InviteModal } from './InviteModal';

export const InviteButton = ({ serverId }: { serverId: string }) => {
    const [showInvite, setShowInvite] = useState(false);

    return (
        <>
            <button
                onClick={() => setShowInvite(true)}
                title="Invitar personas"
                className="p-1 rounded transition-colors"
                style={{ color: '#99aab5' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#dcddde')}
                onMouseLeave={e => (e.currentTarget.style.color = '#99aab5')}
            >
                <UserPlus size={16} />
            </button>

            {showInvite && (
                <InviteModal
                    serverId={serverId}
                    onClose={() => setShowInvite(false)}
                />
            )}
        </>
    );
};
