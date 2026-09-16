import { createChemistryAssessmentFixture } from "../domain";
import type { QtiCompanionModel } from "./types";

export const createCycle16QtiFixture = (): {
  assessment: ReturnType<typeof createChemistryAssessmentFixture>;
  model: QtiCompanionModel;
} => {
  const assessment = createChemistryAssessmentFixture();
  return {
    assessment,
    model: {
      schema: "causalyst.qti-companion-model",
      schemaVersion: "1.0",
      profile: "qti22-companion",
      id: "cycle16.qti22.companion",
      title: "Causalyst evidence companion",
      instructions: "Complete the associated Causalyst simulation and answer these portable companion items. The simulation itself is not in this package.",
      sourceAssessmentRef: { id: assessment.id, version: assessment.metadata.version },
      associatedActivity: { label: "Launch the associated Causalyst activity from the LMS resource link." },
      items: [
        {
          id: "claim-boundary",
          type: "single-choice",
          title: "Claim boundary",
          prompt: "Which statement accurately describes the companion package?",
          required: true,
          staticAssetRefs: ["companion-marker"],
          choices: [
            { id: "companion-only", label: "It contains standard companion items and refers to the Causalyst activity." },
            { id: "embedded-runtime", label: "It embeds a portable Lab Studio simulation in every LMS." },
          ],
          correctChoiceId: "companion-only",
        },
        {
          id: "inspectable-evidence",
          type: "multiple-response",
          title: "Inspectable evidence",
          prompt: "Select the records that remain in the Causalyst submission and review workflow.",
          required: true,
          staticAssetRefs: [],
          choices: [
            { id: "semantic-trace", label: "Semantic run trace" },
            { id: "evidence-bundle", label: "Evidence bundle" },
            { id: "pointer-path", label: "Raw pointer trajectory" },
          ],
          correctChoiceIds: ["semantic-trace", "evidence-bundle"],
          minimumChoices: 2,
          maximumChoices: 2,
        },
        {
          id: "required-runs",
          type: "numeric-response",
          title: "Required runs",
          prompt: "How many runs does the pinned source assessment require?",
          required: true,
          staticAssetRefs: [],
          correctResponse: String(assessment.runPolicy.requiredRuns),
          tolerance: "0",
          unitLabel: "runs",
        },
        {
          id: "limitations",
          type: "extended-text",
          title: "Limitations",
          prompt: assessment.explanationPrompts[0].prompt,
          required: true,
          staticAssetRefs: [],
          expectedLines: 8,
          rubricReference: assessment.explanationPrompts[0].evidenceSelectorIds.join(", "),
        },
      ],
      assets: [{
        id: "companion-marker",
        fileName: "companion-marker.png",
        mediaType: "image/png",
        contentBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        alternativeText: "A neutral marker identifying this item as a companion prompt.",
      }],
      limitations: [
        "The package uses only the conservative QTI 2.2 standard-item subset.",
        "The executable simulation and rich Causalyst evidence remain outside QTI.",
        "No named LMS or independent validator result is available.",
      ],
    },
  };
};
