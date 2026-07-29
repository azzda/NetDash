import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { normaliseGroups } from "./rbac";
import type { SessionUser } from "./session";

export interface OidcConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  /** Public base URL of this NetDash, used to build the redirect URI. */
  publicUrl: string;
  scopes?: string;
  sessionTtlSeconds?: number;
}

interface OidcDiscovery {
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  end_session_endpoint?: string;
  issuer: string;
}

export interface LoginRequest {
  authorizationUrl: string;
  state: string;
  codeVerifier: string;
}

function base64url(input: Buffer): string {
  return input.toString("base64url");
}

/**
 * Authorization Code flow with PKCE against Keycloak.
 *
 * PKCE is used even though this is a confidential client: it costs nothing and
 * removes the authorization-code interception class of attack entirely.
 */
export class OidcClient {
  private discovery?: OidcDiscovery;
  private jwks?: ReturnType<typeof createRemoteJWKSet>;

  constructor(private readonly config: OidcConfig) {}

  get redirectUri(): string {
    return `${this.config.publicUrl.replace(/\/+$/, "")}/auth/callback`;
  }

  private async discover(): Promise<OidcDiscovery> {
    if (this.discovery) {
      return this.discovery;
    }
    const url = `${this.config.issuer.replace(/\/+$/, "")}/.well-known/openid-configuration`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`OIDC discovery failed: HTTP ${response.status} from ${url}`);
    }
    this.discovery = (await response.json()) as OidcDiscovery;
    this.jwks = createRemoteJWKSet(new URL(this.discovery.jwks_uri));
    return this.discovery;
  }

  async createLoginRequest(): Promise<LoginRequest> {
    const discovery = await this.discover();

    const state = base64url(randomBytes(24));
    const codeVerifier = base64url(randomBytes(32));
    const codeChallenge = base64url(createHash("sha256").update(codeVerifier).digest());

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: "code",
      redirect_uri: this.redirectUri,
      scope: this.config.scopes ?? "openid profile email",
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    return {
      authorizationUrl: `${discovery.authorization_endpoint}?${params.toString()}`,
      state,
      codeVerifier,
    };
  }

  async exchangeCode(code: string, codeVerifier: string): Promise<SessionUser> {
    const discovery = await this.discover();

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.redirectUri,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code_verifier: codeVerifier,
    });

    const response = await fetch(discovery.token_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Token exchange failed: HTTP ${response.status} ${detail.slice(0, 200)}`);
    }

    const tokens = (await response.json()) as { id_token?: string };
    if (!tokens.id_token) {
      throw new Error("Token response contained no id_token");
    }

    return this.verifyIdToken(tokens.id_token);
  }

  /**
   * Verifies the signature against the issuer's published keys, and that the
   * token was minted by the expected issuer for this client. Without this the
   * whole flow would accept any token a caller invented.
   */
  private async verifyIdToken(idToken: string): Promise<SessionUser> {
    const discovery = await this.discover();
    if (!this.jwks) {
      throw new Error("JWKS not initialised");
    }

    const { payload } = await jwtVerify(idToken, this.jwks, {
      issuer: discovery.issuer,
      audience: this.config.clientId,
    });

    return this.toSessionUser(payload);
  }

  private toSessionUser(payload: JWTPayload): SessionUser {
    const ttl = this.config.sessionTtlSeconds ?? 8 * 60 * 60;
    const username =
      (payload.preferred_username as string | undefined) ??
      (payload.email as string | undefined) ??
      String(payload.sub);

    return {
      sub: String(payload.sub),
      username,
      name: payload.name as string | undefined,
      email: payload.email as string | undefined,
      groups: normaliseGroups(payload.groups),
      exp: Math.floor(Date.now() / 1000) + ttl,
    };
  }

  async endSessionUrl(): Promise<string | undefined> {
    const discovery = await this.discover();
    if (!discovery.end_session_endpoint) {
      return undefined;
    }
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      post_logout_redirect_uri: this.config.publicUrl.replace(/\/+$/, "") + "/",
    });
    return `${discovery.end_session_endpoint}?${params.toString()}`;
  }
}
