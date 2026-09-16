import { Buffer } from "node:buffer";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createCanvas, loadImage } from "canvas";

const outputDir = fileURLToPath(new URL("../public/assets/equipment-realistic/v1/", import.meta.url));
const outputSize = 1254;

const roundRect = (ctx, x, y, width, height, radius) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

const drawCenteredText = (ctx, lines, x, y, width, lineHeight, color) => {
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((line, index) => {
    ctx.fillText(line, x + width / 2, y + lineHeight * index);
  });
};

const writeWrapper = async (id, label, pngBuffer) => {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${outputSize}" height="${outputSize}" viewBox="0 0 ${outputSize} ${outputSize}" role="img" aria-label="${label}">
  <image width="${outputSize}" height="${outputSize}" href="data:image/png;base64,${pngBuffer.toString("base64")}" preserveAspectRatio="xMidYMid meet"/>
</svg>
`;
  await writeFile(`${outputDir}/${id}.svg`, svg);
};

const renderAsset = async ({ id, label, source, drawLabel }) => {
  const sourceImage = await loadImage(`${outputDir}/${source}.png`);
  const canvas = createCanvas(outputSize, outputSize);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, outputSize, outputSize);
  ctx.drawImage(sourceImage, 0, 0, outputSize, outputSize);
  drawLabel(ctx);
  const png = canvas.toBuffer("image/png");
  await writeFile(`${outputDir}/${id}.png`, png);
  await writeWrapper(id, label, png);
};

await renderAsset({
  id: "distilled-water-bottle",
  label: "distilled water bottle",
  source: "wash-bottle",
  drawLabel: (ctx) => {
    ctx.save();
    roundRect(ctx, 485, 666, 292, 210, 28);
    ctx.fillStyle = "rgba(242, 250, 255, 0.84)";
    ctx.fill();
    ctx.strokeStyle = "rgba(60, 132, 178, 0.38)";
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.font = "700 48px Arial";
    drawCenteredText(ctx, ["DISTILLED", "WATER"], 485, 735, 292, 58, "#1f5f83");
    ctx.font = "500 28px Arial";
    drawCenteredText(ctx, ["H2O"], 485, 844, 292, 36, "#4a90b7");
    ctx.restore();
  },
});

await renderAsset({
  id: "propanol-bottle",
  label: "2-propanol bottle",
  source: "reagent-bottle",
  drawLabel: (ctx) => {
    ctx.save();
    roundRect(ctx, 445, 560, 365, 300, 22);
    ctx.fillStyle = "rgba(255, 255, 246, 0.9)";
    ctx.fill();
    ctx.strokeStyle = "rgba(70, 57, 37, 0.34)";
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.font = "700 50px Arial";
    drawCenteredText(ctx, ["2-PROPANOL"], 445, 637, 365, 60, "#31302b");
    ctx.font = "500 31px Arial";
    drawCenteredText(ctx, ["C3H8O", "ORGANIC SOLVENT"], 445, 720, 365, 46, "#5e513f");
    ctx.translate(628, 813);
    ctx.rotate(Math.PI / 4);
    roundRect(ctx, -37, -37, 74, 74, 6);
    ctx.fillStyle = "#d9482f";
    ctx.fill();
    ctx.strokeStyle = "#fff7ed";
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.rotate(-Math.PI / 4);
    ctx.font = "700 41px Arial";
    ctx.fillStyle = "#fff7ed";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("!", 0, 4);
    ctx.restore();
  },
});
