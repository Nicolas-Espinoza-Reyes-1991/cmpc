import { randomBytes } from 'node:crypto';
import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../audit/audit.service';
import type { AuditActor } from '../audit/audit.types';
import { UsersService, type UserSummary } from '../users/users.service';
import { PasswordHasher } from './password-hasher';

/** Name of the entity in the audit trail. */
const AUDIT_ENTITY = 'User';

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
    private readonly audit: AuditService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyHash = await this.hasher.hash(randomBytes(32).toString('hex'));
  }

  /**
   * `actor` only brings the ip: who is logging in is decided here. Every
   * outcome writes exactly one audit entry, also for an unknown email, so the
   * time taken does not tell which emails exist (G3.4). The email that was
   * typed is never stored (G3.3).
   */
  async login(
    email: string,
    password: string,
    actor: AuditActor,
  ): Promise<LoginResult> {
    const user = await this.users.findByEmail(email);

    // One verification in every case, so the work done does not depend on the email.
    const matches = await this.hasher.verify(
      user ? user.passwordHash : this.dummyHash,
      password,
    );
    // `!user` is redundant (the dummy hash never matches) but makes the rule explicit.
    if (!user || !matches) {
      await this.audit.logBestEffort({
        action: 'LOGIN_FAILED',
        entity: AUDIT_ENTITY,
        entityId: user?.id ?? null,
        actor: { userId: user?.id ?? null, ip: actor.ip },
      });
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    // Only the id travels in the token: it is readable by the client (A2.1).
    const accessToken = await this.jwt.signAsync({ sub: user.id });
    const { exp } = this.jwt.decode<{ exp: number }>(accessToken);

    await this.audit.logBestEffort({
      action: 'LOGIN_SUCCESS',
      entity: AUDIT_ENTITY,
      entityId: user.id,
      actor: { userId: user.id, ip: actor.ip },
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresAt: new Date(exp * 1000).toISOString(),
      user: { id: user.id, email: user.email },
    };
  }
}
