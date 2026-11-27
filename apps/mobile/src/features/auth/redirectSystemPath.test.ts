import { redirectSystemPath } from './redirectSystemPath';

const redirect = 'com.discordia.mobile:/oauthredirect?code=abc&state=xyz';

describe('redirectSystemPath', () => {
  it('keeps the Google redirect away from the router while the app is waiting for it', () => {
    expect(redirectSystemPath({ path: redirect, initial: false })).toBe('');
  });

  it('starts at the root when the Google redirect is what opened the app', () => {
    expect(redirectSystemPath({ path: redirect, initial: true })).toBe('/');
  });

  it('leaves every other link as it came', () => {
    const invite = 'discordia://invite/abc123';

    expect(redirectSystemPath({ path: invite, initial: false })).toBe(invite);
    expect(redirectSystemPath({ path: invite, initial: true })).toBe(invite);
  });
});
