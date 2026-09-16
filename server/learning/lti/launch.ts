import type { LearningStore } from "../storage/port";
import type {
  AppSessionClaims,
  LearningServiceConfig,
  LtiPlatformRegistration,
  ValidatedLaunch,
} from "../types";
import { LTI_CLAIMS, LTI_VERSION } from "../types";
import { requireLearning } from "../errors";
import {
  derivePseudonymousUserKey,
  equalOpaqueHash,
  hashOpaque,
  randomOpaque,
} from "../security/identifiers";
import { JwksCache, signServiceJwt, verifyPlatformJwt } from "../security/jwt";
import { mapLtiRoles } from "../security/roles";

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const isHttpsUrl = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
};

const findRegistration = (
  registrations: LtiPlatformRegistration[],
  issuer: string,
  clientId?: string,
): LtiPlatformRegistration => {
  const matches = registrations.filter((value) =>
    value.enabled && value.issuer === issuer && (!clientId || value.clientId === clientId));
  requireLearning(matches.length === 1, "lti.registration", "No unique enabled static platform registration matches.", 401);
  return matches[0];
};

export class LtiLaunchService {
  private readonly jwks: JwksCache;
  constructor(
    private readonly config: LearningServiceConfig,
    private readonly store: LearningStore,
    private readonly now: () => Date = () => new Date(),
    fetcher: typeof fetch = fetch,
  ) {
    this.jwks = new JwksCache(config.jwksCacheSeconds, fetcher);
  }

  async initiateLogin(input: {
    iss: string;
    loginHint: string;
    targetLinkUri: string;
    ltiMessageHint?: string;
    clientId?: string;
    deploymentId?: string;
  }): Promise<string> {
    requireLearning(this.config.causalystLtiV1, "lti.disabled", "LTI launch is disabled.", 503);
    const registration = findRegistration(this.config.registrations, input.iss, input.clientId);
    requireLearning(input.loginHint.trim(), "lti.login-hint", "login_hint is required.");
    requireLearning(
      input.targetLinkUri === this.config.launchUrl || input.targetLinkUri === this.config.deepLinkLaunchUrl,
      "lti.target-link",
      "target_link_uri is not registered.",
      401,
    );
    if (input.deploymentId) requireLearning(registration.deploymentIds.includes(input.deploymentId),
      "lti.deployment-hint", "Deployment hint is not registered.", 401);

    const state = randomOpaque("state");
    const nonce = randomOpaque("nonce");
    const createdAt = this.now();
    await this.store.putLoginState({
      stateHash: hashOpaque(state),
      nonceHash: hashOpaque(nonce),
      registrationId: registration.id,
      ...(input.deploymentId ? { deploymentHint: input.deploymentId } : {}),
      targetLinkUri: input.targetLinkUri,
      ...(input.ltiMessageHint ? { messageHint: input.ltiMessageHint } : {}),
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + this.config.loginStateTtlSeconds * 1000).toISOString(),
    });

    const url = new URL(registration.authorizationEndpoint);
    url.searchParams.set("scope", "openid");
    url.searchParams.set("response_type", "id_token");
    url.searchParams.set("response_mode", "form_post");
    url.searchParams.set("prompt", "none");
    url.searchParams.set("client_id", registration.clientId);
    url.searchParams.set("redirect_uri", input.targetLinkUri);
    url.searchParams.set("login_hint", input.loginHint);
    if (input.ltiMessageHint) url.searchParams.set("lti_message_hint", input.ltiMessageHint);
    url.searchParams.set("state", state);
    url.searchParams.set("nonce", nonce);
    return url.toString();
  }

  async validateLaunch(idToken: string, state: string): Promise<ValidatedLaunch> {
    requireLearning(this.config.causalystLtiV1, "lti.disabled", "LTI launch is disabled.", 503);
    const now = this.now();
    const loginState = await this.store.consumeLoginState(hashOpaque(state), now.toISOString());
    requireLearning(loginState, "lti.state", "Login state is invalid, expired, or already used.", 401);
    const registration = this.config.registrations.find(({ id }) => id === loginState.registrationId);
    requireLearning(registration?.enabled, "lti.registration-disabled", "Platform registration is disabled.", 401);
    const claims = await verifyPlatformJwt({
      token: idToken,
      issuer: registration.issuer,
      clientId: registration.clientId,
      jwksUrl: registration.jwksUrl,
      jwksCache: this.jwks,
      nowSeconds: Math.floor(now.getTime() / 1000),
    });

    requireLearning(typeof claims.nonce === "string" && equalOpaqueHash(claims.nonce, loginState.nonceHash),
      "lti.nonce", "Launch nonce is invalid.", 401);
    const deploymentId = claims[LTI_CLAIMS.deploymentId];
    requireLearning(typeof deploymentId === "string" && registration.deploymentIds.includes(deploymentId),
      "lti.deployment", "Launch deployment is not registered.", 401);
    if (loginState.deploymentHint) requireLearning(deploymentId === loginState.deploymentHint,
      "lti.deployment-mismatch", "Launch deployment differs from the login hint.", 401);
    requireLearning(claims[LTI_CLAIMS.version] === LTI_VERSION, "lti.version", "Unsupported LTI version.", 401);
    requireLearning(claims[LTI_CLAIMS.targetLinkUri] === loginState.targetLinkUri,
      "lti.target-link", "Launch target link is invalid.", 401);

    const messageType = claims[LTI_CLAIMS.messageType];
    requireLearning(messageType === "LtiResourceLinkRequest" || messageType === "LtiDeepLinkingRequest",
      "lti.message-type", "Unsupported LTI message type.", 401);
    requireLearning(
      messageType === "LtiDeepLinkingRequest"
        ? loginState.targetLinkUri === this.config.deepLinkLaunchUrl
        : loginState.targetLinkUri === this.config.launchUrl,
      "lti.message-target",
      "LTI message type does not match the registered target link.",
      401,
    );
    const roles = mapLtiRoles(claims[LTI_CLAIMS.roles]);
    requireLearning(roles.length > 0, "lti.roles", "Launch has no authorized role.", 403);
    const resourceLink = asRecord(claims[LTI_CLAIMS.resourceLink]);
    const custom = asRecord(claims[LTI_CLAIMS.custom]);
    const deepLink = asRecord(claims[LTI_CLAIMS.deepLinkingSettings]);
    const ags = asRecord(claims[LTI_CLAIMS.agsEndpoint]);
    if (messageType === "LtiDeepLinkingRequest") {
      requireLearning(roles.includes("instructor") || roles.includes("administrator"),
        "lti.deep-link-role", "Deep Linking requires instructor authorization.", 403);
      requireLearning(registration.allowedServices.includes("deep-linking"),
        "lti.deep-link-disabled", "Deep Linking is disabled for this platform.", 403);
      requireLearning(Array.isArray(deepLink?.accept_types)
        && deepLink.accept_types.includes("ltiResourceLink"),
      "lti.deep-link-content-type", "Platform does not accept LTI Resource Link content items.", 400);
      requireLearning(isHttpsUrl(deepLink.deep_link_return_url),
      "lti.deep-link-return-url", "Deep Linking return URL must be an HTTPS URL.", 400);
    }

    const pseudonymousUserKey = derivePseudonymousUserKey(
      this.config.pseudonymSecret,
      registration.issuer,
      deploymentId,
      claims.sub,
    );
    await this.store.upsertUser({
      userKey: pseudonymousUserKey,
      registrationId: registration.id,
      deploymentId,
      ltiSubject: claims.sub,
      createdAt: now.toISOString(),
      lastSeenAt: now.toISOString(),
    });

    return {
      registrationId: registration.id,
      issuer: registration.issuer,
      clientId: registration.clientId,
      deploymentId,
      subject: claims.sub,
      pseudonymousUserKey,
      roles,
      messageType,
      targetLinkUri: loginState.targetLinkUri,
      ...(typeof resourceLink?.id === "string" ? { resourceLinkId: resourceLink.id } : {}),
      ...(typeof custom?.causalyst_assignment_id === "string" ? { assignmentId: custom.causalyst_assignment_id } : {}),
      ...(typeof deepLink?.deep_link_return_url === "string" ? { deepLinkReturnUrl: deepLink.deep_link_return_url } : {}),
      ...(typeof deepLink?.data === "string" ? { deepLinkData: deepLink.data } : {}),
      ...(deepLink?.accept_lineitem === true ? { deepLinkAcceptsLineItem: true } : {}),
      ...(ags ? {
        ags: {
          ...(typeof ags.lineitem === "string" ? { lineItemUrl: ags.lineitem } : {}),
          ...(typeof ags.lineitems === "string" ? { lineItemsUrl: ags.lineitems } : {}),
          scopes: Array.isArray(ags.scope) ? ags.scope.filter((value): value is string => typeof value === "string") : [],
        },
      } : {}),
    };
  }

  async createLaunchCode(launch: ValidatedLaunch): Promise<{ code: string; redirectUrl: string }> {
    const now = this.now();
    const session: AppSessionClaims = {
      sessionId: randomOpaque("ses"),
      registrationId: launch.registrationId,
      deploymentId: launch.deploymentId,
      userKey: launch.pseudonymousUserKey,
      roles: launch.roles,
      ...(launch.assignmentId ? { assignmentId: launch.assignmentId } : {}),
      ...(launch.resourceLinkId ? { resourceLinkId: launch.resourceLinkId } : {}),
      ltiContext: {
        messageType: launch.messageType,
        ...(launch.deepLinkReturnUrl ? { deepLinkReturnUrl: launch.deepLinkReturnUrl } : {}),
        ...(launch.deepLinkData ? { deepLinkData: launch.deepLinkData } : {}),
        ...(launch.deepLinkAcceptsLineItem ? { deepLinkAcceptsLineItem: true } : {}),
        ...(launch.ags?.lineItemUrl ? { agsLineItemUrl: launch.ags.lineItemUrl } : {}),
        agsScopes: launch.ags?.scopes ?? [],
      },
      issuedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.config.sessionTtlSeconds * 1000).toISOString(),
    };
    const code = randomOpaque("launch");
    await this.store.putLaunchCode({
      codeHash: hashOpaque(code),
      session,
      expiresAt: new Date(now.getTime() + this.config.launchCodeTtlSeconds * 1000).toISOString(),
    });
    const redirect = new URL(this.config.appBaseUrl);
    redirect.hash = `/causalyst-lti?launchCode=${encodeURIComponent(code)}`;
    return { code, redirectUrl: redirect.toString() };
  }

  async exchangeLaunchCode(code: string): Promise<{ token: string; session: AppSessionClaims }> {
    const now = this.now();
    const record = await this.store.consumeLaunchCode(hashOpaque(code), now.toISOString());
    requireLearning(record, "session.launch-code", "Launch code is invalid, expired, or already used.", 401);
    const issued = Math.floor(now.getTime() / 1000);
    const expires = Math.floor(Date.parse(record.session.expiresAt) / 1000);
    return {
      token: signServiceJwt({
        iss: this.config.issuer,
        aud: this.config.clientId,
        sub: record.session.userKey,
        jti: record.session.sessionId,
        iat: issued,
        exp: expires,
        registrationId: record.session.registrationId,
        deploymentId: record.session.deploymentId,
        roles: record.session.roles,
        ...(record.session.assignmentId ? { assignmentId: record.session.assignmentId } : {}),
        ...(record.session.resourceLinkId ? { resourceLinkId: record.session.resourceLinkId } : {}),
        ...(record.session.ltiContext ? { ltiContext: record.session.ltiContext } : {}),
      }, this.config.keyId, this.config.privateKeyPem),
      session: record.session,
    };
  }
}
