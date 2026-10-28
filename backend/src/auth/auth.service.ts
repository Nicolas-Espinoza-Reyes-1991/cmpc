import { randomBytes } from 'node:crypto';
import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService, type UserSummary } from '../users/users.service';
import { PasswordHasher } from './password-hasher';

/** Same message for an unknown email and a wrong password (A1.2). */
const INVALID_CREDENTIALS = 'Invalid credentials';

export interface LoginResult {
  accessToken: string;
  tokenType: 'Bearer';
  /** ISO 8601 moment the token stops being valid. */
  expiresAt: string;
  user: UserSummary;
}

@Injectable()
export class AuthService implements OnModuleInit {
  /**
   * A real hash of a random password nobody knows. When the email does not
   * exist, the submitted password is checked against it so that answering costs
   * as much as for an existing user and the response time does not reveal
   * which emails are registered (A1.3). Built at startup: if argon2 is broken
   * the application should fail to boot, not fail on the first unknown email.
   */
  private dummyHash!: string;

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly hasher: PasswordHasher,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyHash = await this.hasher.hash(randomBytes(32).toString('hex'));
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.users.findByEmail(email);

    // One verification in every case, so the work done does not depend on the email.
    const matches = await this.hasher.verify(
      user ? user.passwordHash : this.dummyHash,
      password,
    );
    // `!user` is redundant (the dummy hash never matches) but makes the rule explicit.
    if (!user || !matches) throw new UnauthorizedException(INVALID_CREDENTIALS);

    // Only the id travels in the token: it is readable by the client (A2.1).
    const accessToken = await this.jwt.signAsync({ sub: user.id });
    const { exp } = this.jwt.decode<{ exp: number }>(accessToken);

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresAt: new Date(exp * 1000).toISOString(),
      user: { id: user.id, email: user.email },
    };
  }
}
