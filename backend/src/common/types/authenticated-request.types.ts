import type { Request } from 'express';

/** What the JWT strategy attaches to the request after a successful login. */
export interface AuthenticatedUser {
  id: string;
  email: string;
}

/** `user` is optional because public routes (login, health) have none. */
export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };
