import { consumeLoginNotice, setLoginNotice } from './loginNotice';

describe('loginNotice', () => {
  it('stores a notice and consumes it only once', () => {
    setLoginNotice('hola');

    expect(consumeLoginNotice()).toBe('hola');
    expect(consumeLoginNotice()).toBeNull();
  });

  it('returns null when nothing was stored', () => {
    expect(consumeLoginNotice()).toBeNull();
  });

  it('keeps only the latest notice', () => {
    setLoginNotice('primero');
    setLoginNotice('segundo');

    expect(consumeLoginNotice()).toBe('segundo');
  });
});
