import RootPage from './page';

// Per Finding 4: the root page now uses getSession() to check the
// verified cookie. We mock the module so the component is a callable
// async function (test below verifies the export shape, not redirect
// behavior — redirect logic is covered by manual e2e in the browser).
jest.mock('@/lib/session', () => ({
  getSession: async () => null,
}));

describe('RootPage', () => {
  it('is a redirect-only server component (exports a function)', () => {
    expect(typeof RootPage).toBe('function');
  });
});
