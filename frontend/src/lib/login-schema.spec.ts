import { loginSchema } from './login-schema';

const valid = { email: 'admin@cmpc.local', password: 'change-me' };

/** Every message the schema produced for one field, in order. */
function messagesFor(input: unknown, field: 'email' | 'password'): string[] {
  const result = loginSchema.safeParse(input);
  if (result.success) return [];
  return result.error.issues
    .filter((issue) => issue.path[0] === field)
    .map((issue) => issue.message);
}

describe('loginSchema', () => {
  describe('valid values', () => {
    it('accepts correct credentials', () => {
      expect(loginSchema.safeParse(valid).success).toBe(true);
    });

    it('accepts the email of the seeded administrator, a .local domain', () => {
      expect(
        loginSchema.safeParse({ ...valid, email: 'admin@cmpc.local' }).success,
      ).toBe(true);
    });

    it('trims the email', () => {
      const result = loginSchema.parse({
        ...valid,
        email: '  admin@cmpc.local  ',
      });

      expect(result.email).toBe('admin@cmpc.local');
    });

    it('never trims the password and keeps its spaces', () => {
      const result = loginSchema.parse({ ...valid, password: '  my pass  ' });

      expect(result.password).toBe('  my pass  ');
    });

    it('accepts a password of exactly 128 characters', () => {
      expect(
        loginSchema.safeParse({ ...valid, password: 'x'.repeat(128) }).success,
      ).toBe(true);
    });

    it('drops fields that are not part of the form', () => {
      const result = loginSchema.parse({ ...valid, isAdmin: true });

      expect(result).toEqual(valid);
    });
  });

  describe('email', () => {
    it.each([
      ['empty', ''],
      ['only spaces', '    '],
    ])('asks for it when it is %s', (_label, email) => {
      expect(messagesFor({ ...valid, email }, 'email')[0]).toBe(
        'Ingresa tu correo.',
      );
    });

    it.each([
      'admin',
      'admin@',
      '@cmpc.local',
      'a b@cmpc.local',
      'admin@cmpc',
      'admin@@cmpc.local',
    ])('rejects "%s" as a malformed email', (email) => {
      expect(messagesFor({ ...valid, email }, 'email')).toEqual([
        'Ingresa un correo válido.',
      ]);
    });

    describe('RFC 5321 limits the API enforces (the form is never more permissive)', () => {
      it.each([
        ['a local part of 65 characters', `${'a'.repeat(65)}@example.com`],
        ['a domain label of 64 characters', `user@${'a'.repeat(64)}.com`],
        ['a label ending with a hyphen', 'user@example-.com'],
        ['a label starting with a hyphen', 'user@-example.com'],
      ])('rejects %s', (_label, email) => {
        expect(messagesFor({ ...valid, email }, 'email')).toEqual([
          'Ingresa un correo válido.',
        ]);
      });

      it.each([
        [
          'a local part of exactly 64 characters',
          `${'a'.repeat(64)}@example.com`,
        ],
        [
          'a domain label of exactly 63 characters',
          `user@${'a'.repeat(63)}.com`,
        ],
        ['a hyphen inside a label', 'user@my-domain.com'],
      ])('accepts %s', (_label, email) => {
        expect(loginSchema.safeParse({ ...valid, email }).success).toBe(true);
      });
    });

    it('rejects an email longer than 254 characters', () => {
      const email = `${'a'.repeat(250)}@b.co`;

      expect(messagesFor({ ...valid, email }, 'email')[0]).toBe(
        'El correo no puede superar los 254 caracteres.',
      );
    });
  });

  describe('password', () => {
    it('asks for it when it is empty', () => {
      expect(messagesFor({ ...valid, password: '' }, 'password')).toEqual([
        'Ingresa tu contraseña.',
      ]);
    });

    it('rejects a password longer than 128 characters', () => {
      expect(
        messagesFor({ ...valid, password: 'x'.repeat(129) }, 'password'),
      ).toEqual(['La contraseña no puede superar los 128 caracteres.']);
    });
  });

  describe('reports every problem at once', () => {
    it('lists the email and the password when both are empty', () => {
      const input = { email: '', password: '' };

      expect(messagesFor(input, 'email')).toContain('Ingresa tu correo.');
      expect(messagesFor(input, 'password')).toEqual([
        'Ingresa tu contraseña.',
      ]);
    });
  });

  describe('values that are not text', () => {
    it.each([undefined, null, 42, { $ne: null }])(
      'answers in Spanish, not with Zod defaults, for %j',
      (value) => {
        const input = { email: value, password: value };

        expect(messagesFor(input, 'email')).toEqual(['Ingresa tu correo.']);
        expect(messagesFor(input, 'password')).toEqual([
          'Ingresa tu contraseña.',
        ]);
      },
    );
  });
});
