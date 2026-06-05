import { createApiClient } from './api-client';

describe('api-client', () => {
  it('returns ok for a healthy server', async () => {
    const client = createApiClient({ baseUrl: 'http://example.test' });
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok' }),
    });
    const result = await client.health({ fetch: fetchMock as unknown as typeof fetch });
    expect(result).toEqual({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalledWith('http://example.test/health', expect.any(Object));
  });

  it('returns an access token on successful login', async () => {
    const client = createApiClient({ baseUrl: 'http://example.test' });
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ accessToken: 'jwt' }),
    });
    const token = await client.login(
      { email: 'admin@dtfm.local', password: 'p' },
      { fetch: fetchMock as unknown as typeof fetch },
    );
    expect(token).toBe('jwt');
  });

  it('throws on 401 from login', async () => {
    const client = createApiClient({ baseUrl: 'http://example.test' });
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Unauthorized' }),
    });
    await expect(
      client.login(
        { email: 'a', password: 'b' },
        { fetch: fetchMock as unknown as typeof fetch },
      ),
    ).rejects.toThrow();
  });
});
