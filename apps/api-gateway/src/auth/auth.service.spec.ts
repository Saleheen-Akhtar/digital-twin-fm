import { Test } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '../config/config.module';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    process.env.MVP_ADMIN_EMAIL = 'admin@dtfm.local';
    process.env.MVP_ADMIN_PASSWORD = 'admin123';

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule,
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '15m' },
        }),
      ],
      providers: [AuthService],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  afterEach(() => {
    delete process.env.MVP_ADMIN_EMAIL;
    delete process.env.MVP_ADMIN_PASSWORD;
  });

  it('returns a token for valid credentials', async () => {
    const token = await service.login('admin@dtfm.local', 'admin123');
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);
  });

  it('throws for invalid password', async () => {
    await expect(
      service.login('admin@dtfm.local', 'wrong-password'),
    ).rejects.toThrow();
  });

  it('throws for invalid email', async () => {
    await expect(
      service.login('not-an-admin@dtfm.local', 'admin123'),
    ).rejects.toThrow();
  });
});
