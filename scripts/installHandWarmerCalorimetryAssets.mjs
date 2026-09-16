import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const docsDir = join(
  repositoryRoot,
  "experiments",
  "lab-studio",
  "docs",
  "hand-warmer-calorimetry",
);
const manifestPath = join(docsDir, "asset-manifest.json");
const scenePath = join(docsDir, "calorimeter-scene.v1.json");
const outputDir = join(repositoryRoot, "public", "assets", "equipment-realistic", "v1");

const auditedAssetNames = [
  "ring-stand",
  "hot-plate-stirrer",
  "graduated-cylinder-100ml",
  "analytical-balance",
  "weigh-boat",
  "spatula",
  "stirring-rod",
  "wash-bottle",
  "reagent-bottle",
  "beaker-250ml",
];

const productionAssetDefinitions = [
  {
    basename: "wooden-calorimeter-cover",
    label: "wooden calorimeter cover with centered probe hole",
  },
  { basename: "probe-thermometer", label: "digital probe thermometer" },
  { basename: "magnetic-stir-bar", label: "magnetic stir bar" },
  { basename: "beaker-150ml", label: "150 milliliter borosilicate beaker" },
];

const compositeDefinitions = [
  ["CAL-00", "ring stand with empty support ring"],
  ["CAL-01", "ring stand and compact magnetic stirrer beneath the support ring"],
  ["CAL-02", "outer polystyrene cup supported upright in the ring"],
  ["CAL-03", "two nested polystyrene cups supported upright in the ring"],
  ["CAL-04", "nested cup calorimeter with fitted wooden cover"],
  ["CAL-05", "assembled calorimeter with probe thermometer through the cover"],
  ["CAL-06", "water-filled covered calorimeter with probe thermometer"],
  ["CAL-07", "water-filled calorimeter with magnetic stir bar"],
  ["CAL-08", "covered calorimeter stirring without splashing"],
  ["CAL-09", "open calorimeter with retained cover and probe beside weighed solid"],
  ["CAL-10", "solid transferred into the open calorimeter"],
  ["CAL-11", "covered calorimeter with reacting solution"],
  ["CAL-12", "covered calorimeter with dissolved solution"],
].map(([stateId, label]) => ({
  stateId,
  basename: `hand-warmer-calorimeter-${stateId.toLowerCase()}`,
  label,
}));

const escapeXml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const readPngDimensions = (bytes) => {
  if (bytes.length < 24 || bytes.subarray(1, 4).toString("ascii") !== "PNG") {
    throw new Error("Expected a PNG file.");
  }
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
};

const writeFileWithWindowsRetry = async (path, contents) => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await writeFile(path, contents, "utf8");
      return;
    } catch (error) {
      if (process.platform !== "win32" || error?.code !== "UNKNOWN" || attempt === 7) throw error;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 100 * (attempt + 1)));
    }
  }
};

const writePngWrapper = async (pngPath, svgPath, label) => {
  const png = await readFile(pngPath);
  const { width, height } = readPngDimensions(png);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(label)}">\n  <image width="${width}" height="${height}" href="data:image/png;base64,${png.toString("base64")}" preserveAspectRatio="xMidYMid meet"/>\n</svg>\n`;
  await writeFileWithWindowsRetry(svgPath, svg);
};

const assertPngWrapper = async (pngPath, svgPath, expectedSize) => {
  const png = await readFile(pngPath);
  const { width, height } = readPngDimensions(png);
  if (expectedSize && (width !== expectedSize || height !== expectedSize)) {
    throw new Error(`Unexpected PNG dimensions for ${pngPath}: ${width} x ${height}.`);
  }
  const svg = await readFile(svgPath, "utf8");
  const svgDimensions = svg.match(
    /<svg[^>]*\bwidth="(\d+)"[^>]*\bheight="(\d+)"[^>]*\bviewBox="0 0 (\d+) (\d+)"/,
  );
  const imageDimensions = svg.match(/<image[^>]*\bwidth="(\d+)"[^>]*\bheight="(\d+)"/);
  const embeddedPng = svg.match(/\bhref="data:image\/png;base64,([^"]+)"/);
  const imageCount = svg.match(/<image\b/g)?.length ?? 0;
  if (!svgDimensions || !imageDimensions || !embeddedPng) {
    throw new Error(`Invalid PNG-backed SVG wrapper: ${svgPath}`);
  }
  if (
    imageCount !== 1 ||
    !svg.includes('preserveAspectRatio="xMidYMid meet"') ||
    !svg.includes('aria-label="')
  ) {
    throw new Error(`Incomplete PNG-backed SVG wrapper contract: ${svgPath}`);
  }
  const dimensions = [
    ...svgDimensions.slice(1).map(Number),
    ...imageDimensions.slice(1).map(Number),
  ];
  if (dimensions.some((value, index) => value !== (index % 2 === 0 ? width : height))) {
    throw new Error(`PNG/SVG dimensions diverge: ${svgPath}`);
  }
  if (!Buffer.from(embeddedPng[1], "base64").equals(png)) {
    throw new Error(`Embedded PNG bytes diverge from source PNG: ${svgPath}`);
  }
};

const runCanonicalCompositor = () => {
  const result = spawnSync("python", [join("scripts", "scaleHandWarmerCompositeHeater.py")], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Hand-warmer compositor failed (${result.status}): ${result.stderr.trim()}`);
  }
  if (result.stdout.trim()) console.log(result.stdout.trim());
};

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const scene = JSON.parse(await readFile(scenePath, "utf8"));
const availableStateIds = new Set(scene.states.map(({ id }) => id));
for (const { stateId } of compositeDefinitions) {
  if (!availableStateIds.has(stateId)) throw new Error(`Scene definition is missing ${stateId}.`);
}

const configuredSourceDir = manifest.stagedExistingAssetRoot;
let sourceDir = configuredSourceDir
  ? isAbsolute(configuredSourceDir)
    ? configuredSourceDir
    : join(repositoryRoot, configuredSourceDir)
  : outputDir;
try {
  await access(sourceDir);
} catch {
  sourceDir = outputDir;
  console.warn("Configured staged asset root is unavailable; reusing the integrated public assets.");
}

await mkdir(outputDir, { recursive: true });
for (const assetName of auditedAssetNames) {
  for (const extension of ["png", "svg"]) {
    const sourcePath = join(sourceDir, `${assetName}.${extension}`);
    const targetPath = join(outputDir, `${assetName}.${extension}`);
    if (resolve(sourcePath) !== resolve(targetPath)) await copyFile(sourcePath, targetPath);
  }
  await assertPngWrapper(
    join(outputDir, `${assetName}.png`),
    join(outputDir, `${assetName}.svg`),
  );
}
await assertPngWrapper(
  join(outputDir, "polystyrene-cup-8oz.png"),
  join(outputDir, "polystyrene-cup-8oz.svg"),
);

for (const definition of productionAssetDefinitions) {
  const pngPath = join(outputDir, `${definition.basename}.png`);
  const svgPath = join(outputDir, `${definition.basename}.svg`);
  await writePngWrapper(pngPath, svgPath, definition.label);
  await assertPngWrapper(pngPath, svgPath, 1254);
}

runCanonicalCompositor();
for (const definition of compositeDefinitions) {
  const pngPath = join(outputDir, `${definition.basename}.png`);
  const svgPath = join(outputDir, `${definition.basename}.svg`);
  await writePngWrapper(pngPath, svgPath, definition.label);
  await assertPngWrapper(pngPath, svgPath, 1600);
}

console.log(`Installed ${auditedAssetNames.length} audited PNG/SVG pairs.`);
console.log(`Verified ${productionAssetDefinitions.length} production apparatus PNG/SVG pairs.`);
console.log(`Rendered ${compositeDefinitions.length} scene-driven composite PNG/SVG pairs.`);
