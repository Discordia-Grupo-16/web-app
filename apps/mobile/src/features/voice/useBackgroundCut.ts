export interface BackgroundCutOptions {
  inCall: boolean;
  /** Calls disconnectWithReason('app_backgrounded'). */
  cut: () => void;
}

export interface BackgroundCut {
  /** Runs a system permission prompt without the trip to the background cutting the call. */
  runWithPermissionPrompt: <T>(request: () => Promise<T>) => Promise<T>;
}

// Provisional body: it never cuts the call.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const useBackgroundCut = (options: BackgroundCutOptions): BackgroundCut => ({
  runWithPermissionPrompt: (request) => request(),
});
