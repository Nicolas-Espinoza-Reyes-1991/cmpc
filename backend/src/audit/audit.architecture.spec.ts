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

// `seed/` runs outside the application with its own client and writes no audit data.
const files = sourceFiles(SRC).filter(([path]) => !path.startsWith('seed/'));

/** The shape of an entry is decided in one place: `AuditService` (G1.4). */
describe('the audit trail has a single writer', () => {
  it('finds the application sources', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it('only AuditService touches the audit_logs table', () => {
    const offenders = files
      .filter(([path]) => path !== 'audit/audit.service.ts')
      .filter(([, text]) => /\.auditLog\b/.test(text))
      .map(([path]) => path);

    expect(offenders).toEqual([]);
  });

  it('AuditService does write to it', () => {
    const service = files.find(([path]) => path === 'audit/audit.service.ts');

    expect(service?.[1]).toMatch(/\bauditLog\.create\b/);
  });

  it('nothing updates or deletes audit entries', () => {
    const offenders = files
      .filter(([, text]) => /\bauditLog\.(update|delete|upsert)/.test(text))
      .map(([path]) => path);

    expect(offenders).toEqual([]);
  });
});
