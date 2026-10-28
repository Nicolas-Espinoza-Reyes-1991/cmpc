import { validateEnv } from './env.validation';

const validEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_SECRET: 'dev-secret',
};

const LONG_SECRET = 'x'.repeat(32);

describe('validateEnv', () => {
  it('accepts a minimal valid environment and applies defaults', () => {
    const env = validateEnv(validEnv);

    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      JWT_EXPIRES_IN: '1h',
      CORS_ORIGIN: 'http://localhost:5173',
      THROTTLE_TTL: 60,
      THROTTLE_LIMIT: 5,
      UPLOAD_DIR: './uploads',
    });
  });

  it('converts numeric strings coming from process.env', () => {
    const env = validateEnv({
      ...validEnv,
      PORT: '4000',
      THROTTLE_TTL: '30',
      THROTTLE_LIMIT: '10',
    });

    expect(env.PORT).toBe(4000);
    expect(env.THROTTLE_TTL).toBe(30);
    expect(env.THROTTLE_LIMIT).toBe(10);
  });

  it('ignores variables that are not part of the schema', () => {
    expect(() =>
      validateEnv({ ...validEnv, POSTGRES_USER: 'cmpc', ADMIN_EMAIL: 'a@b.c' }),
    ).not.toThrow();
  });

  it('names the missing variable', () => {
    expect(() => validateEnv({ JWT_SECRET: 'dev-secret' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('reports every invalid variable at once', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL.*JWT_SECRET/);
  });

  it('rejects a database url that is not PostgreSQL', () => {
    expect(() =>
      validateEnv({ ...validEnv, DATABASE_URL: 'mysql://u:p@localhost/db' }),
    ).toThrow(/DATABASE_URL/);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => validateEnv({ ...validEnv, NODE_ENV: 'staging' })).toThrow(
      /NODE_ENV/,
    );
  });

  it('rejects a malformed JWT_EXPIRES_IN', () => {
    expect(() =>
      validateEnv({ ...validEnv, JWT_EXPIRES_IN: 'tomorrow' }),
    ).toThrow(/JWT_EXPIRES_IN/);
  });

  it('rejects a port outside the valid range', () => {
    expect(() => validateEnv({ ...validEnv, PORT: '70000' })).toThrow(/PORT/);
  });

  describe('JWT_SECRET length', () => {
    it('allows a short secret outside production', () => {
      expect(() =>
        validateEnv({ ...validEnv, NODE_ENV: 'development' }),
      ).not.toThrow();
    });

    it('rejects a secret shorter than 32 characters in production', () => {
      expect(() =>
        validateEnv({ ...validEnv, NODE_ENV: 'production' }),
      ).toThrow(/JWT_SECRET.*32/);
    });

    it('accepts a 32 character secret in production', () => {
      const env = validateEnv({
        ...validEnv,
        NODE_ENV: 'production',
        JWT_SECRET: LONG_SECRET,
      });

      expect(env.JWT_SECRET).toBe(LONG_SECRET);
    });
  });
});
