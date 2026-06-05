import RootPage from './page';

describe('RootPage', () => {
  it('is a redirect-only server component (exports a function)', () => {
    expect(typeof RootPage).toBe('function');
  });
});
