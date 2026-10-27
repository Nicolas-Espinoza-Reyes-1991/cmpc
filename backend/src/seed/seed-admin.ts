import * as argon2 from 'argon2';
import Joi from 'joi';

/** Minimal slice of PrismaClient the seed needs; keeps it easy to fake in tests. */
export interface SeedClient {
  user: {
    upsert(args: {
      where: { email: string };
      update: Record<string, never>;
      create: { email: string; passwordHash: string };
    }): PromiseLike<{ id: string; email: string }>;
  };
}

const seedEnvSchema = Joi.object<{
  ADMIN_EMAIL: string;
  ADMIN_PASSWORD: string;
}>({
  // `tlds: false` accepts internal domains such as admin@cmpc.local or .test.
  ADMIN_EMAIL: Joi.string()
    .trim()
    .lowercase()
    .email({ tlds: { allow: false } })
    .required(),
  ADMIN_PASSWORD: Joi.string().min(8).required(),
});

/**
 * Ensures the initial administrator exists. It is idempotent: when the user is
 * already there nothing is modified, so a password changed later is never
 * overwritten by a restart with SEED_ON_START=true.
 * The seed validates its own inputs (they are not part of the API schema).
 */
export async function seedAdmin(
  client: SeedClient,
  env: Record<string, unknown>,
): Promise<{ id: string; email: string }> {
  const result = seedEnvSchema.validate(env, {
    abortEarly: false,
    allowUnknown: true,
  });

  if (result.error) {
    const problems = result.error.details.map((d) => d.message).join('; ');
    throw new Error(`Invalid seed configuration: ${problems}`);
  }

  const { ADMIN_EMAIL: email, ADMIN_PASSWORD: password } = result.value;
  const passwordHash = await argon2.hash(password);

  return client.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash },
  });
}
