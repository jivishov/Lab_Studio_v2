import labIndex from "../../public/labs/index.json";

/**
 * Which indexed labs compose each indexed technique.
 *
 * A technique written against teacher configuration cannot resolve it alone: a lab supplies the
 * values while it compiles. Telling a teacher only that "a lab supplies this" is not a route, so the
 * standalone route names the labs that actually do — and for the few no lab composes, says so
 * plainly instead of sending them looking for one.
 *
 * Derived from `techniqueInstances` and `techniques` across `public/labs/*.json` rather than read
 * back at runtime: the route would otherwise fetch all 17 lab definitions to render one
 * sentence. `src/data/__tests__/techniqueHosts.test.ts` re-derives this table from the shipped
 * catalog and fails when the two disagree, so the copy cannot drift unnoticed.
 *
 * A technique absent from this table is composed by no indexed lab. That is not by itself a defect:
 * `tablet-separation` and `titration-curve-analysis` require no configuration and run standalone.
 */
export const HOST_LABS_BY_TECHNIQUE: Readonly<Record<string, readonly string[]>> = {
  "beverage-ph-volume-titration": ["beverage-acidity"],
  "blue1-class-calibration": ["blue1-spectroscopy"],
  "blue1-percent-transmittance": ["blue1-spectroscopy"],
  "blue1-standard-dilutions": ["blue1-spectroscopy"],
  "bonding-solids-tests": ["bonding-unknown-solids"],
  "brass-spectrophotometry": ["brass-colorimetry"],
  "crystal-violet-integrated-rate-law-comparison": ["crystal-violet-rate-law"],
  "crystal-violet-kinetics": ["crystal-violet-rate-law"],
  "crystal-violet-micromolar-dilution-series": ["crystal-violet-rate-law"],
  "crystal-violet-spectrophotometer-calibration": ["crystal-violet-rate-law"],
  "crystal-violet-waste-treatment": ["crystal-violet-rate-law"],
  drying: ["hard-water-demo"],
  "equilibrium-rainbow-inquiry": ["equilibrium-rainbow-display"],
  filtration: ["intro-filtration-demo", "hard-water-demo"],
  "gravimetric-vacuum-filtration": ["hard-water-analysis"],
  "hand-warmer-calorimetry": ["hand-warmer-calorimetry"],
  "hard-water-calculation": ["hard-water-demo"],
  "hard-water-practice-preparation": ["hard-water-analysis"],
  "hard-water-precipitation": ["intro-filtration-demo", "hard-water-demo"],
  "hard-water-two-sample-inquiry": ["hard-water-analysis"],
  "inquiry-plan-approval": ["hard-water-analysis"],
  "marble-gas-syringe-kinetics": ["marble-statue-kinetics"],
  "measuring-volume": ["intro-filtration-demo", "hard-water-demo"],
  "paper-chromatography": ["paper-chromatography"],
  "ph-volume-formal-titration-trial": ["acid-base-titration-curves"],
  "quick-ache-analysis-report": ["quick-ache-relief-separation"],
  "quick-ache-design-approval": ["quick-ache-relief-separation"],
  "quick-ache-extraction-recovery": ["quick-ache-relief-separation"],
  "quick-ache-property-evidence": ["quick-ache-relief-separation"],
  "redox-titration": ["hydrogen-peroxide-redox-titration"],
  "thermal-decomposition-mass-loss": ["green-chemistry-mixture-purification"],
  "titration-endpoint": ["acid-base-titration"],
  transfer: ["intro-filtration-demo", "hard-water-demo"],
  "two-stage-precipitate-drying": ["hard-water-analysis"],
};

const titleById = new Map(
  (labIndex as ReadonlyArray<{ id: string; title: string }>).map((entry) => [entry.id, entry.title]),
);

export interface TechniqueHostLab {
  id: string;
  title: string;
  /** The route that starts this lab, ready to use as an href. */
  href: string;
}

/** Labs that compose this technique, and therefore supply its configuration, in catalog order. */
export const hostLabsForTechnique = (techniqueId: string): TechniqueHostLab[] =>
  (HOST_LABS_BY_TECHNIQUE[techniqueId] ?? []).map((id) => ({
    id,
    title: titleById.get(id) ?? id,
    href: `#/play/${id}`,
  }));
