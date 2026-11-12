import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

/**
 * Whether the screen is in front of the user: focused in the stack and the app in the foreground.
 * A channel left open underneath another screen, or with the phone locked, is not being read, so
 * what arrives there stays unread until the user comes back.
 */
export const useScreenVisible = (): boolean => {
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));

  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => setAppActive(next === 'active'));
    return () => sub.remove();
  }, []);

  return focused && appActive;
};
