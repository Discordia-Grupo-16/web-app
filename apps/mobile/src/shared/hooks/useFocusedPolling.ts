import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

// The default is the old polling for screens that nothing pushes. Screens that get realtime notices
// (see useLiveRefresh) keep it as a slow safety net instead.
export const POLL_INTERVAL_MS = 5000;

// Polls while the screen is focused and the app is active. Also runs once on focus (e.g. coming back).
export const useFocusedPolling = (tick: () => void, intervalMs = POLL_INTERVAL_MS) => {
  const tickRef = useRef(tick);
  useEffect(() => {
    tickRef.current = tick;
  });

  useFocusEffect(useCallback(() => {
    const run = () => {
      if (AppState.currentState === 'active') tickRef.current();
    };
    run();
    const interval = setInterval(run, intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]));
};
