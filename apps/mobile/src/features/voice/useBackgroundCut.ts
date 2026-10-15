import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

export interface BackgroundCutOptions {
  inCall: boolean;
  /** Calls disconnectWithReason('app_backgrounded'). */
  cut: () => void;
}

export interface BackgroundCut {
  /** Runs a system permission prompt without the trip to the background cutting the call. */
  runWithPermissionPrompt: <T>(request: () => Promise<T>) => Promise<T>;
}

// Leaving the app cuts the call, and coming back does not reconnect it. Only 'background' counts, like the
// realtime socket: 'inactive' also fires for system dialogs. A permission dialog may still send the app to
// the background on some Android versions, so while one is open the change is ignored.
export const useBackgroundCut = ({ inCall, cut }: BackgroundCutOptions): BackgroundCut => {
  const promptsOpen = useRef(0);
  const latest = useRef({ inCall, cut });

  useEffect(() => {
    latest.current = { inCall, cut };
  }, [inCall, cut]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'background' || promptsOpen.current > 0) return;
      if (latest.current.inCall) latest.current.cut();
    });
    return () => sub.remove();
  }, []);

  const runWithPermissionPrompt = useCallback(async <T,>(request: () => Promise<T>): Promise<T> => {
    promptsOpen.current += 1;
    try {
      return await request();
    } finally {
      promptsOpen.current -= 1;
    }
  }, []);

  return { runWithPermissionPrompt };
};
