/**
 * Pure renderer for docs/atomic-steps.md.
 *
 * The caller supplies the two machine-readable registries. This module does not read the
 * repository, inspect authored catalog content, or import application/runtime code.
 */

export const renderDocs = (registries) => {
  const { atoms, roles } = registries;
  const lines = [];
  lines.push("# Atomic Steps");
  lines.push("");
  lines.push(
    "<!-- Generated from src/domain/atomRegistry.json and src/domain/equipmentRoleRegistry.json.",
  );
  lines.push("     Do not edit by hand. Regenerate with:");
  lines.push("       node scripts/generateAtomicStepsDocs.mjs -->");
  lines.push("");
  lines.push(atoms.policy);
  lines.push("");
  lines.push(`Seed scope: ${atoms.seedScope}`);
  lines.push("");
  lines.push("## Basis legend");
  lines.push("");
  lines.push("| Label | Meaning |");
  lines.push("|---|---|");
  for (const [label, meaning] of Object.entries(atoms.basisLegend)) {
    lines.push(`| \`${label}\` | ${meaning} |`);
  }
  lines.push("");
  lines.push("A compound basis such as `M/F` or `R/C` is recorded verbatim and never simplified.");
  lines.push("");
  lines.push("## Source table kinds");
  lines.push("");
  lines.push("| Kind | Meaning |");
  lines.push("|---|---|");
  for (const [kind, meaning] of Object.entries(atoms.sourceTableLegend)) {
    lines.push(`| \`${kind}\` | ${meaning} |`);
  }
  lines.push("");

  const families = [...new Set(atoms.atoms.map((atom) => atom.family))].sort();
  lines.push("## Atoms");
  lines.push("");
  lines.push(`${atoms.atoms.length} atoms across ${families.length} families.`);
  lines.push("");
  lines.push("| Atom | Family | Verb | Interactions | Required roles |");
  lines.push("|---|---|---|---|---|");
  for (const atom of atoms.atoms) {
    lines.push(
      `| \`${atom.id}\` | ${atom.family} | \`${atom.verb}\` | ${atom.allowedInteractionTypes
        .map((type) => `\`${type}\``)
        .join(", ")} | ${atom.requiredRoles.map((role) => `\`${role}\``).join(", ") || "—"} |`,
    );
  }
  lines.push("");

  for (const family of families) {
    lines.push(`### Family: ${family}`);
    lines.push("");
    for (const atom of atoms.atoms.filter((candidate) => candidate.family === family)) {
      lines.push(`#### \`${atom.id}\``);
      lines.push("");
      lines.push(`**${atom.documentationLabel}**`);
      lines.push("");
      lines.push(`- Verb: \`${atom.verb}\``);
      lines.push(
        `- Allowed interaction types: ${atom.allowedInteractionTypes.map((type) => `\`${type}\``).join(", ")}`,
      );
      lines.push(
        `- Required roles: ${atom.requiredRoles.map((role) => `\`${role}\``).join(", ") || "none"}`,
      );
      lines.push(
        `- Optional roles: ${atom.optionalRoles.map((role) => `\`${role}\``).join(", ") || "none"}`,
      );
      lines.push(`- Evidence: ${atom.evidence}`);
      if (atom.proceduralConstraints.length) {
        lines.push("- Procedural constraints:");
        for (const constraint of atom.proceduralConstraints) lines.push(`  - ${constraint}`);
      }
      if (atom.sourceExamples.length) {
        lines.push("- Source examples:");
        for (const example of atom.sourceExamples) {
          lines.push(
            `  - \`${example.sourceFile}\` ${example.sourceTable} step \`${example.step}\` (${example.basis})`,
          );
        }
      }
      if (atom.contentExamples.length) {
        lines.push("- Content examples:");
        for (const example of atom.contentExamples) {
          lines.push(`  - \`${example.owner}\` action \`${example.actionId}\``);
        }
      }
      lines.push("");
    }
  }

  lines.push("## Equipment roles");
  lines.push("");
  lines.push(roles.policy);
  lines.push("");
  lines.push("| Role | Kind | Allowed equipment | Prohibited | Rationale |");
  lines.push("|---|---|---|---|---|");
  for (const role of roles.roles) {
    lines.push(
      `| \`${role.id}\` | ${role.kind} | ${role.allowedEquipmentIds
        .map((id) => `\`${id}\``)
        .join(", ")} | ${
        (role.prohibitedEquipmentIds ?? []).map((id) => `\`${id}\``).join(", ") || "—"
      } | ${role.rationale} |`,
    );
  }
  lines.push("");
  lines.push("### Deliberate distinctions");
  lines.push("");
  for (const role of roles.roles.filter((candidate) => candidate.distinguishedFrom?.length)) {
    lines.push(
      `- \`${role.id}\` must not be confused with ${role.distinguishedFrom
        .map((other) => `\`${other}\``)
        .join(", ")}.`,
    );
  }
  lines.push("");
  return `${lines.join("\n")}`;
};
