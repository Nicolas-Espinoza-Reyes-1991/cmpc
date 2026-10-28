import { z } from 'zod';

const INVALID_EMAIL = 'Ingresa un correo válido.';

/**
 * The limits of RFC 5321 that the backend's validator enforces and Zod's email
 * check does not: a local part of up to 64 characters, domain labels of up to
 * 63, and no label starting or ending with a hyphen. Without them the form
 * would let through addresses the API answers with a 400.
 */
function respectsAddressLimits(email: string): boolean {
  const at = email.lastIndexOf('@');
  const local = email.slice(0, at);
  const labels = email.slice(at + 1).split('.');

  return (
    local.length <= 64 &&
    labels.every(
      (label) =>
        label.length <= 63 && !label.startsWith('-') && !label.endsWith('-'),
    )
  );
}

/**
 * Same limits as the backend's `LoginDto` (email up to 254 characters, password
 * up to 128), so the form rejects what the API would reject, in Spanish and
 * before sending anything. The rule is "the form may be stricter than the API,
 * never more permissive". The `error` of `z.string` covers a value that is not
 * text at all; without it Zod would answer in English.
 */
export const loginSchema = z.object({
  email: z
    .string({ error: 'Ingresa tu correo.' })
    .trim()
    .min(1, 'Ingresa tu correo.')
    .max(254, 'El correo no puede superar los 254 caracteres.')
    // Nested pipes stop at the first failure: the address limits are only checked
    // on a well-formed email, so one problem never produces the same message twice.
    .pipe(
      z
        .email(INVALID_EMAIL)
        .pipe(z.string().refine(respectsAddressLimits, INVALID_EMAIL)),
    ),
  // Never trimmed: spaces at the ends can be part of a password.
  password: z
    .string({ error: 'Ingresa tu contraseña.' })
    .min(1, 'Ingresa tu contraseña.')
    .max(128, 'La contraseña no puede superar los 128 caracteres.'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
