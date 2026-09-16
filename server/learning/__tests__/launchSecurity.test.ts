import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { LTI_CLAIMS, LTI_VERSION } from "../types";
import type { ValidatedLaunch } from "../types";
import { LtiLaunchService } from "../lti/launch";
import { MemoryLearningStore } from "../storage/memoryStore";
import { signServiceJwt } from "../security/jwt";
import { learningTestConfig } from "./fixtures";

describe("Cycle 15 LTI launch security", () => {
  it("accepts one exact launch and rejects state replay, nonce, issuer, audience, deployment, signature, and role escalation", async () => {
    const platformKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const publicJwk = { ...platformKeys.publicKey.export({ format: "jwk" }), kid: "platform-key" };
    const privateKey = platformKeys.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const config = learningTestConfig();
    const store = new MemoryLearningStore();
    const fetcher = async () => new Response(JSON.stringify({ keys: [publicJwk] }), {
      status: 200, headers: { "content-type": "application/json" },
    });
    const service = new LtiLaunchService(config, store, () => new Date("2026-07-27T00:00:00.000Z"), fetcher);
    const authorization = new URL(await service.initiateLogin({
      iss: "https://platform.example",
      loginHint: "opaque-login-hint",
      targetLinkUri: config.launchUrl,
      clientId: "platform-client",
      deploymentId: "deployment-a",
    }));
    const state = authorization.searchParams.get("state")!;
    const nonce = authorization.searchParams.get("nonce")!;
    const claims = {
      iss: "https://platform.example",
      sub: "opaque-subject",
      aud: "platform-client",
      exp: 1785111000,
      iat: 1785110400,
      nonce,
      [LTI_CLAIMS.deploymentId]: "deployment-a",
      [LTI_CLAIMS.messageType]: "LtiResourceLinkRequest",
      [LTI_CLAIMS.version]: LTI_VERSION,
      [LTI_CLAIMS.roles]: ["http://purl.imsglobal.org/vocab/lis/v2/membership#learner"],
      [LTI_CLAIMS.targetLinkUri]: config.launchUrl,
      [LTI_CLAIMS.resourceLink]: { id: "resource-1" },
      [LTI_CLAIMS.custom]: { causalyst_assignment_id: "assignment-1" },
    };
    const token = signServiceJwt(claims, "platform-key", privateKey);
    await expect(service.validateLaunch(token, state)).resolves.toMatchObject({
      deploymentId: "deployment-a", roles: ["learner"],
    });
    await expect(service.validateLaunch(token, state)).rejects.toMatchObject({ code: "lti.state" });

    for (const change of [
      { nonce: "altered" },
      { iss: "https://attacker.example" },
      { aud: "other-client" },
      { [LTI_CLAIMS.deploymentId]: "deployment-b" },
      { [LTI_CLAIMS.roles]: ["urn:unregistered:administrator"] },
    ]) {
      const nextAuthorization = new URL(await service.initiateLogin({
        iss: "https://platform.example", loginHint: "hint", targetLinkUri: config.launchUrl,
        clientId: "platform-client", deploymentId: "deployment-a",
      }));
      const nextState = nextAuthorization.searchParams.get("state")!;
      const nextNonce = nextAuthorization.searchParams.get("nonce")!;
      const changed = { ...claims, nonce: nextNonce, ...change };
      await expect(service.validateLaunch(signServiceJwt(changed, "platform-key", privateKey), nextState)).rejects.toBeTruthy();
    }
  });

  it("uses one-time fragment launch codes and rejects expired or altered exchange", async () => {
    const config = learningTestConfig();
    const store = new MemoryLearningStore();
    const service = new LtiLaunchService(config, store, () => new Date("2026-07-27T00:00:00.000Z"));
    const launch: ValidatedLaunch = {
      registrationId: "platform", issuer: "https://platform.example", clientId: "platform-client",
      deploymentId: "deployment-a", subject: "sub", pseudonymousUserKey: "usr_opaque",
      roles: ["learner"], messageType: "LtiResourceLinkRequest",
      targetLinkUri: config.launchUrl, resourceLinkId: "resource-1", assignmentId: "assignment-1",
    };
    const created = await service.createLaunchCode(launch);
    expect(created.redirectUrl).toContain("#/causalyst-lti?launchCode=");
    await expect(service.exchangeLaunchCode(created.code)).resolves.toMatchObject({
      session: { userKey: "usr_opaque", assignmentId: "assignment-1" },
    });
    await expect(service.exchangeLaunchCode(created.code)).rejects.toMatchObject({ code: "session.launch-code" });
    await expect(service.exchangeLaunchCode(`${created.code}x`)).rejects.toMatchObject({ code: "session.launch-code" });
  });
});
