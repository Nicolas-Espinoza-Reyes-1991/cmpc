// Minimal valid environment so AppModule can boot in e2e tests (no real database is used).
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET ??= 'e2e-test-secret';
