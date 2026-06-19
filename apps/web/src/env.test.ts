import { getServerEnv, getClientEnv } from './env';

describe('env', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });
  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns server env with api gateway url', () => {
    process.env.API_GATEWAY_URL = 'http://api.example.test';
    const env = getServerEnv();
    expect(env.apiGatewayUrl).toBe('http://api.example.test');
  });

  it('falls back to localhost in dev when not set', () => {
    delete process.env.API_GATEWAY_URL;
    const env = getServerEnv();
    expect(env.apiGatewayUrl).toContain('localhost');
  });

  it('exposes NEXT_PUBLIC_API_URL to the client', () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';
    const env = getClientEnv();
    expect(env.apiBaseUrl).toBe('https://api.example.com');
  });
});
