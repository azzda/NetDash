export interface AuthenticatedUser {
  username: string;
  name?: string;
  email?: string;
  role: "admin" | "viewer";
  groups: string[];
}

export interface AuthState {
  /** Whether the backend enforces authentication at all. */
  authEnabled: boolean;
  authenticated: boolean;
  user?: AuthenticatedUser;
  /** Self-service links exposed by the IdP (present only under OIDC). */
  account?: {
    /** The IdP's own Account Console (e.g. Keycloak `${issuer}/account`). */
    manageUrl: string;
  };
}

/**
 * Ask the backend who we are.
 *
 * A 401 is a normal answer, not a failure: it means "log in". The backend
 * redirects browsers to the IdP for page loads, but this call is JSON so it
 * gets the status code instead, letting the UI decide when to send the user
 * away.
 */
export async function fetchAuthState(): Promise<AuthState> {
  const response = await fetch("/api/me", {
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });

  if (response.status === 401) {
    return { authEnabled: true, authenticated: false };
  }
  if (!response.ok) {
    throw new Error(`/api/me returned HTTP ${response.status}`);
  }

  return (await response.json()) as AuthState;
}

export function startLogin(): void {
  window.location.href = "/auth/login";
}

export async function logout(): Promise<void> {
  const response = await fetch("/auth/logout", {
    method: "POST",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  const body = (await response.json().catch(() => ({}))) as { endSessionUrl?: string };

  // Ending the Keycloak session too, so "sign out" does not leave a live SSO
  // cookie that silently signs the user straight back in.
  window.location.href = body.endSessionUrl ?? "/";
}
