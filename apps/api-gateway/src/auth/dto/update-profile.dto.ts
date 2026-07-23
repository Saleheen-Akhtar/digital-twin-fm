import { IsOptional, IsString, MaxLength, Matches } from 'class-validator';

/**
 * DTO for PATCH /auth/me.
 *
 * Security constraints:
 * - displayName is optional (partial update)
 * - max 64 chars (reasonable for a display name)
 * - must match printable Unicode letters, digits, spaces, hyphens, apostrophes, periods only
 *   (prevents XSS, control characters, HTML/script injection)
 * - sanitisation (stripping leading/trailing whitespace) is done server-side in AuthService
 */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[\p{L}\p{N} _.\-']+$/u, {
    message: 'displayName may only contain letters, numbers, spaces, hyphens, apostrophes, and periods',
  })
  displayName?: string;
}
