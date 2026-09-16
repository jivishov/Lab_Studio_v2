import type {
  CompositionManifest,
  LabCompositionSourceDefinition,
  LabDefinition,
  TechniqueDefinition,
} from "../domain/types";
import type { TechniqueResolver } from "./hydrateBundledLab";
import { compileLabComposition } from "./compileLabComposition";

/**
 * An explicit relationship between a raw instance declaration and the compiler scope it emits.
 * Consumers must join through this table rather than infer an origin from a scoped identifier.
 */
export interface SourceInstanceScope {
  declaredInstanceId: string;
  compiledInstanceId: string;
  repeatIndex: number;
  techniqueId: string;
  techniqueVersion: string;
}

export interface PreparedCompiledWitnessSource {
  status: "prepared";
  /** A prepared clone. It may contain named, caller-owned setup fixture values. */
  source: LabCompositionSourceDefinition;
  setupFixtureId?: string;
  setupDescription?: string;
}

export interface UnsupportedCompiledWitnessSetup {
  status: "unsupported-setup";
  setupFixtureId?: string;
  detail: string;
}

export type PreparedCompiledWitnessResult =
  | PreparedCompiledWitnessSource
  | UnsupportedCompiledWitnessSetup;

export type PrepareCompiledWitnessSource = (
  source: LabCompositionSourceDefinition,
) => Promise<PreparedCompiledWitnessResult> | PreparedCompiledWitnessResult;

interface CompiledWitnessAttemptBase {
  labId: string;
  witnessId: string | null;
  setupFixtureId?: string;
  setupDescription?: string;
}

export interface SuccessfulCompiledWitnessAttempt extends CompiledWitnessAttemptBase {
  status: "compiled";
  /** Complete in-memory output for downstream static diagnostics; this helper never serializes it. */
  compiled: LabDefinition;
  manifest: CompositionManifest;
  effectiveWitnessId: string;
}

export interface FailedCompiledWitnessAttempt extends CompiledWitnessAttemptBase {
  status: "compile-failed" | "unresolved-template" | "unsupported-setup";
  error: string;
}

export type CompiledWitnessAttempt =
  | SuccessfulCompiledWitnessAttempt
  | FailedCompiledWitnessAttempt;

export interface CollectCompiledWitnessesOptions {
  source: LabCompositionSourceDefinition;
  /** Resolver is injected so collection has no filesystem, cache, or bundle-loader dependency. */
  resolveTechnique: TechniqueResolver;
  /**
   * Applies a named setup fixture to a clone. Returning `unsupported-setup` records every selected
   * witness as unrepresented rather than inventing an approval or numeric value.
   */
  prepareSource?: PrepareCompiledWitnessSource;
  /** Defaults to every witness declared by the prepared source, in declaration order. */
  witnessIds?: readonly string[];
}

export interface CompiledWitnessCollection {
  /** Prepared in-memory source actually supplied to the compiler; never serialized by this API. */
  effectiveSource: LabCompositionSourceDefinition;
  sourceInstanceScopes: SourceInstanceScope[];
  declaredWitnessIds: string[];
  selectedWitnessIds: string[];
  attempts: CompiledWitnessAttempt[];
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Reproduce the compiler's forward scope rule without trying to decode a generated identifier.
 * A malformed repeat is left as one provisional scope; the production compiler remains the
 * authority that reports the malformed source during an attempted compilation.
 */
export const sourceInstanceScopesFor = (
  source: LabCompositionSourceDefinition,
): SourceInstanceScope[] => source.techniqueInstances.flatMap((instance) => {
  const repeat = Number.isInteger(instance.repeat) && (instance.repeat ?? 1) > 0
    ? instance.repeat ?? 1
    : 1;
  return Array.from({ length: repeat }, (_, repeatIndex) => ({
    declaredInstanceId: instance.instanceId,
    compiledInstanceId: repeat === 1
      ? instance.instanceId
      : `${instance.instanceId}--${repeatIndex + 1}`,
    repeatIndex,
    techniqueId: instance.techniqueId,
    techniqueVersion: instance.version,
  }));
});

const defaultPreparation: PrepareCompiledWitnessSource = (source) => ({
  status: "prepared",
  source,
  setupFixtureId: "none",
  setupDescription: "No setup fixture was required by the collector.",
});

/**
 * Compile selected declared witnesses without reading or writing anything outside the supplied
 * inputs. Compilation failures are returned as coverage data so callers can retain a complete
 * attempted-context ledger instead of stopping at the first bad witness.
 */
export const collectCompiledWitnesses = async (
  options: CollectCompiledWitnessesOptions,
): Promise<CompiledWitnessCollection> => {
  const prepareSource = options.prepareSource ?? defaultPreparation;
  const originalSource = structuredClone(options.source);
  let preparation: PreparedCompiledWitnessResult;
  try {
    preparation = await prepareSource(structuredClone(originalSource));
  } catch (error) {
    preparation = {
      status: "unsupported-setup",
      detail: errorMessage(error),
    };
  }

  const preparedSource = preparation.status === "prepared"
    ? structuredClone(preparation.source)
    : originalSource;
  const declaredWitnessIds = (preparedSource.reachabilityWitnesses ?? []).map((witness) => witness.id);
  const selectedWitnessIds = [...(options.witnessIds ?? declaredWitnessIds)];
  const sourceInstanceScopes = sourceInstanceScopesFor(preparedSource);
  const attempts: CompiledWitnessAttempt[] = [];

  if (selectedWitnessIds.length === 0) {
    attempts.push({
      status: "unresolved-template",
      labId: preparedSource.id,
      witnessId: null,
      ...(preparation.setupFixtureId ? { setupFixtureId: preparation.setupFixtureId } : {}),
      ...(preparation.status === "prepared" && preparation.setupDescription
        ? { setupDescription: preparation.setupDescription }
        : {}),
      error: "The composition source declares no reachability witness to compile.",
    });
    return {
      effectiveSource: structuredClone(preparedSource),
      sourceInstanceScopes,
      declaredWitnessIds,
      selectedWitnessIds,
      attempts,
    };
  }

  if (preparation.status === "unsupported-setup") {
    for (const witnessId of selectedWitnessIds) {
      attempts.push({
        status: "unsupported-setup",
        labId: preparedSource.id,
        witnessId,
        ...(preparation.setupFixtureId ? { setupFixtureId: preparation.setupFixtureId } : {}),
        error: preparation.detail,
      });
    }
    return {
      effectiveSource: structuredClone(preparedSource),
      sourceInstanceScopes,
      declaredWitnessIds,
      selectedWitnessIds,
      attempts,
    };
  }

  for (const witnessId of selectedWitnessIds) {
    let resolverFailure: string | undefined;
    const resolveTechnique: TechniqueResolver = async (techniqueId: string): Promise<TechniqueDefinition> => {
      try {
        return await options.resolveTechnique(techniqueId);
      } catch (error) {
        resolverFailure = errorMessage(error);
        throw error;
      }
    };
    try {
      const compiled = await compileLabComposition(preparedSource, resolveTechnique, { witnessId });
      const manifest = compiled.compositionManifest;
      if (!manifest || manifest.status !== "compiled") {
        throw new Error(`Lab ${preparedSource.id} did not emit a compiled composition manifest under witness ${witnessId}.`);
      }
      attempts.push({
        status: "compiled",
        labId: preparedSource.id,
        witnessId,
        setupFixtureId: preparation.setupFixtureId,
        setupDescription: preparation.setupDescription,
        compiled,
        manifest,
        effectiveWitnessId: witnessId,
      });
    } catch (error) {
      attempts.push({
        status: resolverFailure ? "unresolved-template" : "compile-failed",
        labId: preparedSource.id,
        witnessId,
        setupFixtureId: preparation.setupFixtureId,
        setupDescription: preparation.setupDescription,
        error: resolverFailure ?? errorMessage(error),
      });
    }
  }

  return {
    effectiveSource: structuredClone(preparedSource),
    sourceInstanceScopes,
    declaredWitnessIds,
    selectedWitnessIds,
    attempts,
  };
};
