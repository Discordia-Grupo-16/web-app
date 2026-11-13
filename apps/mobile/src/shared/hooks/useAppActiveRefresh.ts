import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/**
 * Calls `tick` when the app comes back to 'active' and every `intervalMs` while it is active.
 *
 * Unlike useFocusedPolling it does not depend on a screen being focused: it is for what lives above
 * the screens, such as the ownership banner of the layout.
 */
export const useAppActiveRefresh = (tick: () => void, intervalMs: number) => {
  const tickRef = useRef(tick);
  useEffect(() => {
    tickRef.current = tick;
  });

  useEffect(() => {
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') tickRef.current();
    }, intervalMs);
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') tickRef.current();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [intervalMs]);
};
