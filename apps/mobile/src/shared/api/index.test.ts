import { ownershipSource, userService } from '@/shared/api';
import { sessionExpiry } from '@/shared/session/sessionExpiry';

describe('shared api wiring', () => {
  it('drops the public profile cache when the session expires', () => {
    const clear = jest.spyOn(userService, 'clearPublicProfiles');

    sessionExpiry.notify();

    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('hands the ownership hooks every method they read', () => {
    const methods = [
      'getServerTransfer',
      'proposeTransfer',
      'cancelTransfer',
      'acceptTransfer',
      'rejectTransfer',
      'listMyTransfers',
      'getServer',
      'getServers',
    ] as const;

    for (const method of methods) expect(typeof ownershipSource[method]).toBe('function');
  });
});
