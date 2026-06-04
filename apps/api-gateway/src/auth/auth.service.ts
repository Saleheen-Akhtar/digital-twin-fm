import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

// MVP-only hardcoded admin. Will be replaced with a Users table in Phase 2.
const MVP_USERS = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'admin@dtfm.local',
    password: 'admin123', // MVP-only; replaced with bcrypt + DB lookup later
    role: 'admin',
  },
];

@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService) {}

  async login(email: string, password: string): Promise<string> {
    const user = MVP_USERS.find((u) => u.email === email && u.password === password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.jwt.signAsync({ sub: user.id, email: user.email, role: user.role });
  }
}
