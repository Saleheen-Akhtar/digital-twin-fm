import { Body, Controller, Get, Header, HttpCode, HttpStatus, Logger, Patch, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Public } from './jwt-auth.guard';
import { LoginDto, RefreshDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Public()
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly auth: AuthService) {}

  /**
   * Per Finding 6 (High): the login endpoint is the primary credential-
   * stuffing target. Override both global buckets with tight per-route
   * limits: 5 requests / 60 seconds / user (OWASP brute-force floor).
   */
  @Throttle({ burst: { limit: 5, ttl: 60_000 }, sustained: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginDto) {
    const accessToken = await this.auth.login(body.email, body.password);
    return { accessToken };
  }

  @Throttle({ burst: { limit: 30, ttl: 60_000 }, sustained: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: RefreshDto) {
    const { accessToken, refreshToken } = await this.auth.refresh(body.refreshToken);
    return { accessToken, refreshToken };
  }

  /**
   * GET /auth/me — returns the authenticated user's profile.
   *
   * Security:
   * - No-Cache headers prevent proxies / CDNs from caching PII.
   * - Authenticated via the proxy's JWT gate (see ./jwt-auth.guard.ts).
   */
  @Get('me')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @Header('Surrogate-Control', 'no-store')
  @HttpCode(HttpStatus.OK)
  async getProfile() {
    return this.auth.getProfile();
  }

  /**
   * PATCH /auth/me — updates the current user's profile.
   *
   * Rate limited (20 req / 60s). Input validated & sanitised via UpdateProfileDto.
   * On displayName change the JWT is re-issued so downstream consumers and the
   * session cookie carry the fresh value.
   */
  @Throttle({ burst: { limit: 20, ttl: 60_000 }, sustained: { limit: 20, ttl: 60_000 } })
  @Patch('me')
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @Req() req: { user: { id: string; email: string; role: string; displayName: string } },
    @Body() body: UpdateProfileDto,
  ) {
    const oldName = req.user.displayName;
    const result = await this.auth.updateProfile(body.displayName);
    this.logger.log(`Profile updated: user=${req.user.email} displayName="${oldName}" → "${result.displayName}"`);
    return result;
  }
}
