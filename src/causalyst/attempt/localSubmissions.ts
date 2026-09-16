import type { CausalystSubmissionPackage } from "../submission/types";

const key = "lab-studio:causalyst:v1:submissions";

export const listLocalSubmissionPackages = (): CausalystSubmissionPackage[] => {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? "[]") as unknown;
    return Array.isArray(value) ? value as CausalystSubmissionPackage[] : [];
  } catch {
    return [];
  }
};

export const saveLocalSubmissionPackage = (value: CausalystSubmissionPackage): void => {
  const current = listLocalSubmissionPackages().filter(({ packageId }) => packageId !== value.packageId);
  window.localStorage.setItem(key, JSON.stringify([...current, value]));
};

export const getLocalSubmissionPackage = (
  submissionId: string,
): CausalystSubmissionPackage | undefined => listLocalSubmissionPackages()
  .find(({ submission }) => submission.submissionId === submissionId);

