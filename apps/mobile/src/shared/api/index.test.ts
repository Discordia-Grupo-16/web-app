import { userService } from '@/shared/api';
import { sessionExpiry } from '@/shared/session/sessionExpiry';

describe('shared api wiring', () => {
  it('drops the public profile cache when the session expires', () => {
    const clear = jest.spyOn(userService, 'clearPublicProfiles');

    sessionExpiry.notify();

    expect(clear).toHaveBeenCalledTimes(1);
  });
});
