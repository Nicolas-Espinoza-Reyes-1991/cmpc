import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Minimal valid environment so AppModule can boot in e2e tests (no real database is used).
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET ??= 'e2e-test-secret';
// The image storage creates UPLOAD_DIR when the app boots: keep it out of the repository.
process.env.UPLOAD_DIR ??= join(tmpdir(), 'cmpc-e2e-uploads');
