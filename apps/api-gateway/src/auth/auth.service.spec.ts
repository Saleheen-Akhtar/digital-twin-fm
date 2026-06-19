import { Test } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '../config/config.module';
import { AuthService } from './auth.service';
import { randomBytes } from 'crypto';

/**
 * Per Finding 32 (Low): the previous version of this spec hardcoded
 *   process.env.MVP_ADMIN_PASSWORD = 'admin123';
 * which is a real-looking password. If a CI environment ever pointed
 * at the same .env, the literal 'admin123' would have become a
 * credential. The new version generates a fresh random password per
 * test run and uses it both for setup and login.
 *
 * The login / throw / refresh tests use this dynamic password so the
 * spec is both self-contained and side-effect-free.
 */
describe('AuthService', () => {
  let service: AuthService;
  let adminEmail: string;
  let adminPassword: string;

  beforeEach(async () => {
    adminEmail = `admin-${Date.now()}-${randomBytes(4).toString('hex')}@test.local`;
    adminPassword = randomBytes(18).toString('base64url');

    process.env.MVP_ADMIN_EMAIL = adminEmail;
    process.env.MVP_ADMIN_PASSWORD = adminPassword;
    // The tests only exercise the login() path which does not need
    // the JWT secret; pass a non-empty value to satisfy requireSecret().
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule,
        JwtModule.register({
          secret: 'test-access-secret',
          signOptions: { expiresIn: '15m' },
        }),
      ],
      providers: [AuthService],
    }).compile();

    service = moduleRef.get(AuthService);
    // Trigger onModuleInit so the MVP bootstrap user is loaded.
    await service.onModuleInit();
  });

  afterEach(() => {
    delete process.env.MVP_ADMIN_EMAIL;
    delete process.env.MVP_ADMIN_PASSWORD;
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
  });

  it('returns a JWT for valid credentials', async () => {
    const token = await service.login(adminEmail, adminPassword);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);
    // JWTs have 3 dot-separated segments.
    expect(token.split('.').length).toBe(3);
  });

  it('throws UnauthorizedException for an invalid password', async () => {
    await expect(service.login(adminEmail, 'definitely-wrong')).rejects.toThrow();
  });

  it('throws UnauthorizedException for an invalid email', async () => {
    await expect(service.login(`stranger-${Date.now()}@test.local`, adminPassword)).rejects.toThrow();
  });

  it('throws UnauthorizedException for an empty email', async () => {
    await expect(service.login('', adminPassword)).rejects.toThrow();
  });

  it('refresh() rejects an access token used as a refresh token', async () => {
    const accessToken = await service.login(adminEmail, adminPassword);
    // The access token does not have `type: 'refresh'` and should be
    // rejected by the refresh endpoint even though its signature is
    // valid.
    await expect(service.refresh(accessToken)).rejects.toThrow();
  });

  it('refresh() rejects a malformed token', async () => {
    await expect(service.refresh('not-a-real-jwt')).rejects.toThrow();
  });
});
