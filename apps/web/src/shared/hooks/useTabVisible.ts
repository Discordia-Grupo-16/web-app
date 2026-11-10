import { useEffect, useState } from 'react';

const isVisible = () => document.visibilityState === 'visible';

/**
 * Whether the tab is in front. A channel open in a tab in the background is not being read, so
 * what arrives there stays unread until the user comes back.
 */
export const useTabVisible = (): boolean => {
    const [visible, setVisible] = useState(isVisible);
    useEffect(() => {
        const onChange = () => setVisible(isVisible());
        document.addEventListener('visibilitychange', onChange);
        return () => document.removeEventListener('visibilitychange', onChange);
    }, []);
    return visible;
};
