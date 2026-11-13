import AsyncStorage from '@react-native-async-storage/async-storage';
import { dismissedRejections } from './dismissedRejections';

describe('dismissedRejections (mobile)', () => {
  afterEach(() => AsyncStorage.clear());

  it('has nothing for a server where no rejection was closed', async () => {
    await expect(dismissedRejections.get('srv')).resolves.toBeNull();
  });

  it('keeps the closed rejection in AsyncStorage, separately for each server', async () => {
    await dismissedRejections.set('srv', '2026-11-05T10:00:00Z');

    // What survives closing the app is what AsyncStorage has, not what the module keeps in memory.
    const keys = await AsyncStorage.getAllKeys();
    const saved = await AsyncStorage.multiGet(keys);
    expect(saved.map(([, value]) => value)).toEqual(['2026-11-05T10:00:00Z']);
    await expect(dismissedRejections.get('srv')).resolves.toBe('2026-11-05T10:00:00Z');
    await expect(dismissedRejections.get('other')).resolves.toBeNull();
  });

  it('keeps only the last rejection closed in a server', async () => {
    await dismissedRejections.set('srv', '2026-11-05T10:00:00Z');
    await dismissedRejections.set('srv', '2026-11-06T09:00:00Z');

    await expect(dismissedRejections.get('srv')).resolves.toBe('2026-11-06T09:00:00Z');
  });
});
