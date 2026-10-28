// Contract of the auth endpoints (backend `LoginDto`, `LoginResponseDto` and `UserDto`).

export interface LoginCredentials {
  email: string;
  password: string;
}

/** The only user data the frontend ever receives: no hash, no roles. */
export interface AuthUser {
  id: string;
  email: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  /** ISO 8601 moment the token stops being valid. */
  expiresAt: string;
  user: AuthUser;
}
