import {
  atomById,
  deriveActionEffectContract,
  missingRoleBindings,
  roleAcceptsEquipment,
} from "./atomRegistry";
import { bundledCatalogPolicyMigrationEntries } from "./bundledCatalogPolicyMigration";
import type {
  ActionDefinition,
  ActionEffectClass,
  CompositionManifest,
  LabCompositionSourceDefinition,
  LabDefinition,
  OrderedProcedureContract,
  ProcessDefinition,
  TechniqueDefinition,
} from "./types";

/**
 * F03 is deliberately a bundled-catalog boundary, not a global reader rule. Generic imports,
 * detached exports, and arbitrary hydrators continue to use their existing structural validators.
 */
export const BUNDLED_CATALOG_POLICY_SCHEMA_VERSION = "lab-studio/bundled-catalog-policy@1" as const;

/**
 * Production bundled loading is final-strict. Diagnostic inventory is the only mode that may
 * classify an exact, reviewed migration entry as transition debt; the mode is chosen by the
 * trusted caller and is never read from bundled content.
 */
export const BUNDLED_CATALOG_POLICY_FINAL_STRICT = "final-strict" as const;
export const BUNDLED_CATALOG_POLICY_DIAGNOSTIC = "diagnostic" as const;
export type BundledCatalogPolicyMode =
  | typeof BUNDLED_CATALOG_POLICY_FINAL_STRICT
  | typeof BUNDLED_CATALOG_POLICY_DIAGNOSTIC;

export type BundledCatalogAuthority = "public-bundle" | "fixture-fallback";

export type BundledCatalogOwnerKind =
  | "technique"
  | "lab-local"
  | "lab-embedded-technique"
  | "fixture-technique"
  | "fixture-lab"
  | "fixture-lab-embedded-technique";

export interface BundledCatalogOwner {
  kind: BundledCatalogOwnerKind;
  /** Stable catalog owner, not a generated compiled-instance identifier. */
  id: string;
  /** Required for technique-like owners and omitted for lab-local actions. */
  version?: string;
  /** Exact public file or exact fixture identity that supplied this source. */
  artifact: string;
}

export interface BundledCatalogSurface {
  authority: BundledCatalogAuthority;
  owner: BundledCatalogOwner;
  actions: readonly ActionDefinition[];
  process: ProcessDefinition;
  /** Structural ordered-procedure metadata used to prove canonical/alias producer alternatives. */
  orderedProcedure?: OrderedProcedureContract;
}

export type BundledCatalogPolicyRule =
  | "bundled/atom-identity"
  | "bundled/effect-derivation"
  | "bundled/atom-role-binding"
  | "bundled/mass-output"
  | "bundled/mass-unit"
  | "bundled/mass-producer"
  | "bundled/mass-scope"
  | "bundled/mass-origin"
  | "bundled/mass-unsupported-capability";

export interface BundledCatalogPolicyFinding {
  rule: BundledCatalogPolicyRule;
  owner: BundledCatalogOwner;
  sourceActionId: string;
  /** Full SHA-256 of the versioned policy projection; never the old 12-character lint hash. */
  semanticFingerprint: string;
  detail: string;
  derivedClasses?: ActionEffectClass[];
  relatedActionIds?: string[];
  transition: "allowed-existing-debt" | "blocking";
  migrationEntryId?: string;
}

export interface BundledCatalogPolicyMigrationEntry {
  id: string;
  policySchemaVersion: typeof BUNDLED_CATALOG_POLICY_SCHEMA_VERSION;
  rule:
    | "bundled/atom-identity"
    | "bundled/mass-output"
    | "bundled/mass-producer"
    | "bundled/mass-unsupported-capability";
  authority: BundledCatalogAuthority;
  owner: BundledCatalogOwner;
  sourceActionId: string;
  semanticFingerprint: string;
  /** The repair batch is explicit so this never becomes a permanent legacy exemption. */
  repairBatch: "F04" | "F05";
  disposition: "existing-unresolved-debt" | "existing-unresolved-capability-block";
  removalCondition: string;
  /** F02 owns source/compiled origin identity; this records the relevant authoring surface. */
  f02Evidence: string;
  sourceEvidence: string;
}

export interface BundledCatalogMigrationIssue {
  kind: "invalid-entry" | "stale-entry";
  entryId: string;
  detail: string;
}

export interface BundledCatalogPolicyResult {
  schemaVersion: typeof BUNDLED_CATALOG_POLICY_SCHEMA_VERSION;
  evaluationMode: BundledCatalogPolicyMode;
  findings: BundledCatalogPolicyFinding[];
  transitionFindings: BundledCatalogPolicyFinding[];
  blockingFindings: BundledCatalogPolicyFinding[];
  migrationIssues: BundledCatalogMigrationIssue[];
  /**
   * In final-strict mode this requires no blocking finding and no migration issue. In diagnostic
   * mode, an exact reviewed migration entry may be reported in transitionFindings and does not
   * make this diagnostic result fail; that diagnostic result is never a production load decision.
   */
  accepted: boolean;
}

interface PendingFinding {
  rule: BundledCatalogPolicyRule;
  owner: BundledCatalogOwner;
  authority: BundledCatalogAuthority;
  action: ActionDefinition;
  detail: string;
  derivedClasses?: ActionEffectClass[];
  relatedActionIds?: string[];
  /** Derivation/origin faults are never transitionable, even if someone adds an entry by hand. */
  neverTransition?: boolean;
  fingerprintContext?: Record<string, unknown>;
}

const identityRequiredClasses = new Set<ActionEffectClass>([
  "apparatus-material-instrument-state",
  "measurement-direct-observation-acquisition",
]);

const transitionableRules = new Set<BundledCatalogPolicyMigrationEntry["rule"]>([
  "bundled/atom-identity",
  "bundled/mass-output",
  "bundled/mass-producer",
  "bundled/mass-unsupported-capability",
]);

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    );
  }
  return value;
};

const stableJson = (value: unknown): string => JSON.stringify(stableValue(value));

const rightRotate = (value: number, amount: number): number =>
  (value >>> amount) | (value << (32 - amount));

/**
 * A portable SHA-256 for public catalog fingerprints. Web Crypto is secure-context gated, while
 * bundled loading is supported on existing HTTP development and LAN hosts as well as HTTPS.
 * This hashes only the internal policy projection; it is not used for secrecy or authentication.
 */
export const bundledCatalogPolicySha256 = (value: string): string => {
  const source = new TextEncoder().encode(value);
  const bitLength = source.length * 8;
  const paddedLength = Math.ceil((source.length + 9) / 64) * 64;
  const message = new Uint8Array(paddedLength);
  message.set(source);
  message[source.length] = 0x80;
  const view = new DataView(message.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x1_0000_0000));
  view.setUint32(paddedLength - 4, bitLength >>> 0);

  const hash = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  for (let offset = 0; offset < paddedLength; offset += 64) {
    const words = new Uint32Array(64);
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4);
    for (let index = 16; index < 64; index += 1) {
      const left = words[index - 15]!;
      const right = words[index - 2]!;
      const sigma0 = rightRotate(left, 7) ^ rightRotate(left, 18) ^ (left >>> 3);
      const sigma1 = rightRotate(right, 17) ^ rightRotate(right, 19) ^ (right >>> 10);
      words[index] = (words[index - 16]! + sigma0 + words[index - 7]! + sigma1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const sigma1 = rightRotate(e!, 6) ^ rightRotate(e!, 11) ^ rightRotate(e!, 25);
      const choose = (e! & f!) ^ (~e! & g!);
      const temporary1 = (h! + sigma1 + choose + constants[index]! + words[index]!) >>> 0;
      const sigma0 = rightRotate(a!, 2) ^ rightRotate(a!, 13) ^ rightRotate(a!, 22);
      const majority = (a! & b!) ^ (a! & c!) ^ (b! & c!);
      const temporary2 = (sigma0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d! + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }
    hash[0] = (hash[0]! + a!) >>> 0;
    hash[1] = (hash[1]! + b!) >>> 0;
    hash[2] = (hash[2]! + c!) >>> 0;
    hash[3] = (hash[3]! + d!) >>> 0;
    hash[4] = (hash[4]! + e!) >>> 0;
    hash[5] = (hash[5]! + f!) >>> 0;
    hash[6] = (hash[6]! + g!) >>> 0;
    hash[7] = (hash[7]! + h!) >>> 0;
  }
  return Array.from(hash, (word) => word.toString(16).padStart(8, "0")).join("");
};

const nonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const configuredReference = (value: unknown): boolean =>
  typeof value === "string" && /^\{\{config\.[a-zA-Z0-9_-]+\}\}$/.test(value);

/**
 * The policy projection retains all authoring parameters except presentation-only copy. This keeps
 * quantities, conditions, handler inputs, IDs, and other operational values in an exact debt
 * fingerprint rather than accidentally treating a scientific change as unchanged legacy debt.
 */
const presentationCopySuffix = /(?:Label|Hint|Instruction|Feedback|Description|Prompt|Note)$/i;
const operationalParameterName = /(?:amount|concentration|count|cycle|duration|evidence|identity|instrument|mass|measurement|molar|mole|output|ph|pressure|reference|replicate|sample|source|support|target|temperature|time|tolerance|unit|volume|wavelength)/i;

const policyRelevantParameters = (parameters: ActionDefinition["parameters"]): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(parameters).filter(([key, value]) =>
      typeof value !== "string" ||
      operationalParameterName.test(key) ||
      !presentationCopySuffix.test(key),
    ),
  );

const policyProjection = (
  pending: PendingFinding,
): Record<string, unknown> => ({
  policySchemaVersion: BUNDLED_CATALOG_POLICY_SCHEMA_VERSION,
  rule: pending.rule,
  authority: pending.authority,
  owner: pending.owner,
  sourceActionId: pending.action.id,
  action: {
    id: pending.action.id,
    verb: pending.action.verb,
    // `label`, stateChanges, and evidence currently participate in runtime handler selection, so
    // they are operational here even though they are text. Feedback and invalid-case prose do not.
    label: pending.action.label,
    atomId: pending.action.atomId,
    equipmentRoleBindings: pending.action.equipmentRoleBindings,
    effect: pending.action.effect,
    interaction: pending.action.interaction,
    mass: pending.action.mass,
    volume: pending.action.volume,
    analysis: pending.action.analysis,
    runtimeRepeat: pending.action.runtimeRepeat,
    sourceInventory: pending.action.sourceInventory,
    // Solid-transfer semantics decide whether a destination receives a physical mass or a
    // qualitative provenance record, so two actions differing only here are not the same action.
    // An absent contract stays invisible: `stableJson` is `JSON.stringify`, which omits
    // `undefined`-valued properties, so every fingerprint recorded before this field existed is
    // byte-identical under the extended projection.
    solidTransfer: pending.action.solidTransfer,
    extractionOperation: pending.action.extractionOperation,
    extractionObservation: pending.action.extractionObservation,
    extractionIdentity: pending.action.extractionIdentity,
    extractionDrain: pending.action.extractionDrain,
    fractionHandling: pending.action.fractionHandling,
    materialTransition: pending.action.materialTransition,
    deliveryDevice: pending.action.deliveryDevice,
    choiceObservation: pending.action.choiceObservation,
    dilutionFactorOutputId: pending.action.dilutionFactorOutputId,
    parameters: policyRelevantParameters(pending.action.parameters),
    prerequisites: pending.action.prerequisites,
    stateChanges: pending.action.stateChanges,
    evidence: pending.action.evidence,
  },
  derivedClasses: pending.derivedClasses?.slice().sort(),
  relatedActionIds: pending.relatedActionIds?.slice().sort(),
  fingerprintContext: pending.fingerprintContext,
});

export const bundledCatalogSemanticFingerprint = async (
  finding: Omit<BundledCatalogPolicyFinding, "semanticFingerprint" | "transition" | "migrationEntryId"> & {
    authority: BundledCatalogAuthority;
    action: ActionDefinition;
    fingerprintContext?: Record<string, unknown>;
  },
): Promise<string> => bundledCatalogPolicySha256(stableJson(policyProjection({
  rule: finding.rule,
  owner: finding.owner,
  authority: finding.authority,
  action: finding.action,
  detail: finding.detail,
  derivedClasses: finding.derivedClasses,
  relatedActionIds: finding.relatedActionIds,
  fingerprintContext: finding.fingerprintContext,
})));

const ownerKey = (authority: BundledCatalogAuthority, owner: BundledCatalogOwner, actionId: string, rule: string): string =>
  stableJson({ authority, owner, sourceActionId: actionId, rule });

const sameOwner = (left: BundledCatalogOwner, right: BundledCatalogOwner): boolean =>
  left.kind === right.kind && left.id === right.id && left.version === right.version && left.artifact === right.artifact;

/**
 * This recognizes only the exact legacy block shape. It is not an approval: source disposition and
 * runtime non-executability remain separate F04/F05 evidence before final strict activation.
 */
const isExistingUnsupportedMassCapabilityBlock = (action: ActionDefinition): boolean => {
  const parameters = action.parameters;
  const hasExactLegacyGuardPrerequisite = action.prerequisites.some((rule) =>
    rule.type === "statePath" &&
    rule.path === "unsupportedMassOutputBindingApproved" &&
    rule.equals === true,
  );
  return action.mass === undefined &&
    parameters.inputMode === "numeric" &&
    parameters.inputRole === "studentResponse" &&
    parameters.configurationRequired === true &&
    parameters.unlocked === false &&
    parameters.sourceConfigurationBlock === "mass-acquisition-output-contract-conflict" &&
    hasExactLegacyGuardPrerequisite;
};

const massOutputId = (action: ActionDefinition): string | undefined =>
  action.mass?.source === "action-input" && nonEmptyString(action.mass.outputMeasurementId)
    ? action.mass.outputMeasurementId
    : undefined;

type OrderedProcedureGroup = OrderedProcedureContract["groups"][number];

interface OrderedProcedureAliasRelation {
  sourceId: string;
  targetId: string;
  group: OrderedProcedureGroup;
}

interface StructuralMassProducerAlternative {
  canonicalId: string;
  aliasId: string;
  canonicalGroup: OrderedProcedureGroup;
  aliasGroup: OrderedProcedureGroup;
}

const orderedProcedureAliasRelations = (
  plan: OrderedProcedureContract,
): OrderedProcedureAliasRelation[] => plan.groups.flatMap((group) =>
  Object.entries(group.actionAliases ?? {}).map(([sourceId, targetId]) => ({ sourceId, targetId, group })),
);

const orderedProcedureGroupsForAction = (
  plan: OrderedProcedureContract,
  actionId: string,
): OrderedProcedureGroup[] => plan.groups.filter((group) => group.actionIds.includes(actionId));

const orderedProcedureGroupDependencyReaches = (
  plan: OrderedProcedureContract,
  startGroupId: string,
  targetGroupId: string,
  relation: "requiresEarlier" | "requiresSelected",
): boolean => {
  const groups = new Map(plan.groups.map((group) => [group.id, group]));
  if (!groups.has(startGroupId) || !groups.has(targetGroupId)) return false;
  const queue = [...(groups.get(startGroupId)?.[relation] ?? [])];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const groupId = queue.shift()!;
    if (groupId === targetGroupId) return true;
    if (visited.has(groupId)) continue;
    visited.add(groupId);
    queue.push(...(groups.get(groupId)?.[relation] ?? []));
  }
  return false;
};

/**
 * `requiresEarlier` is an order constraint only when its referenced group is selected. Traverse
 * through a dependency edge only when the intermediate group is unavoidably selected by the
 * consumer's `requiresSelected` closure (or by the caller's alternative-family proof).
 */
const orderedProcedureGroupOrderReaches = (
  plan: OrderedProcedureContract,
  startGroupId: string,
  targetGroupId: string,
  additionallySelectedGroupIds: readonly string[] = [],
): boolean => {
  const groups = new Map(plan.groups.map((group) => [group.id, group]));
  if (!groups.has(startGroupId) || !groups.has(targetGroupId)) return false;
  const guaranteedSelected = new Set([startGroupId, ...additionallySelectedGroupIds]);
  const selectionQueue = [startGroupId];
  while (selectionQueue.length > 0) {
    const groupId = selectionQueue.shift()!;
    for (const required of groups.get(groupId)?.requiresSelected ?? []) {
      if (guaranteedSelected.has(required)) continue;
      guaranteedSelected.add(required);
      selectionQueue.push(required);
    }
  }
  if (!guaranteedSelected.has(targetGroupId)) return false;
  const queue = [startGroupId];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const groupId = queue.shift()!;
    if (visited.has(groupId)) continue;
    visited.add(groupId);
    for (const required of groups.get(groupId)?.requiresEarlier ?? []) {
      if (required === targetGroupId) return true;
      if (guaranteedSelected.has(required)) queue.push(required);
    }
  }
  return false;
};

const orderedProcedureAliasGraphHasCycle = (
  relations: readonly OrderedProcedureAliasRelation[],
): boolean => {
  const outgoing = new Map<string, string[]>();
  for (const relation of relations) {
    const targets = outgoing.get(relation.sourceId) ?? [];
    targets.push(relation.targetId);
    outgoing.set(relation.sourceId, targets);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (actionId: string): boolean => {
    if (visiting.has(actionId)) return true;
    if (visited.has(actionId)) return false;
    visiting.add(actionId);
    for (const targetId of outgoing.get(actionId) ?? []) if (visit(targetId)) return true;
    visiting.delete(actionId);
    visited.add(actionId);
    return false;
  };
  return [...outgoing.keys()].some((actionId) => visit(actionId));
};

/**
 * A duplicate mass producer is transitionable only when the materializer proves that the two
 * actions are one canonical/alias alternative. `actionAliases` is deliberately asymmetric: its
 * source is global canonical identity and its target is owned by the alias group, so both IDs are
 * not expected in the same group. Same-family uniqueness is the materializer's exclusion proof;
 * dependency, alias-map ambiguity, and alias-chain checks keep that proof fail-closed.
 */
const findStructuralMassProducerAlternative = (
  surface: Pick<BundledCatalogSurface, "actions" | "orderedProcedure">,
  producers: readonly ActionDefinition[],
): StructuralMassProducerAlternative | undefined => {
  if (producers.length !== 2 || new Set(producers.map((producer) => producer.id)).size !== 2) return undefined;
  if (producers.some((producer) => producer.verb !== "weigh")) return undefined;
  const plan = surface.orderedProcedure;
  if (!plan || new Set(plan.groups.map((group) => group.id)).size !== plan.groups.length) return undefined;
  const actions = new Map(surface.actions.map((action) => [action.id, action]));
  if (actions.size !== surface.actions.length) return undefined;
  const producerIds = new Set(producers.map((producer) => producer.id));
  const relations = orderedProcedureAliasRelations(plan);
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const relation of relations) {
    const targets = outgoing.get(relation.sourceId) ?? [];
    targets.push(relation.targetId);
    outgoing.set(relation.sourceId, targets);
    const sources = incoming.get(relation.targetId) ?? [];
    sources.push(relation.sourceId);
    incoming.set(relation.targetId, sources);
  }
  if ([...outgoing.values()].some((targets) => targets.length !== 1) || [...incoming.values()].some((sources) => sources.length !== 1)) return undefined;
  if (orderedProcedureAliasGraphHasCycle(relations)) return undefined;
  const matches = relations.filter((relation) => producerIds.has(relation.sourceId) && producerIds.has(relation.targetId));
  if (matches.length !== 1) return undefined;
  const relation = matches[0]!;
  const canonicalAction = actions.get(relation.sourceId);
  const aliasAction = actions.get(relation.targetId);
  if (!canonicalAction || !aliasAction || relation.sourceId === relation.targetId || massOutputId(canonicalAction) !== massOutputId(aliasAction)) return undefined;
  const canonicalGroups = orderedProcedureGroupsForAction(plan, relation.sourceId);
  const aliasGroups = orderedProcedureGroupsForAction(plan, relation.targetId);
  if (canonicalGroups.length !== 1 || aliasGroups.length !== 1) return undefined;
  const canonicalGroup = canonicalGroups[0]!;
  const aliasGroup = aliasGroups[0]!;
  if (relation.group.id !== aliasGroup.id || canonicalGroup.id === aliasGroup.id) return undefined;
  if (!canonicalGroup.family || canonicalGroup.family !== aliasGroup.family) return undefined;
  // A source with an incoming edge or a target with an outgoing edge would make this a chain.
  if ((incoming.get(relation.sourceId)?.length ?? 0) > 0 || (outgoing.get(relation.targetId)?.length ?? 0) > 0) return undefined;
  for (const dependency of ["requiresEarlier", "requiresSelected"] as const) {
    if (orderedProcedureGroupDependencyReaches(plan, canonicalGroup.id, aliasGroup.id, dependency) ||
        orderedProcedureGroupDependencyReaches(plan, aliasGroup.id, canonicalGroup.id, dependency)) return undefined;
  }
  return { canonicalId: relation.sourceId, aliasId: relation.targetId, canonicalGroup, aliasGroup };
};

/**
 * Return only mass-output ids whose two producers are proved to be one canonical/alias
 * alternative. This is intentionally narrower than a duplicate-output allowlist: undeclared,
 * chained, dependent, or simultaneous producers remain absent and must be rejected by callers.
 */
export const structurallyExclusiveMassOutputIds = (
  actions: readonly ActionDefinition[],
  orderedProcedure?: OrderedProcedureContract,
): ReadonlySet<string> => {
  if (!orderedProcedure) return new Set<string>();
  const ownersByOutputId = new Map<string, ActionDefinition[]>();
  for (const action of actions) {
    const outputId = massOutputId(action);
    if (!outputId) continue;
    const owners = ownersByOutputId.get(outputId) ?? [];
    owners.push(action);
    ownersByOutputId.set(outputId, owners);
  }
  const surface = { actions, orderedProcedure };
  const accepted = new Set<string>();
  for (const [outputId, owners] of ownersByOutputId) {
    if (findStructuralMassProducerAlternative(surface, owners)) accepted.add(outputId);
  }
  return accepted;
};

const processNodeIdsForAction = (process: ProcessDefinition, actionId: string): string[] =>
  process.nodes.filter((node) => node.actionId === actionId).map((node) => node.id);

const processEntryNodeIdsForTarget = (
  process: ProcessDefinition,
  targetNodeId: string,
): string[] => {
  const nodeIds = new Set(process.nodes.map((node) => node.id));
  if (!nodeIds.has(targetNodeId)) return [];
  const incoming = new Map<string, string[]>();
  for (const edge of process.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) continue;
    const sources = incoming.get(edge.to) ?? [];
    sources.push(edge.from);
    incoming.set(edge.to, sources);
  }
  const ancestors = new Set<string>();
  const queue = [targetNodeId];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (ancestors.has(nodeId)) continue;
    ancestors.add(nodeId);
    queue.push(...(incoming.get(nodeId) ?? []));
  }
  return [...ancestors].filter((nodeId) =>
    !(incoming.get(nodeId) ?? []).some((sourceId) => ancestors.has(sourceId)),
  );
};

const processCanReachWithout = (
  process: ProcessDefinition,
  startNodeIds: readonly string[],
  targetNodeId: string,
  blockedNodeIds: ReadonlySet<string>,
): boolean => {
  const nodeIds = new Set(process.nodes.map((node) => node.id));
  if (!nodeIds.has(targetNodeId)) return false;
  const outgoing = new Map<string, string[]>();
  for (const edge of process.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) continue;
    const targets = outgoing.get(edge.from) ?? [];
    targets.push(edge.to);
    outgoing.set(edge.from, targets);
  }
  const queue = startNodeIds.filter((nodeId) => nodeIds.has(nodeId));
  const visited = new Set<string>();
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId) || blockedNodeIds.has(nodeId)) continue;
    if (nodeId === targetNodeId) return true;
    visited.add(nodeId);
    queue.push(...(outgoing.get(nodeId) ?? []));
  }
  return false;
};

/**
 * Evidence must dominate its consumer in the authored process. Array position is insufficient:
 * composition can reorder actions, branch around a producer, or emit repeated scoped instances.
 */
const producerOrderingIssue = (
  process: ProcessDefinition,
  producerActionId: string,
  consumerActionId: string,
): string | undefined => {
  const producerNodeIds = processNodeIdsForAction(process, producerActionId);
  const consumerNodeIds = processNodeIdsForAction(process, consumerActionId);
  if (producerNodeIds.length === 0) return `Mass producer "${producerActionId}" has no process node.`;
  if (consumerNodeIds.length === 0) return `Mass consumer "${consumerActionId}" has no process node.`;
  const blocked = new Set(producerNodeIds);
  for (const consumerNodeId of consumerNodeIds) {
    // Technique processes may contain several deliberate entry components that the composition
    // compiler connects later. Dominance is therefore assessed from this consumer's component
    // entries, rather than from the technique's single display/default start node.
    const entryNodeIds = processEntryNodeIdsForTarget(process, consumerNodeId);
    if (entryNodeIds.length === 0) {
      return `Mass consumer node "${consumerNodeId}" has no acyclic process entry from which producer ordering can be established.`;
    }
    if (processCanReachWithout(process, entryNodeIds, consumerNodeId, blocked)) {
      return `Mass consumer node "${consumerNodeId}" is reachable without first completing producer "${producerActionId}".`;
    }
  }
  return undefined;
};

const orderedProcedureAlternativeFamilyIsRequired = (
  plan: OrderedProcedureContract,
  alternative: StructuralMassProducerAlternative,
): boolean => {
  const family = alternative.canonicalGroup.family;
  if (!family || !plan.requiredFamilies?.includes(family)) return false;
  const familyGroups = plan.groups.filter((group) => group.family === family);
  const alternativeGroupIds = new Set([alternative.canonicalGroup.id, alternative.aliasGroup.id]);
  return familyGroups.length === alternativeGroupIds.size && familyGroups.every((group) => alternativeGroupIds.has(group.id));
};

/**
 * Check a consumer against the materialized alternative set. A consumer inside one alternative is
 * ordered against that alternative's producer only; a shared consumer must have an unavoidable
 * producer family/group and be after every producer route that can supply it. This avoids requiring
 * mutually exclusive producers to dominate the same raw consumer simultaneously while still
 * rejecting an end/common consumer whose producer family could be omitted.
 */
const massProducerAlternativeOrderingIssue = (
  surface: BundledCatalogSurface,
  alternative: StructuralMassProducerAlternative,
  consumer: ActionDefinition,
): string | undefined => {
  const plan = surface.orderedProcedure;
  if (!plan) return `Mass consumer "${consumer.id}" has no ordered-procedure alternative proof.`;
  const consumerGroups = orderedProcedureGroupsForAction(plan, consumer.id);
  if (consumerGroups.length > 1) return `Mass consumer "${consumer.id}" belongs to multiple ordered-procedure groups.`;
  if (consumerGroups.length === 0) {
    if (plan.endActionIds.includes(consumer.id)) {
      return orderedProcedureAlternativeFamilyIsRequired(plan, alternative)
        ? undefined
        : `Mass consumer "${consumer.id}" has no unavoidable selected producer family for end-action materialization.`;
    }
    if (plan.startActionIds.includes(consumer.id)) return `Mass consumer "${consumer.id}" is a start action before its producer alternative.`;
    return `Mass consumer "${consumer.id}" is not owned by an ordered-procedure group or end action.`;
  }
  const consumerGroup = consumerGroups[0]!;
  const producerId = consumerGroup.id === alternative.canonicalGroup.id
    ? alternative.canonicalId
    : consumerGroup.id === alternative.aliasGroup.id
      ? alternative.aliasId
      : undefined;
  if (producerId) {
    const producerIndex = consumerGroup.actionIds.indexOf(producerId);
    const consumerIndex = consumerGroup.actionIds.indexOf(consumer.id);
    if (producerIndex < 0 || consumerIndex < 0 || producerIndex >= consumerIndex) {
      return `Mass consumer "${consumer.id}" must follow producer "${producerId}" within materialized group "${consumerGroup.id}".`;
    }
    return undefined;
  }
  const requiresCanonical = orderedProcedureGroupDependencyReaches(
    plan,
    consumerGroup.id,
    alternative.canonicalGroup.id,
    "requiresSelected",
  );
  const requiresAlias = orderedProcedureGroupDependencyReaches(
    plan,
    consumerGroup.id,
    alternative.aliasGroup.id,
    "requiresSelected",
  );
  if (requiresCanonical && requiresAlias) {
    return `Mass consumer "${consumer.id}" requires both mutually exclusive producer groups "${alternative.canonicalGroup.id}" and "${alternative.aliasGroup.id}".`;
  }
  if (requiresCanonical || requiresAlias) {
    const producerGroup = requiresCanonical ? alternative.canonicalGroup : alternative.aliasGroup;
    const requiredProducerId = requiresCanonical ? alternative.canonicalId : alternative.aliasId;
    if (!orderedProcedureGroupOrderReaches(plan, consumerGroup.id, producerGroup.id, [producerGroup.id])) {
      return `Mass consumer "${consumer.id}" requires selected producer "${requiredProducerId}" in group "${producerGroup.id}" but does not require it earlier in the materialized route.`;
    }
    return undefined;
  }
  if (!orderedProcedureAlternativeFamilyIsRequired(plan, alternative)) {
    return `Mass consumer "${consumer.id}" has no unavoidable selected producer family/group in its materialized route.`;
  }
  const followsCanonical = orderedProcedureGroupOrderReaches(
    plan,
    consumerGroup.id,
    alternative.canonicalGroup.id,
    [alternative.canonicalGroup.id],
  );
  const followsAlias = orderedProcedureGroupOrderReaches(
    plan,
    consumerGroup.id,
    alternative.aliasGroup.id,
    [alternative.aliasGroup.id],
  );
  if (followsCanonical && followsAlias) return undefined;
  return `Mass consumer "${consumer.id}" is not ordered after both possible producer groups "${alternative.canonicalGroup.id}" and "${alternative.aliasGroup.id}".`;
};

const pushActionFindings = (
  surface: BundledCatalogSurface,
  action: ActionDefinition,
  findings: PendingFinding[],
): void => {
  const derived = deriveActionEffectContract(action);
  if (derived.errors.length > 0 || !derived.contract) {
    findings.push({
      rule: "bundled/effect-derivation",
      owner: surface.owner,
      authority: surface.authority,
      action,
      detail: derived.errors.length > 0
        ? `The canonical effect derivation failed: ${derived.errors.join(" ")}`
        : "The canonical effect derivation returned no contract.",
      neverTransition: true,
    });
  } else {
    const derivedClasses = derived.contract.classes;
    if (derivedClasses.some((effectClass) => identityRequiredClasses.has(effectClass)) && !action.atomId) {
      findings.push({
        rule: "bundled/atom-identity",
        owner: surface.owner,
        authority: surface.authority,
        action,
        detail: "The canonical effect derivation requires a registry atom for this physical or acquisitive action.",
        derivedClasses,
      });
    }
    if (action.atomId && atomById.has(action.atomId)) {
      const missing = missingRoleBindings(action.atomId, action.equipmentRoleBindings);
      const incompatible = Object.entries(action.equipmentRoleBindings ?? {})
        .filter(([roleId, definitionId]) => !roleAcceptsEquipment(roleId, definitionId))
        .map(([roleId]) => roleId);
      if (missing.length > 0 || incompatible.length > 0) {
        findings.push({
          rule: "bundled/atom-role-binding",
          owner: surface.owner,
          authority: surface.authority,
          action,
          detail: [
            missing.length > 0 ? `missing required role bindings: ${missing.join(", ")}` : "",
            incompatible.length > 0 ? `unknown or incompatible role bindings: ${incompatible.join(", ")}` : "",
          ].filter(Boolean).join("; "),
          derivedClasses,
          neverTransition: true,
        });
      }
    }
  }

  if (action.verb === "weigh") {
    const outputId = massOutputId(action);
    if (outputId) {
      // The reducer writes action-input mass records as grams. This policy deliberately adds no
      // positive-value rule: zero-capable tare execution remains an F04 runtime repair/verification.
      if (action.parameters.unit !== undefined && action.parameters.unit !== "g") {
        findings.push({
          rule: "bundled/mass-unit",
          owner: surface.owner,
          authority: surface.authority,
          action,
          detail: `Mass output "${outputId}" is written in grams but declares unit "${String(action.parameters.unit)}".`,
          neverTransition: true,
        });
      }
      const outputProblems: string[] = [];
      if (action.parameters.inputMode !== "numeric" || action.parameters.inputRole !== "studentResponse") {
        outputProblems.push(`Mass output "${outputId}" requires numeric student-response input.`);
      }
      const outputOwners = surface.actions.filter((candidate) => massOutputId(candidate) === outputId);
      const structuralAlternative = findStructuralMassProducerAlternative(surface, outputOwners);
      if (outputOwners.length !== 1 && !structuralAlternative) {
        outputProblems.push(
          `Mass output "${outputId}" is declared by ${outputOwners.length} weighing actions in this authoring scope; exactly one producer is required.`,
        );
      }
      if (outputProblems.length > 0) {
        findings.push({
          rule: "bundled/mass-output",
          owner: surface.owner,
          authority: surface.authority,
          action,
          detail: outputProblems.join(" "),
          neverTransition: outputOwners.length !== 1,
        });
      }
    } else if (isExistingUnsupportedMassCapabilityBlock(action)) {
      findings.push({
        rule: "bundled/mass-unsupported-capability",
        owner: surface.owner,
        authority: surface.authority,
        action,
        detail: "This exact legacy capability block has no typed mass output. It remains named transitional debt and does not establish source approval or runtime non-executability.",
      });
    } else {
      findings.push({
        rule: "bundled/mass-output",
        owner: surface.owner,
        authority: surface.authority,
        action,
        detail: "An executable weighing action requires a declared action-input mass output; legacy measurementId, contents, expected-value, and zero fallbacks do not satisfy this policy.",
      });
    }
  }

  const measurementMass = action.mass;
  if (measurementMass?.source !== "measurement" || !nonEmptyString(measurementMass.referenceId)) return;
  if (configuredReference(measurementMass.referenceId)) return;
  const producers = surface.actions.filter((candidate) => massOutputId(candidate) === measurementMass.referenceId);
  const structuralAlternative = findStructuralMassProducerAlternative(surface, producers);
  if (producers.length !== 1 && !structuralAlternative) {
    findings.push({
      rule: "bundled/mass-producer",
      owner: surface.owner,
      authority: surface.authority,
      action,
      detail: producers.length === 0
        ? `Mass consumer references "${measurementMass.referenceId}", but this authoring scope has no action-input mass producer.`
        : `Mass consumer references "${measurementMass.referenceId}", but this authoring scope has ${producers.length} mass producers.`,
      relatedActionIds: producers.map((producer) => producer.id),
    });
    return;
  }
  const orderingIssues = structuralAlternative
    ? [massProducerAlternativeOrderingIssue(surface, structuralAlternative, action)].filter((issue): issue is string => Boolean(issue))
    : producers
      .map((producer) => producerOrderingIssue(surface.process, producer.id, action.id))
      .filter((issue): issue is string => Boolean(issue));
  if (orderingIssues.length > 0) {
    findings.push({
      rule: "bundled/mass-producer",
      owner: surface.owner,
      authority: surface.authority,
      action,
      detail: orderingIssues.join(" "),
      relatedActionIds: producers.map((producer) => producer.id),
    });
  }
};

const validateMigrationEntries = (): BundledCatalogMigrationIssue[] => {
  const issues: BundledCatalogMigrationIssue[] = [];
  const seenKeys = new Set<string>();
  const seenIds = new Set<string>();
  for (const entry of bundledCatalogPolicyMigrationEntries) {
    const key = ownerKey(entry.authority, entry.owner, entry.sourceActionId, entry.rule);
    if (seenKeys.has(key)) {
      issues.push({ kind: "invalid-entry", entryId: entry.id, detail: "The migration list repeats the same exact policy key." });
    }
    seenKeys.add(key);
    if (seenIds.has(entry.id)) {
      issues.push({ kind: "invalid-entry", entryId: entry.id, detail: "The migration list repeats an entry id across distinct policy keys." });
    }
    seenIds.add(entry.id);
    if (entry.policySchemaVersion !== BUNDLED_CATALOG_POLICY_SCHEMA_VERSION) {
      issues.push({ kind: "invalid-entry", entryId: entry.id, detail: "The entry uses a different policy schema version." });
    }
    if (!transitionableRules.has(entry.rule) || !/^[a-f0-9]{64}$/.test(entry.semanticFingerprint)) {
      issues.push({ kind: "invalid-entry", entryId: entry.id, detail: "The entry has a non-transitionable rule or no full SHA-256 semantic fingerprint." });
    }
    if (!entry.id || !entry.removalCondition || !entry.f02Evidence || !entry.sourceEvidence) {
      issues.push({ kind: "invalid-entry", entryId: entry.id || "(missing-id)", detail: "The entry lacks required audit or removal evidence." });
    }
  }
  return issues;
};

const materializeFinding = async (
  pending: PendingFinding,
): Promise<Omit<BundledCatalogPolicyFinding, "transition" | "migrationEntryId">> => ({
  rule: pending.rule,
  owner: pending.owner,
  sourceActionId: pending.action.id,
  semanticFingerprint: await bundledCatalogPolicySha256(stableJson(policyProjection(pending))),
  detail: pending.detail,
  derivedClasses: pending.derivedClasses?.slice().sort(),
  relatedActionIds: pending.relatedActionIds?.slice().sort(),
});

/**
 * Evaluate only explicitly named bundled-catalog surfaces. This never reads public JSON or changes
 * the permissive generic validator; loader and diagnostic adapters decide which sources have this
 * authority.
 */
export const evaluateBundledCatalogPolicy = async (
  surfaces: readonly BundledCatalogSurface[],
  options: {
    migrationScope?: "selected-surfaces" | "complete-inventory";
    mode?: BundledCatalogPolicyMode;
  } = {},
): Promise<BundledCatalogPolicyResult> => {
  const mode = options.mode ?? BUNDLED_CATALOG_POLICY_FINAL_STRICT;
  const pending: PendingFinding[] = [];
  for (const surface of surfaces) {
    surface.actions.forEach((action) => pushActionFindings(surface, action, pending));
  }
  const migrationIssues = validateMigrationEntries();
  const materialized = await Promise.all(pending.map(materializeFinding));
  const relevantEntries = options.migrationScope === "complete-inventory"
    ? bundledCatalogPolicyMigrationEntries
    : bundledCatalogPolicyMigrationEntries.filter((entry) =>
        surfaces.some((surface) => entry.authority === surface.authority && sameOwner(entry.owner, surface.owner)),
      );
  const matchedEntryKeys = new Set<string>();
  const findings: BundledCatalogPolicyFinding[] = materialized.map((finding, index) => {
    const source = pending[index]!;
    const key = ownerKey(source.authority, finding.owner, finding.sourceActionId, finding.rule);
    const entries = relevantEntries.filter((entry) =>
      ownerKey(entry.authority, entry.owner, entry.sourceActionId, entry.rule) === key,
    );
    const matching = !source.neverTransition && entries.find((entry) => entry.semanticFingerprint === finding.semanticFingerprint);
    if (matching) {
      matchedEntryKeys.add(key);
      if (mode === BUNDLED_CATALOG_POLICY_DIAGNOSTIC) {
        return { ...finding, transition: "allowed-existing-debt", migrationEntryId: matching.id };
      }
      // A migration entry proves only that the diagnostic inventory recognized historical debt. It
      // cannot authorize a production bundle once final-strict is active.
      return { ...finding, transition: "blocking", migrationEntryId: matching.id };
    }
    return { ...finding, transition: "blocking" };
  });
  for (const entry of relevantEntries) {
    const key = ownerKey(entry.authority, entry.owner, entry.sourceActionId, entry.rule);
    if (!matchedEntryKeys.has(key)) {
      migrationIssues.push({
        kind: "stale-entry",
        entryId: entry.id,
        detail: "The exact finding is repaired, moved, or materially changed; remove this entry in the same reviewed repair.",
      });
    }
  }
  return {
    schemaVersion: BUNDLED_CATALOG_POLICY_SCHEMA_VERSION,
    evaluationMode: mode,
    findings: findings.sort((left, right) =>
      `${left.rule}:${left.owner.artifact}:${left.sourceActionId}`.localeCompare(
        `${right.rule}:${right.owner.artifact}:${right.sourceActionId}`,
      )),
    transitionFindings: findings.filter((finding) => finding.transition === "allowed-existing-debt"),
    blockingFindings: findings.filter((finding) => finding.transition === "blocking"),
    migrationIssues: migrationIssues.sort((left, right) => `${left.kind}:${left.entryId}`.localeCompare(`${right.kind}:${right.entryId}`)),
    accepted: findings.every((finding) => finding.transition !== "blocking") && migrationIssues.length === 0,
  };
};

export const bundledTechniqueSurface = (
  authority: BundledCatalogAuthority,
  artifact: string,
  technique: TechniqueDefinition,
  kind: "technique" | "lab-embedded-technique" | "fixture-technique" | "fixture-lab-embedded-technique" = "technique",
  ownerId = technique.id,
): BundledCatalogSurface => ({
  authority,
  owner: { kind, id: ownerId, version: technique.metadata.version, artifact },
  actions: technique.actions,
  process: technique.process,
  orderedProcedure: technique.composition?.orderedProcedure,
});

export const bundledLabSurfaces = (
  authority: BundledCatalogAuthority,
  artifact: string,
  lab: Pick<LabDefinition, "id" | "actions" | "techniques" | "process">,
  fixture = false,
): BundledCatalogSurface[] => [
  {
    authority,
    owner: { kind: fixture ? "fixture-lab" : "lab-local", id: lab.id, artifact },
    actions: lab.actions,
    process: lab.process,
  },
  ...lab.techniques.map((technique) => bundledTechniqueSurface(
    authority,
    artifact,
    technique,
    fixture ? "fixture-lab-embedded-technique" : "lab-embedded-technique",
    `${lab.id}/${technique.id}`,
  )),
];

export interface CompiledCatalogPolicyContext {
  labId: string;
  witnessId: string;
  compiledActionId: string;
  compiledNodeId?: string;
  originKind: "technique" | "lab-local";
  compiledInstanceId?: string;
  techniqueId?: string;
  techniqueVersion?: string;
  sourceActionId: string;
}

export interface CompiledCatalogPolicyFinding {
  rule: Extract<BundledCatalogPolicyRule, "bundled/mass-producer" | "bundled/mass-unit" | "bundled/mass-scope" | "bundled/mass-origin">;
  detail: string;
  semanticFingerprint: string;
  context: CompiledCatalogPolicyContext;
  relatedCompiledActionIds?: string[];
}

interface CompiledAttemptLike {
  status: string;
  effectiveWitnessId?: string;
  compiled?: LabDefinition;
  manifest?: CompositionManifest;
}

interface CompiledCollectionLike {
  sourceInstanceScopes: Array<{
    declaredInstanceId: string;
    compiledInstanceId: string;
    techniqueId: string;
    techniqueVersion: string;
  }>;
  attempts: readonly CompiledAttemptLike[];
}

const compiledContextFor = (
  source: LabCompositionSourceDefinition,
  action: ActionDefinition,
  manifest: CompositionManifest,
): { context?: CompiledCatalogPolicyContext; error?: string } => {
  const origins = manifest.origins.filter((origin) => origin.actionId === action.id);
  if (origins.length > 1) return { error: `Compiled action "${action.id}" has ${origins.length} manifest origins.` };
  if (origins.length === 1) {
    const origin = origins[0]!;
    return {
      context: {
        labId: source.id,
        witnessId: "",
        compiledActionId: action.id,
        compiledNodeId: origin.nodeId,
        originKind: "technique",
        compiledInstanceId: origin.instanceId,
        techniqueId: origin.techniqueId,
        techniqueVersion: origin.techniqueVersion,
        sourceActionId: origin.sourceActionId ?? action.id,
      },
    };
  }
  if (source.actions.some((candidate) => candidate.id === action.id)) {
    const node = source.process.nodes.find((candidate) => candidate.actionId === action.id);
    return {
      context: {
        labId: source.id,
        witnessId: "",
        compiledActionId: action.id,
        compiledNodeId: node?.id,
        originKind: "lab-local",
        sourceActionId: action.id,
      },
    };
  }
  return { error: `Compiled action "${action.id}" has no manifest origin or raw lab-local source action.` };
};

const rawActionForCompiledContext = (
  source: LabCompositionSourceDefinition,
  techniques: readonly TechniqueDefinition[],
  context: CompiledCatalogPolicyContext,
): ActionDefinition | undefined => {
  if (context.originKind === "lab-local") {
    return source.actions.find((action) => action.id === context.sourceActionId);
  }
  return techniques.find((technique) =>
    technique.id === context.techniqueId && technique.metadata.version === context.techniqueVersion,
  )?.actions.find((action) => action.id === context.sourceActionId);
};

const explicitlyAuthorizesCrossScopeReference = (
  source: LabCompositionSourceDefinition,
  collection: CompiledCollectionLike,
  context: CompiledCatalogPolicyContext,
  rawAction: ActionDefinition | undefined,
  compiledReferenceId: string,
): boolean => {
  const rawReferenceId = rawAction?.mass?.source === "measurement" ? rawAction.mass.referenceId : undefined;
  if (!rawReferenceId) return false;
  if (configuredReference(rawReferenceId)) return true;
  if (context.originKind !== "technique" || !context.compiledInstanceId) return false;
  const scope = collection.sourceInstanceScopes.find((candidate) =>
    candidate.compiledInstanceId === context.compiledInstanceId,
  );
  const instance = scope
    ? source.techniqueInstances.find((candidate) => candidate.instanceId === scope.declaredInstanceId)
    : undefined;
  return instance?.preserveIds?.references?.[rawReferenceId] === compiledReferenceId;
};

/**
 * F02 supplies the source-instance scope table and compiler manifest; this verifier consumes those
 * declarations directly and never guesses origin or scope from a generated identifier prefix.
 */
export const evaluateCompiledBundledCatalogPolicy = async (input: {
  source: LabCompositionSourceDefinition;
  collection: CompiledCollectionLike;
  techniques: readonly TechniqueDefinition[];
}): Promise<CompiledCatalogPolicyFinding[]> => {
  const pending: Array<{
    rule: CompiledCatalogPolicyFinding["rule"];
    detail: string;
    action: ActionDefinition;
    context: CompiledCatalogPolicyContext;
    relatedCompiledActionIds?: string[];
    fingerprintContext?: Record<string, unknown>;
  }> = [];
  for (const attempt of input.collection.attempts) {
    if (attempt.status !== "compiled" || !attempt.compiled || !attempt.manifest || !attempt.effectiveWitnessId) continue;
    const contexts = new Map<string, CompiledCatalogPolicyContext>();
    for (const action of attempt.compiled.actions) {
      const resolved = compiledContextFor(input.source, action, attempt.manifest);
      if (resolved.context) contexts.set(action.id, { ...resolved.context, witnessId: attempt.effectiveWitnessId });
      if (resolved.error && action.mass) {
        pending.push({
          rule: "bundled/mass-origin",
          detail: resolved.error,
          action,
          context: {
            labId: input.source.id,
            witnessId: attempt.effectiveWitnessId,
            compiledActionId: action.id,
            originKind: "lab-local",
            sourceActionId: action.id,
          },
        });
      }
    }
    attempt.compiled.actions.forEach((action) => {
      const measurementMass = action.mass;
      if (measurementMass?.source !== "measurement" || !nonEmptyString(measurementMass.referenceId)) return;
      const context = contexts.get(action.id);
      if (!context) return;
      const producers = attempt.compiled!.actions.filter(
        (candidate) => massOutputId(candidate) === measurementMass.referenceId,
      );
      if (producers.length !== 1) {
        pending.push({
          rule: "bundled/mass-producer",
          detail: producers.length === 0
            ? `Compiled mass consumer references "${measurementMass.referenceId}", but this witness has no action-input mass producer.`
            : `Compiled mass consumer references "${measurementMass.referenceId}", but this witness has ${producers.length} mass producers.`,
          action,
          context,
          relatedCompiledActionIds: producers.map((producer) => producer.id),
        });
        return;
      }
      const producer = producers[0]!;
      const orderingIssue = producerOrderingIssue(attempt.compiled!.process, producer.id, action.id);
      if (orderingIssue) {
        pending.push({
          rule: "bundled/mass-producer",
          detail: orderingIssue,
          action,
          context,
          relatedCompiledActionIds: [producer.id],
        });
        return;
      }
      const producerContext = contexts.get(producer.id);
      if (!producerContext) {
        pending.push({
          rule: "bundled/mass-origin",
          detail: `Compiled mass producer "${producer.id}" has no trustworthy F02 manifest origin.`,
          action,
          context,
          relatedCompiledActionIds: [producer.id],
        });
        return;
      }
      if (producer.parameters.unit !== undefined && producer.parameters.unit !== "g") {
        pending.push({
          rule: "bundled/mass-unit",
          detail: `Compiled mass producer "${producer.id}" declares unit "${String(producer.parameters.unit)}" although action-input mass records are grams.`,
          action,
          context,
          relatedCompiledActionIds: [producer.id],
        });
      }
      const sameScope = context.originKind === producerContext.originKind &&
        context.compiledInstanceId === producerContext.compiledInstanceId;
      if (!sameScope) {
        const rawAction = rawActionForCompiledContext(input.source, input.techniques, context);
        if (!explicitlyAuthorizesCrossScopeReference(input.source, input.collection, context, rawAction, measurementMass.referenceId)) {
          pending.push({
            rule: "bundled/mass-scope",
            detail: `Compiled mass consumer "${action.id}" crosses from ${context.compiledInstanceId ?? "lab-local"} to ${producerContext.compiledInstanceId ?? "lab-local"} without an explicit compiler binding.`,
            action,
            context,
            relatedCompiledActionIds: [producer.id],
            fingerprintContext: { producerContext },
          });
        }
      }
    });
  }
  return Promise.all(pending.map(async (finding) => ({
    rule: finding.rule,
    detail: finding.detail,
    semanticFingerprint: await bundledCatalogPolicySha256(stableJson({
      policySchemaVersion: BUNDLED_CATALOG_POLICY_SCHEMA_VERSION,
      rule: finding.rule,
      context: finding.context,
      action: policyProjection({
        rule: finding.rule,
        owner: {
          kind: finding.context.originKind === "technique" ? "technique" : "lab-local",
          id: finding.context.techniqueId ?? finding.context.labId,
          version: finding.context.techniqueVersion,
          artifact: "compiled-manifest",
        },
        authority: "public-bundle",
        action: finding.action,
        detail: finding.detail,
        relatedActionIds: finding.relatedCompiledActionIds,
        fingerprintContext: finding.fingerprintContext,
      }),
      relatedCompiledActionIds: finding.relatedCompiledActionIds?.slice().sort(),
    })),
    context: finding.context,
    relatedCompiledActionIds: finding.relatedCompiledActionIds?.slice().sort(),
  }))).then((findings) => findings.sort((left, right) =>
    `${left.rule}:${left.context.labId}:${left.context.witnessId}:${left.context.compiledActionId}`.localeCompare(
      `${right.rule}:${right.context.labId}:${right.context.witnessId}:${right.context.compiledActionId}`,
    ),
  ));
};
