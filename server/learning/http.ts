import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { CausalystAssessmentDefinition } from "../../src/causalyst/domain/types";
import type { CausalystSubmission } from "../../src/causalyst/submission/types";
import type { AgsClient } from "./ags/client";
import { LearningServiceError, requireLearning } from "./errors";
import { createDeepLinkResponse } from "./lti/deepLinking";
import { LtiLaunchService } from "./lti/launch";
import { verifyAppSessionToken } from "./security/session";
import { randomOpaque } from "./security/identifiers";
import { learningLogRecord } from "./security/redaction";
import { CausalystLearningService } from "./services/learningService";
import type { LearningStore } from "./storage/port";
import type { AppSessionClaims, LearningServiceConfig, ValidatedLaunch } from "./types";

const jsonHeaders = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const sendJson = (response: ServerResponse, status: number, body: unknown): void => {
  response.writeHead(status, jsonHeaders);
  response.end(JSON.stringify(body));
};
const sendRedirect = (response: ServerResponse, location: string): void => {
  response.writeHead(303, { location, "cache-control": "no-store" });
  response.end();
};
const routeMatch = (pathname: string, pattern: RegExp): string[] | undefined =>
  pathname.match(pattern)?.slice(1).map(decodeURIComponent);

const readBody = async (request: IncomingMessage, maxBytes: number): Promise<Record<string, unknown>> => {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += value.byteLength;
    requireLearning(total <= maxBytes, "request.size", "Request exceeds the configured size limit.", 413);
    chunks.push(value);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if ((request.headers["content-type"] ?? "").startsWith("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(text));
  }
  try {
    return text ? JSON.parse(text) as Record<string, unknown> : {};
  } catch {
    throw new LearningServiceError("request.json", "Request body must be valid JSON.");
  }
};

const bearerSession = (
  request: IncomingMessage,
  config: LearningServiceConfig,
  now: Date,
): AppSessionClaims => {
  const authorization = request.headers.authorization ?? "";
  requireLearning(authorization.startsWith("Bearer "), "session.bearer", "Bearer session is required.", 401);
  return verifyAppSessionToken(authorization.slice(7), config, Math.floor(now.getTime() / 1000));
};

export const createLearningHttpServer = (input: {
  config: LearningServiceConfig;
  store: LearningStore;
  agsClient: AgsClient;
  now?: () => Date;
  fetcher?: typeof fetch;
  log?: (record: Readonly<Record<string, string | number>>) => void;
}) => {
  const now = input.now ?? (() => new Date());
  const launchService = new LtiLaunchService(input.config, input.store, now, input.fetcher);
  const learningService = new CausalystLearningService(input.config, input.store, input.agsClient, now);

  return createServer(async (request, response) => {
    const requestId = randomOpaque("req", 12);
    const url = new URL(request.url ?? "/", "http://learning.local");
    const method = request.method ?? "GET";
    let status = 500;
    let code = "internal";
    try {
      if (method === "GET" && url.pathname === "/.well-known/jwks.json") {
        status = 200; code = "jwks";
        return sendJson(response, status, { keys: [
          { ...input.config.publicJwk, kid: input.config.keyId, use: "sig", alg: "RS256" },
          ...input.config.retiringPublicJwks.map((key) => ({ ...key, use: "sig", alg: "RS256" })),
        ] });
      }
      if (method === "GET" && url.pathname === "/lti/configuration") {
        status = 200; code = "configuration";
        return sendJson(response, status, {
          issuer: input.config.issuer,
          client_id: input.config.clientId,
          auth_login_url: `${new URL(input.config.launchUrl).origin}/lti/login`,
          target_link_uri: input.config.launchUrl,
          jwks_url: `${new URL(input.config.launchUrl).origin}/.well-known/jwks.json`,
          messages_supported: [
            { type: "LtiResourceLinkRequest", target_link_uri: input.config.launchUrl, placements: ["course_navigation", "assignment_selection"] },
            { type: "LtiDeepLinkingRequest", target_link_uri: input.config.deepLinkLaunchUrl, placements: ["assignment_selection"] },
          ],
          claims: ["iss", "sub", "aud", "exp", "iat", "nonce", "deployment_id", "message_type", "version", "roles"],
        });
      }
      if (method === "GET" && url.pathname === "/lti/login") {
        const redirect = await launchService.initiateLogin({
          iss: url.searchParams.get("iss") ?? "",
          loginHint: url.searchParams.get("login_hint") ?? "",
          targetLinkUri: url.searchParams.get("target_link_uri") ?? "",
          ...(url.searchParams.get("lti_message_hint") ? { ltiMessageHint: url.searchParams.get("lti_message_hint")! } : {}),
          ...(url.searchParams.get("client_id") ? { clientId: url.searchParams.get("client_id")! } : {}),
          ...(url.searchParams.get("lti_deployment_id") ? { deploymentId: url.searchParams.get("lti_deployment_id")! } : {}),
        });
        status = 303; code = "login.redirect";
        return sendRedirect(response, redirect);
      }
      if (method === "POST" && (url.pathname === "/lti/launch" || url.pathname === "/lti/deep-link/launch")) {
        const body = await readBody(request, input.config.maxRequestBytes);
        requireLearning(typeof body.id_token === "string" && typeof body.state === "string",
          "lti.form", "Launch requires id_token and state.");
        const launch = await launchService.validateLaunch(body.id_token, body.state);
        if (launch.messageType === "LtiResourceLinkRequest") await learningService.bindPlatformResourceLaunch(launch);
        const result = await launchService.createLaunchCode(launch);
        status = 303; code = "launch.accepted";
        return sendRedirect(response, result.redirectUrl);
      }
      if (method === "POST" && url.pathname === "/api/session/exchange") {
        const body = await readBody(request, input.config.maxRequestBytes);
        requireLearning(typeof body.launchCode === "string", "session.launch-code", "Launch code is required.");
        const exchanged = await launchService.exchangeLaunchCode(body.launchCode);
        status = 200; code = "session.exchanged";
        return sendJson(response, status, exchanged);
      }

      const session = bearerSession(request, input.config, now());
      if (method === "POST" && url.pathname === "/api/causalyst/assignments") {
        const body = await readBody(request, input.config.maxAssessmentBytes);
        const assignment = await learningService.createAssignment(session, {
          id: String(body.id ?? ""),
          assessment: body.assessment as CausalystAssessmentDefinition,
          gradable: body.gradable === true,
          ...(typeof body.scoreMaximum === "string" ? { scoreMaximum: body.scoreMaximum } : {}),
          agsEnabled: body.agsEnabled === true,
          ...(typeof body.agsLineItemUrl === "string" ? { agsLineItemUrl: body.agsLineItemUrl } : {}),
          ...(typeof body.retentionDays === "number" ? { retentionDays: body.retentionDays } : {}),
        });
        status = 201; code = "assignment.created";
        return sendJson(response, status, assignment);
      }
      if (method === "GET" && url.pathname === "/api/causalyst/assignments/current") {
        const assignment = await learningService.currentAssignment(session);
        status = 200; code = "assignment.current";
        return sendJson(response, status, assignment);
      }
      if (method === "POST" && url.pathname === "/lti/deep-link/return") {
        const body = await readBody(request, input.config.maxRequestBytes);
        requireLearning(session.ltiContext?.messageType === "LtiDeepLinkingRequest"
          && session.ltiContext.deepLinkReturnUrl, "deep-link.session", "Deep Linking launch session is required.", 403);
        const assignmentId = String(body.assignmentId ?? "");
        const assignment = await input.store.getAssignment({
          registrationId: session.registrationId,
          deploymentId: session.deploymentId,
          id: assignmentId,
        });
        requireLearning(assignment, "deep-link.assignment", "Assignment is unavailable in this deployment.", 404);
        const registration = input.config.registrations.find(({ id }) => id === session.registrationId)!;
        const launch: ValidatedLaunch = {
          registrationId: session.registrationId,
          issuer: registration.issuer,
          clientId: registration.clientId,
          deploymentId: session.deploymentId,
          subject: session.userKey,
          pseudonymousUserKey: session.userKey,
          roles: session.roles,
          messageType: "LtiDeepLinkingRequest",
          targetLinkUri: input.config.launchUrl,
          deepLinkReturnUrl: session.ltiContext.deepLinkReturnUrl,
          ...(session.ltiContext.deepLinkData ? { deepLinkData: session.ltiContext.deepLinkData } : {}),
          ...(session.ltiContext.deepLinkAcceptsLineItem ? { deepLinkAcceptsLineItem: true } : {}),
        };
        const result = createDeepLinkResponse({
          config: input.config,
          launch,
          selection: {
            assignmentId,
            title: assignment.assessment.title,
            text: assignment.assessment.instructions,
            gradable: assignment.gradable && assignment.agsEnabled,
            ...(assignment.scoreMaximum ? { scoreMaximum: assignment.scoreMaximum } : {}),
          },
          now: now(),
        });
        status = 200; code = "deep-link.response";
        return sendJson(response, status, result);
      }

      const submitMatch = routeMatch(url.pathname, /^\/api\/causalyst\/assignments\/([^/]+)\/submissions$/);
      if (submitMatch && method === "POST") {
        const body = await readBody(request, input.config.maxSubmissionBytes);
        const submission = await learningService.submit(session, submitMatch[0], body.submission as CausalystSubmission);
        status = 201; code = "submission.created";
        return sendJson(response, status, submission);
      }
      if (submitMatch && method === "GET") {
        const submissions = await learningService.listSubmissions(session, submitMatch[0]);
        status = 200; code = "submission.list";
        return sendJson(response, status, { submissions });
      }
      const submissionMatch = routeMatch(url.pathname, /^\/api\/causalyst\/submissions\/([^/]+)$/);
      if (submissionMatch && method === "GET") {
        const submission = await learningService.getSubmission(session, submissionMatch[0]);
        status = 200; code = "submission.detail";
        return sendJson(response, status, submission);
      }
      const reviewMatch = routeMatch(url.pathname, /^\/api\/causalyst\/submissions\/([^/]+)\/review$/);
      if (reviewMatch && method === "POST") {
        const body = await readBody(request, input.config.maxRequestBytes);
        requireLearning(body.status === "changes-requested" || body.status === "reviewed",
          "review.status", "Review status is invalid.");
        const review = await learningService.review(session, reviewMatch[0], {
          status: body.status,
          ...(typeof body.feedback === "string" ? { feedback: body.feedback } : {}),
          reviewedAt: String(body.reviewedAt ?? ""),
        });
        status = 201; code = "review.created";
        return sendJson(response, status, review);
      }
      const approveMatch = routeMatch(url.pathname, /^\/api\/causalyst\/submissions\/([^/]+)\/approve-score$/);
      if (approveMatch && method === "POST") {
        const body = await readBody(request, input.config.maxRequestBytes);
        const approval = await learningService.approveScore(session, approveMatch[0], {
          score: String(body.score ?? ""),
          scoreMaximum: String(body.scoreMaximum ?? ""),
          ...(typeof body.feedback === "string" ? { feedback: body.feedback } : {}),
          approvedAt: String(body.approvedAt ?? ""),
        });
        status = 201; code = "score.approved";
        return sendJson(response, status, approval);
      }
      const returnMatch = routeMatch(url.pathname, /^\/api\/causalyst\/submissions\/([^/]+)\/return-score$/);
      if (returnMatch && method === "POST") {
        const body = await readBody(request, input.config.maxRequestBytes);
        const transaction = await learningService.returnApprovedScore(
          session,
          returnMatch[0],
          String(body.idempotencyKey ?? ""),
        );
        status = transaction.status === "succeeded" ? 200 : 202;
        code = `ags.${transaction.status}`;
        return sendJson(response, status, transaction);
      }
      const deleteAssignment = routeMatch(url.pathname, /^\/api\/causalyst\/assignments\/([^/]+)$/);
      if (deleteAssignment && method === "DELETE") {
        const count = await learningService.deleteAssignment(session, deleteAssignment[0]);
        status = 200; code = "assignment.deleted";
        return sendJson(response, status, { deleted: count });
      }
      if (method === "DELETE" && url.pathname === "/api/causalyst/me") {
        const count = await learningService.deleteOwnUserData(session);
        status = 200; code = "user.deleted";
        return sendJson(response, status, { deleted: count });
      }
      if (method === "DELETE" && url.pathname === "/api/causalyst/deployment") {
        const count = await learningService.deleteDeployment(session);
        status = 200; code = "deployment.deleted";
        return sendJson(response, status, { deleted: count });
      }
      throw new LearningServiceError("route.not-found", "Route not found.", 404);
    } catch (error) {
      const known = error instanceof LearningServiceError;
      status = known ? error.status : 500;
      code = known ? error.code : "internal";
      sendJson(response, status, { error: { code, message: known ? error.message : "Internal service error." } });
    } finally {
      input.log?.(learningLogRecord(requestId, method, url.pathname, status, code));
    }
  });
};
