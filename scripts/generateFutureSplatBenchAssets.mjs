import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const outputDir = join(process.cwd(), "public", "assets", "equipment-splats", "v0");
const pngFallbacks = [
  "/assets/equipment-realistic/v1/bunsen-burner.png",
  "/assets/equipment-realistic/v1/wire-gauze.png",
  "/assets/equipment-realistic/v1/beaker-250ml.png",
  "/assets/equipment-realistic/v1/thermometer.png",
];

const SH_C0 = 0.28209479177387814;

const random = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const logit = (value) => Math.log(value / (1 - value));
const dc = (channel) => (channel - 0.5) / SH_C0;
const scale = (value) => Math.log(value);

const splat = (x, y, z, radius, color, opacity = 0.88) => [
  x,
  y,
  z,
  scale(radius * 2.8),
  scale(radius * 2.8),
  scale(radius * 2.8),
  1,
  0,
  0,
  0,
  logit(opacity),
  dc(color[0]),
  dc(color[1]),
  dc(color[2]),
];

const addEllipsoid = (points, rng, center, radii, count, color, opacity, radius = 0.035) => {
  for (let index = 0; index < count; index += 1) {
    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(2 * rng() - 1);
    const shell = 0.68 + rng() * 0.32;
    points.push(
      splat(
        center[0] + Math.sin(phi) * Math.cos(theta) * radii[0] * shell,
        center[1] + Math.cos(phi) * radii[1] * shell,
        center[2] + Math.sin(phi) * Math.sin(theta) * radii[2] * shell,
        radius * (0.72 + rng() * 0.56),
        color,
        opacity,
      ),
    );
  }
};

const addLine = (points, start, end, count, color, opacity, radius = 0.026) => {
  for (let index = 0; index < count; index += 1) {
    const t = count === 1 ? 0 : index / (count - 1);
    points.push(
      splat(
        start[0] + (end[0] - start[0]) * t,
        start[1] + (end[1] - start[1]) * t,
        start[2] + (end[2] - start[2]) * t,
        radius,
        color,
        opacity,
      ),
    );
  }
};

const addGauze = (points) => {
  const color = [0.68, 0.7, 0.67];
  for (let lane = -2; lane <= 2; lane += 1) {
    addLine(points, [-0.62, 0.78, lane * 0.11], [0.62, 0.78, lane * 0.11], 18, color, 0.78, 0.018);
    addLine(points, [lane * 0.16, 0.782, -0.36], [lane * 0.16, 0.782, 0.36], 16, color, 0.78, 0.018);
  }
  addEllipsoid(points, random(904), [0, 0.775, 0], [0.28, 0.018, 0.2], 34, [0.85, 0.82, 0.7], 0.78, 0.026);
};

const addBunsen = (points, rng, frame) => {
  addEllipsoid(points, rng, [-1.15, 0.08, 0.04], [0.42, 0.08, 0.28], 84, [0.28, 0.31, 0.32], 0.94, 0.04);
  addLine(points, [-1.15, 0.14, 0.04], [-1.15, 0.72, 0.04], 36, [0.48, 0.51, 0.5], 0.94, 0.04);
  addLine(points, [-1.43, 0.2, 0.04], [-1.86, 0.22, 0.04], 18, [0.18, 0.18, 0.18], 0.9, 0.026);

  const flameHeight = frame === "heat" ? 0.54 : frame === "setup" ? 0.2 : 0.08;
  const flameOpacity = frame === "cool" ? 0.34 : 0.7;
  addEllipsoid(points, rng, [-1.15, 0.82 + flameHeight * 0.25, 0.04], [0.16, flameHeight, 0.12], 46, [1, 0.52, 0.1], flameOpacity, 0.035);
  addEllipsoid(points, rng, [-1.15, 0.8 + flameHeight * 0.2, 0.04], [0.08, flameHeight * 0.62, 0.06], 28, [0.28, 0.65, 1], flameOpacity * 0.9, 0.026);
};

const addBeaker = (points, rng, frame) => {
  addEllipsoid(points, rng, [0, 1.04, 0.04], [0.42, 0.52, 0.32], 140, [0.82, 0.93, 0.96], 0.42, 0.032);
  addLine(points, [-0.42, 0.55, 0.04], [-0.42, 1.56, 0.04], 28, [0.72, 0.84, 0.88], 0.58, 0.022);
  addLine(points, [0.42, 0.55, 0.04], [0.42, 1.56, 0.04], 28, [0.72, 0.84, 0.88], 0.58, 0.022);
  addEllipsoid(points, rng, [0, 0.86, 0.04], [0.34, 0.04, 0.24], 36, frame === "heat" ? [0.55, 0.7, 0.9] : [0.5, 0.75, 0.92], 0.56, 0.03);

  const steamCount = frame === "heat" ? 52 : frame === "cool" ? 24 : 6;
  const steamOpacity = frame === "heat" ? 0.34 : 0.2;
  for (let index = 0; index < steamCount; index += 1) {
    const drift = index / Math.max(1, steamCount - 1);
    points.push(
      splat(
        -0.18 + rng() * 0.52,
        1.64 + drift * 0.56,
        -0.08 + rng() * 0.28,
        0.038 + rng() * 0.04,
        [0.84, 0.86, 0.84],
        steamOpacity,
      ),
    );
  }
};

const addThermometer = (points, frame) => {
  addLine(points, [0.58, 0.65, -0.18], [1.08, 1.62, -0.18], 42, [0.86, 0.91, 0.92], 0.72, 0.025);
  const redTop = frame === "heat" ? 0.78 : frame === "cool" ? 0.48 : 0.34;
  addLine(points, [0.61, 0.7, -0.17], [0.61 + redTop * 0.48, 0.7 + redTop * 0.92, -0.17], 26, [0.86, 0.08, 0.05], 0.82, 0.018);
  addEllipsoid(points, random(119), [0.58, 0.64, -0.17], [0.08, 0.08, 0.06], 22, [0.84, 0.05, 0.04], 0.86, 0.024);
};

const createFrame = (frame, seed) => {
  const rng = random(seed);
  const points = [];
  addBunsen(points, rng, frame);
  addGauze(points);
  addBeaker(points, rng, frame);
  addThermometer(points, frame);

  addLine(points, [-2.15, -0.02, -0.82], [1.92, -0.02, -0.82], 36, [0.54, 0.49, 0.39], 0.75, 0.04);
  addLine(points, [-2.15, -0.02, 0.82], [1.92, -0.02, 0.82], 36, [0.54, 0.49, 0.39], 0.75, 0.04);
  return points;
};

const writePly = async (filename, points) => {
  const header = [
    "ply",
    "format binary_little_endian 1.0",
    "comment Lab Studio v0 future-splat-bench impostor frame",
    `element vertex ${points.length}`,
    "property float x",
    "property float y",
    "property float z",
    "property float scale_0",
    "property float scale_1",
    "property float scale_2",
    "property float rot_0",
    "property float rot_1",
    "property float rot_2",
    "property float rot_3",
    "property float opacity",
    "property float f_dc_0",
    "property float f_dc_1",
    "property float f_dc_2",
    "end_header",
    "",
  ].join("\n");
  const data = Buffer.alloc(points.length * 14 * 4);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 0;
  for (const point of points) {
    for (const value of point) {
      view.setFloat32(offset, value, true);
      offset += 4;
    }
  }
  await writeFile(join(outputDir, filename), Buffer.concat([Buffer.from(header, "ascii"), data]));
};

await mkdir(outputDir, { recursive: true });

const frames = [
  { id: "setup", time: 0, ply: "future-splat-bench-setup.ply", sog: "future-splat-bench-setup.sog", seed: 101 },
  { id: "heat", time: 0.5, ply: "future-splat-bench-heat.ply", sog: "future-splat-bench-heat.sog", seed: 202 },
  { id: "cool", time: 1, ply: "future-splat-bench-cool.ply", sog: "future-splat-bench-cool.sog", seed: 303 },
];

for (const frame of frames) {
  await writePly(frame.ply, createFrame(frame.id, frame.seed));
  const conversion = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    [
      "--yes",
      "@playcanvas/splat-transform",
      "-w",
      join(outputDir, frame.ply),
      join(outputDir, frame.sog),
    ],
    { shell: true, stdio: "inherit" },
  );
  if (conversion.status !== 0) {
    throw new Error(`Unable to convert ${frame.ply} to ${frame.sog}.`);
  }
}

await writeFile(
  join(outputDir, "manifest.json"),
  `${JSON.stringify(
    {
      id: "future-splat-bench",
      title: "Future Splat Bench",
      renderer: "playcanvas",
      frames: frames.map((frame) => ({
        id: frame.id,
        time: frame.time,
        splatUrl: `/assets/equipment-splats/v0/${frame.sog}`,
        format: "sog",
        pngFallbacks,
      })),
    },
    null,
    2,
  )}\n`,
);
