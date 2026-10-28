import Joi from 'joi';

export type NodeEnv = 'development' | 'production' | 'test';

/** Typed shape of the validated environment (see `.env.example`). */
export interface EnvironmentVariables {
  NODE_ENV: NodeEnv;
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  CORS_ORIGIN: string;
  THROTTLE_TTL: number;
  THROTTLE_LIMIT: number;
  UPLOAD_DIR: string;
}

export const MIN_PRODUCTION_SECRET_LENGTH = 32;

/**
 * Only variables read by the API belong here. Compose-only variables
 * (POSTGRES_*, published ports) and the seed variables (ADMIN_*, SEED_ON_START)
 * are ignored on purpose; the seed validates its own inputs.
 */
export const envSchema = Joi.object<EnvironmentVariables>({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),
  // A short secret is tolerated locally but never in production (R2.3).
  JWT_SECRET: Joi.string()
    .required()
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.string().min(MIN_PRODUCTION_SECRET_LENGTH),
    }),
  JWT_EXPIRES_IN: Joi.string()
    .pattern(/^\d+(s|m|h|d)$/)
    .default('1h'),
  CORS_ORIGIN: Joi.string().default('http://localhost:5173'),
  THROTTLE_TTL: Joi.number().integer().positive().default(60),
  THROTTLE_LIMIT: Joi.number().integer().positive().default(5),
  UPLOAD_DIR: Joi.string().default('./uploads'),
});

/**
 * Validates `process.env` at startup (R2.1). It reports every problem at once,
 * naming each variable, so the process fails fast with an actionable message.
 */
export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const result: Joi.ValidationResult<EnvironmentVariables> = envSchema.validate(
    config,
    { abortEarly: false, allowUnknown: true },
  );

  if (result.error) {
    const problems = result.error.details
      .map((detail) => detail.message)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${problems}`);
  }

  return result.value;
}
