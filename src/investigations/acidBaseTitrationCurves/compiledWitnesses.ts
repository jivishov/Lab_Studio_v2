import { compileBundledLabCompositionWithPolicy } from "../../data/bundledCatalogPolicyBoundary";
import { loadBundledTechnique } from "../../data/loadBundledTechniques";
import { fetchPublicJson } from "../../data/publicBundle";
import { isCompositionSource } from "../../domain/compositionValidation";
import type { LabDefinition } from "../../domain/types";
import { validateBundledLabSource } from "../../domain/validation";
import { acidBaseRouteContextId, type AcidBaseRouteContext } from "./routeAdapter";

const LAB_ID = "acid-base-titration-curves";
const LAB_FILE = `${LAB_ID}.json`;

export type AcidBaseCompiledWitnesses = ReadonlyMap<AcidBaseRouteContext, LabDefinition>;

/**
 * Compile one root process per declared reachability witness.
 *
 * `loadBundledLab` selects the first declared witness, which would bind every configured
 * combination to the strong-acid context model. This route offers three teacher-configured
 * combinations, so each one has to execute the witness whose compiled configuration actually
 * carries its context and model. Nothing here mutates the public source or the technique: the
 * shared validator, resolver and compiler are used unchanged and only the witness is selected.
 */
export const loadAcidBaseCompiledWitnesses = async (): Promise<AcidBaseCompiledWitnesses> => {
  const raw = await fetchPublicJson<unknown>("labs", LAB_FILE);
  const validation = validateBundledLabSource(raw);
  if (!validation.ok || !validation.value) {
    throw new Error(validation.errors.join("\n"));
  }
  const source = validation.value;
  if (source.id !== LAB_ID) {
    throw new Error(`Public lab id "${source.id}" does not match "${LAB_ID}".`);
  }
  if (!isCompositionSource(source)) {
    throw new Error(`Lab "${LAB_ID}" is not a composition source; the compiled route cannot execute it.`);
  }
  const witnesses = source.reachabilityWitnesses ?? [];
  if (witnesses.length === 0) {
    throw new Error(`Lab "${LAB_ID}" declares no reachability witness to compile.`);
  }
  const compiled = new Map<AcidBaseRouteContext, LabDefinition>();
  for (const witness of witnesses) {
    const definition = await compileBundledLabCompositionWithPolicy({
      authority: "public-bundle",
      artifact: `public/labs/${LAB_FILE}`,
      catalogSource: source,
      resolveTechnique: loadBundledTechnique,
      witnessId: witness.id,
    });
    const context = acidBaseRouteContextId(definition);
    if (!context) {
      throw new Error(
        `Compiled witness "${witness.id}" does not declare a supported indicator-free formal context.`,
      );
    }
    if (compiled.has(context)) {
      throw new Error(`Two reachability witnesses compile to the same formal context "${context}".`);
    }
    compiled.set(context, definition);
  }
  return compiled;
};

let cache: Promise<AcidBaseCompiledWitnesses> | undefined;

export const acidBaseCompiledWitnesses = (): Promise<AcidBaseCompiledWitnesses> => {
  cache ??= loadAcidBaseCompiledWitnesses();
  void cache.catch(() => {
    cache = undefined;
  });
  return cache;
};
