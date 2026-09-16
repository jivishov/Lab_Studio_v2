import type { LearningServiceConfig, DeepLinkSelection, ValidatedLaunch } from "../types";
import { requireLearning } from "../errors";
import { randomOpaque } from "../security/identifiers";
import { signServiceJwt } from "../security/jwt";
import { LTI_CLAIMS, LTI_VERSION } from "../types";

export const createDeepLinkResponse = (input: {
  config: LearningServiceConfig;
  launch: ValidatedLaunch;
  selection: DeepLinkSelection;
  now: Date;
}): { idToken: string; returnUrl: string } => {
  requireLearning(input.launch.messageType === "LtiDeepLinkingRequest",
    "deep-link.message", "Deep Link response requires a Deep Linking launch.", 403);
  requireLearning(input.launch.deepLinkReturnUrl, "deep-link.return-url", "Platform did not provide a Deep Link return URL.");
  const registration = input.config.registrations.find(({ id }) => id === input.launch.registrationId);
  requireLearning(registration?.allowedServices.includes("deep-linking"),
    "deep-link.disabled", "Deep Linking is disabled for this registration.", 403);
  const nowSeconds = Math.floor(input.now.getTime() / 1000);
  const contentItem = {
    type: "ltiResourceLink",
    title: input.selection.title,
    text: input.selection.text,
    url: input.config.launchUrl,
    custom: { causalyst_assignment_id: input.selection.assignmentId },
    ...(input.selection.gradable && input.launch.deepLinkAcceptsLineItem ? {
      lineItem: {
        scoreMaximum: input.selection.scoreMaximum,
        label: input.selection.title,
        resourceId: input.selection.assignmentId,
        tag: "causalyst",
      },
    } : {}),
  };
  return {
    returnUrl: input.launch.deepLinkReturnUrl,
    idToken: signServiceJwt({
      iss: input.launch.clientId,
      aud: input.launch.issuer,
      azp: input.launch.clientId,
      iat: nowSeconds,
      exp: nowSeconds + 300,
      nonce: randomOpaque("dl"),
      [LTI_CLAIMS.deploymentId]: input.launch.deploymentId,
      [LTI_CLAIMS.messageType]: "LtiDeepLinkingResponse",
      [LTI_CLAIMS.version]: LTI_VERSION,
      [LTI_CLAIMS.deepLinkingContentItems]: [contentItem],
      ...(input.launch.deepLinkData ? {
        [LTI_CLAIMS.deepLinkingData]: input.launch.deepLinkData,
      } : {}),
    }, input.config.keyId, input.config.privateKeyPem),
  };
};
