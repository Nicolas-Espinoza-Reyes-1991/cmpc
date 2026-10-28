import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(__dirname, '..');

/** Every non-test TypeScript file under src, as [relative path, source text]. */
function sourceFiles(dir: string): [string, string][] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (!entry.name.endsWith('.ts') || /\.spec\.ts$/.test(entry.name))
      return [];
    return [
      [relative(SRC, path).replace(/\\/g, '/'), readFileSync(path, 'utf8')],
    ];
  });
}

// `prisma/` defines the client; `seed/` runs outside the application with its own client.
const files = sourceFiles(SRC).filter(
  ([path]) => !path.startsWith('prisma/') && !path.startsWith('seed/'),
);

/**
 * Books are only reachable through `prisma.live`, which hides deleted ones
 * (C5.2). These rules make a service that forgets it fail the build.
 */
describe('soft delete cannot be bypassed', () => {
  it('finds the application sources', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it('never reads books from the plain Prisma client', () => {
    const offenders = files
      .filter(([, text]) => /\bprisma\.book\b/.test(text))
      .map(([path]) => path);

    expect(offenders).toEqual([]);
  });

  it('never opens a transaction on the plain Prisma client', () => {
    // A transaction from the plain client hands out a `tx` that does not filter.
    const offenders = files
      .filter(([, text]) => /\bprisma\.\$transaction\b/.test(text))
      .map(([path]) => path);

    expect(offenders).toEqual([]);
  });

  it('never creates its own PrismaClient', () => {
    const offenders = files
      .filter(([, text]) => /new PrismaClient\(/.test(text))
      .map(([path]) => path);

    expect(offenders).toEqual([]);
  });
});
