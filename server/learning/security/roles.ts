import type { LearningRole } from "../types";

const roleMap = new Map<string, LearningRole>([
  ["http://purl.imsglobal.org/vocab/lis/v2/membership#learner", "learner"],
  ["http://purl.imsglobal.org/vocab/lis/v2/membership#instructor", "instructor"],
  ["http://purl.imsglobal.org/vocab/lis/v2/institution/person#administrator", "administrator"],
  ["http://purl.imsglobal.org/vocab/lis/v2/system/person#administrator", "administrator"],
]);

export const mapLtiRoles = (value: unknown): LearningRole[] => {
  if (!Array.isArray(value)) return [];
  const roles = value.flatMap((role) => typeof role === "string" && roleMap.has(role) ? [roleMap.get(role)!] : []);
  return [...new Set(roles)].sort();
};
