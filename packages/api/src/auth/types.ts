export interface User {
    id: string;
    email: string;
    name: string;
    role: string;
    avatarUrl?: string | null;
    bio?: string | null;
    createdAt?: string;
    [key: string]: unknown;
}

export interface LoginCredentials {
    email: string;
    password?: string;
    [key: string]: unknown;
}

export interface RegisterUserData {
    email: string;
    name: string;
    password: string;
    avatarUrl?: string | null;
    bio?: string | null;
}

export interface AuthResult {
    user: User;
    accessToken: string;
    refreshToken: string;
    tokenType?: string;
    expiresIn?: number;
}

export interface AuthApiResponse {
    data: AuthResult;
}

export interface AuthResponse {
    token: string;
    user: User;
    refreshToken?: string;
}

/** `POST /sessions` answers this instead of a session when the account has 2FA on. */
export interface MfaChallenge {
    mfaRequired: true;
    /** One-use token, valid 5 minutes. Keep it in memory only: never in storage or in a URL. */
    mfaToken: string;
}

export type LoginResult = AuthResponse | MfaChallenge;

export type MfaLoginPayload =
    | { mfaToken: string; code: string; recoveryCode?: never }
    | { mfaToken: string; recoveryCode: string; code?: never };

export interface MfaAuthResponse extends AuthResponse {
    /** Only present when the user came in with a recovery code. */
    recoveryCodesRemaining?: number;
}

export interface MfaLoginApiResponse {
    data: AuthResult & { recoveryCodesRemaining?: number };
}

export interface MfaSetup {
    secret: string;
    otpauthUri: string;
}

export interface MfaRecoveryCodes {
    recoveryCodes: string[];
}

export interface RefreshSessionPayload {
    refreshToken: string;
}
