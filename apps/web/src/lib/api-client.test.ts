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

  it('fetches buildings list', async () => {
    const client = createApiClient({ baseUrl: 'http://example.test' });
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ id: 'b1', name: 'Hall 7', totalFloors: 5, createdAt: 'x', updatedAt: 'x' }],
    });
    const result = await client.findBuildings({ fetch: fetchMock as unknown as typeof fetch });
    expect(result).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith('http://example.test/buildings', expect.any(Object));
  });

  it('fetches assets with filter', async () => {
    const client = createApiClient({ baseUrl: 'http://example.test' });
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });
    await client.findAssets({ buildingId: 'b1', status: 'critical' }, { fetch: fetchMock as unknown as typeof fetch });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('buildingId=b1'),
      expect.any(Object),
    );
  });

  it('fetches sensor readings with limit', async () => {
    const client = createApiClient({ baseUrl: 'http://example.test' });
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });
    await client.findReadings('s1', { limit: 5 }, { fetch: fetchMock as unknown as typeof fetch });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://example.test/sensors/s1/readings?limit=5',
      expect.any(Object),
    );
  });

  it('fetches alerts with filter', async () => {
    const client = createApiClient({ baseUrl: 'http://example.test' });
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });
    await client.findAlerts({ status: 'open' }, { fetch: fetchMock as unknown as typeof fetch });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('status=open'),
      expect.any(Object),
    );
  });
});
