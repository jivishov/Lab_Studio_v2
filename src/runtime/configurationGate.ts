import type { ActionDefinition } from "../domain/types";

export interface ConfigurationLock {
  message: string;
  recovery: string;
}

export const configurationLockFor = (
  action: ActionDefinition | undefined,
  configured = false,
): ConfigurationLock | undefined => {
  if (
    action?.parameters.configurationRequired !== true ||
    action.parameters.unlocked !== false ||
    configured
  ) {
    return undefined;
  }

  return {
    message: "This step is locked until the required teacher configuration is approved.",
    recovery: "Ask the teacher to approve and unlock this optional workflow before continuing.",
  };
};
