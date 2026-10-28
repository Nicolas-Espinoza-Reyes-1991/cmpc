import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Thin wrapper over argon2 so the rest of the code depends on an injectable
 * class instead of a native module, and tests can replace it. It uses argon2's
 * default parameters, the same ones the seed uses, so every hash in the system
 * costs the same to verify.
 */
@Injectable()
export class PasswordHasher {
  hash(plain: string): Promise<string> {
    return argon2.hash(plain);
  }

  verify(hash: string, plain: string): Promise<boolean> {
    return argon2.verify(hash, plain);
  }
}
