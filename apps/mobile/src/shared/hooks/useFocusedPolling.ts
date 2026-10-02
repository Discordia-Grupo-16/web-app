import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

// Chat doesn't push server or channel changes over the socket, so screens that list them poll
// while they are focused and the app is active. Also runs once on focus (e.g. coming back).
export const POLL_INTERVAL_MS = 5000;

export const useFocusedPolling = (tick: () => void) => {
  const tickRef = useRef(tick);
  useEffect(() => {
    tickRef.current = tick;
  });

  useFocusEffect(useCallback(() => {
    const run = () => {
      if (AppState.currentState === 'active') tickRef.current();
    };
    run();
    const interval = setInterval(run, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []));
};
