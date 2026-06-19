import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Public } from './jwt-auth.guard';
import { LoginDto, RefreshDto } from './dto/login.dto';

@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * Per Finding 6 (High): the login endpoint is the primary credential-
   * stuffing target. Override both global buckets with tight per-route
   * limits: 5 requests / 60 seconds / user (OWASP brute-force floor).
   *
   * The auth bucket was removed from forRoot() because it was
   * globally rate-limiting ALL non-GET endpoints (PATCH /alerts/:id,
   * POST /work-orders, etc.) — see app.module.ts for rationale.
   */
  @Throttle({ burst: { limit: 5, ttl: 60_000 }, sustained: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginDto) {
    const accessToken = await this.auth.login(body.email, body.password);
    return { accessToken };
  }

  /**
   * Per Finding 10 (High, partial): the previous implementation loaded
   * `JWT_REFRESH_SECRET` and `JWT_REFRESH_TTL` from config but never
   * used them. The new endpoint:
   *
   *   1. Accepts a refresh token in the request body.
   *   2. Verifies the signature, audience, and issuer.
   *   3. Confirms the token carries a `type: 'refresh'` claim (so an
   *      access token cannot be traded for a fresh pair).
   *   4. Issues a new access token (and a new refresh token, rotating
   *      the refresh-token value on every use — i.e. refresh-token
   *      rotation, which is the OWASP-recommended behavior).
   *
   * The old refresh token is invalidated implicitly: a new one is
   * issued and the client should drop the old one. A future Redis
   * jti-blocklist can revoke specific tokens before their TTL.
   */
  @Throttle({ burst: { limit: 30, ttl: 60_000 }, sustained: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: RefreshDto) {
    const { accessToken, refreshToken } = await this.auth.refresh(body.refreshToken);
    return { accessToken, refreshToken };
  }
}
