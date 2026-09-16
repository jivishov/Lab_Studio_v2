import { Buffer } from "node:buffer";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const outputDir = fileURLToPath(new URL("../public/assets/equipment-realistic/v1/", import.meta.url));
const outputLongEdge = 1254;
const contentInset = 0.08;
const retryableWriteCodes = new Set(["EBUSY", "EACCES", "EPERM", "UNKNOWN"]);
const writeRetryDelaysMs = [100, 250, 500, 1000, 2000, 3000];

const assets = [
  {
    id: "chromatography-chamber",
    label: "chromatography chamber",
    width: 156,
    height: 188,
    scale: 8,
  },
  {
    id: "chromatography-paper",
    label: "chromatography paper",
    width: 76,
    height: 190,
    scale: 8,
  },
  {
    id: "capillary-spotter",
    label: "capillary spotter",
    width: 70,
    height: 180,
    scale: 6,
  },
  {
    id: "metric-ruler",
    label: "metric ruler",
    width: 178,
    height: 34,
    scale: 10,
  },
];

const escapeXml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const wait = (delayMs) => new Promise((resolve) => {
  setTimeout(resolve, delayMs);
});

const writeGeneratedFile = async (filePath, data, options) => {
  let attempt = 0;
  while (true) {
    try {
      await writeFile(filePath, data, options);
      return;
    } catch (error) {
      const code = error && typeof error === "object" ? error.code : undefined;
      if (!retryableWriteCodes.has(code) || attempt >= writeRetryDelaysMs.length) {
        throw error;
      }
      await wait(writeRetryDelaysMs[attempt]);
      attempt += 1;
    }
  }
};

const outputDimensionsFor = (asset) => {
  const aspect = asset.width / asset.height;
  if (aspect >= 1) {
    return {
      width: outputLongEdge,
      height: Math.round(outputLongEdge / aspect),
    };
  }
  return {
    width: Math.round(outputLongEdge * aspect),
    height: outputLongEdge,
  };
};

const renderPng = async (page, asset) =>
  page.evaluate(({ target, output, contentInset }) => {
    const canvas = document.createElement("canvas");
    canvas.width = output.width;
    canvas.height = output.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context unavailable.");
    const contentWidth = output.width * (1 - contentInset * 2);
    const contentHeight = output.height * (1 - contentInset * 2);
    const renderScale = Math.min(target.scale, contentWidth / target.width, contentHeight / target.height);
    ctx.translate(
      Math.round((output.width - target.width * renderScale) / 2),
      Math.round((output.height - target.height * renderScale) / 2),
    );
    ctx.scale(renderScale, renderScale);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const roundRect = (x, y, width, height, radius) => {
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

    const strokeLine = (points, style, width = 1, alpha = 1) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      points.forEach(([x, y], index) => {
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    };

    const fillNoise = (x, y, width, height, count, alpha, colors) => {
      ctx.save();
      for (let i = 0; i < count; i += 1) {
        const seed = Math.sin(i * 12.9898 + target.width * 78.233) * 43758.5453;
        const rx = seed - Math.floor(seed);
        const seed2 = Math.sin(i * 39.3468 + target.height * 11.135) * 24634.6345;
        const ry = seed2 - Math.floor(seed2);
        const seed3 = Math.sin(i * 4.123 + target.width * target.height) * 96321.187;
        const ri = Math.floor((seed3 - Math.floor(seed3)) * colors.length);
        ctx.globalAlpha = alpha * (0.45 + (rx % 0.55));
        ctx.fillStyle = colors[Math.max(0, Math.min(colors.length - 1, ri))];
        ctx.fillRect(x + rx * width, y + ry * height, 0.35, 0.35);
      }
      ctx.restore();
    };

    const drawChromatographyChamber = () => {
      const frontPath = () => {
        ctx.beginPath();
        ctx.moveTo(31, 39);
        ctx.lineTo(119, 39);
        ctx.quadraticCurveTo(126, 39, 127, 46);
        ctx.lineTo(127, 153);
        ctx.quadraticCurveTo(127, 161, 119, 163);
        ctx.lineTo(37, 163);
        ctx.quadraticCurveTo(29, 161, 29, 153);
        ctx.lineTo(29, 46);
        ctx.quadraticCurveTo(29, 40, 31, 39);
        ctx.closePath();
      };

      const sidePath = () => {
        ctx.beginPath();
        ctx.moveTo(119, 40);
        ctx.lineTo(137, 46);
        ctx.lineTo(137, 151);
        ctx.lineTo(127, 160);
        ctx.lineTo(127, 47);
        ctx.quadraticCurveTo(126, 41, 119, 40);
        ctx.closePath();
      };

      ctx.save();
      const shadow = ctx.createRadialGradient(78, 174, 7, 78, 174, 66);
      shadow.addColorStop(0, "rgba(18, 35, 40, 0.24)");
      shadow.addColorStop(0.64, "rgba(18, 35, 40, 0.1)");
      shadow.addColorStop(1, "rgba(18, 35, 40, 0)");
      ctx.fillStyle = shadow;
      ctx.beginPath();
      ctx.ellipse(79, 174.5, 61, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.shadowColor = "rgba(10, 32, 39, 0.16)";
      ctx.shadowBlur = 3.8;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 2.2;
      sidePath();
      const sideWall = ctx.createLinearGradient(120, 42, 139, 160);
      sideWall.addColorStop(0, "rgba(231, 252, 255, 0.24)");
      sideWall.addColorStop(0.38, "rgba(117, 170, 184, 0.16)");
      sideWall.addColorStop(0.72, "rgba(245, 255, 255, 0.15)");
      sideWall.addColorStop(1, "rgba(48, 102, 118, 0.26)");
      ctx.fillStyle = sideWall;
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.shadowColor = "rgba(10, 32, 39, 0.18)";
      ctx.shadowBlur = 3.4;
      ctx.shadowOffsetY = 1.6;
      frontPath();
      const wall = ctx.createLinearGradient(27, 38, 132, 163);
      wall.addColorStop(0, "rgba(251, 254, 255, 0.17)");
      wall.addColorStop(0.18, "rgba(224, 247, 253, 0.28)");
      wall.addColorStop(0.47, "rgba(255, 255, 255, 0.08)");
      wall.addColorStop(0.75, "rgba(151, 200, 212, 0.15)");
      wall.addColorStop(1, "rgba(237, 251, 254, 0.22)");
      ctx.fillStyle = wall;
      ctx.fill();
      ctx.restore();

      ctx.save();
      frontPath();
      ctx.clip();

      const backWall = ctx.createLinearGradient(39, 45, 116, 153);
      backWall.addColorStop(0, "rgba(255, 255, 255, 0.18)");
      backWall.addColorStop(0.45, "rgba(228, 249, 253, 0.08)");
      backWall.addColorStop(1, "rgba(108, 161, 177, 0.1)");
      ctx.fillStyle = backWall;
      ctx.fillRect(40, 46, 76, 102);

      const leftWall = ctx.createLinearGradient(28, 42, 44, 42);
      leftWall.addColorStop(0, "rgba(34, 86, 103, 0.32)");
      leftWall.addColorStop(0.25, "rgba(255, 255, 255, 0.62)");
      leftWall.addColorStop(0.7, "rgba(210, 242, 249, 0.12)");
      leftWall.addColorStop(1, "rgba(33, 77, 91, 0.13)");
      ctx.fillStyle = leftWall;
      ctx.fillRect(29, 43, 15, 113);

      const rightWall = ctx.createLinearGradient(111, 42, 128, 42);
      rightWall.addColorStop(0, "rgba(255, 255, 255, 0.14)");
      rightWall.addColorStop(0.56, "rgba(76, 131, 148, 0.3)");
      rightWall.addColorStop(1, "rgba(20, 65, 82, 0.38)");
      ctx.fillStyle = rightWall;
      ctx.fillRect(112, 43, 15, 113);

      const centerBloom = ctx.createLinearGradient(44, 45, 111, 153);
      centerBloom.addColorStop(0, "rgba(255, 255, 255, 0.18)");
      centerBloom.addColorStop(0.36, "rgba(216, 246, 252, 0.1)");
      centerBloom.addColorStop(0.72, "rgba(255, 255, 255, 0.06)");
      centerBloom.addColorStop(1, "rgba(143, 193, 207, 0.13)");
      ctx.fillStyle = centerBloom;
      ctx.fillRect(44, 46, 68, 106);

      for (let i = 0; i < 7; i += 1) {
        const x = 18 + i * 20;
        strokeLine(
          [
            [x, 45],
            [x + 36, 96],
            [x + 57, 153],
          ],
          i % 2 === 0 ? "rgba(255, 255, 255, 0.11)" : "rgba(67, 123, 139, 0.08)",
          0.7,
        );
      }

      fillNoise(33, 45, 88, 108, 260, 0.16, ["#ffffff", "#b5dce5", "#6f9daf"]);
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(35, 137);
      ctx.bezierCurveTo(47, 133, 111, 133, 123, 137);
      ctx.strokeStyle = "rgba(246, 255, 255, 0.42)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(34, 154);
      ctx.bezierCurveTo(48, 157, 108, 157, 122, 154);
      ctx.strokeStyle = "rgba(37, 91, 108, 0.18)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(27, 153);
      ctx.lineTo(128, 153);
      ctx.lineTo(137, 162);
      ctx.lineTo(124, 171);
      ctx.lineTo(33, 171);
      ctx.lineTo(24, 162);
      ctx.closePath();
      const base = ctx.createLinearGradient(24, 153, 137, 171);
      base.addColorStop(0, "rgba(255, 255, 255, 0.52)");
      base.addColorStop(0.22, "rgba(99, 153, 169, 0.28)");
      base.addColorStop(0.52, "rgba(248, 255, 255, 0.38)");
      base.addColorStop(0.78, "rgba(88, 141, 158, 0.3)");
      base.addColorStop(1, "rgba(28, 84, 103, 0.4)");
      ctx.fillStyle = base;
      ctx.fill();
      ctx.strokeStyle = "rgba(28, 78, 94, 0.52)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      ctx.save();
      for (let i = 0; i < 7; i += 1) {
        const offset = i * 2.4;
        strokeLine(
          [
            [37 + offset, 116],
            [36 + offset, 133],
            [37 + offset, 151],
          ],
          i % 2 === 0 ? "rgba(255, 255, 255, 0.58)" : "rgba(31, 82, 98, 0.2)",
          i % 2 === 0 ? 1.2 : 0.7,
        );
        strokeLine(
          [
            [111 + offset, 116],
            [112 + offset, 134],
            [111 + offset, 151],
          ],
          i % 2 === 0 ? "rgba(255, 255, 255, 0.48)" : "rgba(31, 82, 98, 0.24)",
          i % 2 === 0 ? 1.1 : 0.7,
        );
      }
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(23, 25);
      ctx.lineTo(126, 25);
      ctx.lineTo(139, 35);
      ctx.lineTo(130, 43);
      ctx.lineTo(29, 43);
      ctx.lineTo(18, 35);
      ctx.closePath();
      const topGlass = ctx.createLinearGradient(18, 25, 139, 43);
      topGlass.addColorStop(0, "rgba(39, 102, 123, 0.5)");
      topGlass.addColorStop(0.18, "rgba(255, 255, 255, 0.84)");
      topGlass.addColorStop(0.42, "rgba(197, 239, 247, 0.36)");
      topGlass.addColorStop(0.64, "rgba(44, 101, 121, 0.24)");
      topGlass.addColorStop(0.82, "rgba(255, 255, 255, 0.76)");
      topGlass.addColorStop(1, "rgba(26, 80, 100, 0.58)");
      ctx.fillStyle = topGlass;
      ctx.fill();
      ctx.strokeStyle = "rgba(25, 78, 98, 0.68)";
      ctx.lineWidth = 1.8;
      ctx.stroke();
      strokeLine([[28, 31], [125, 31], [132, 36], [126, 39], [31, 39]], "rgba(255, 255, 255, 0.62)", 1.05);
      strokeLine([[22, 36], [130, 36]], "rgba(34, 92, 112, 0.22)", 0.9);
      ctx.restore();

      ctx.save();
      roundRect(62, 8, 33, 20, 4);
      const knob = ctx.createLinearGradient(62, 8, 95, 29);
      knob.addColorStop(0, "rgba(52, 110, 128, 0.28)");
      knob.addColorStop(0.24, "rgba(255, 255, 255, 0.74)");
      knob.addColorStop(0.55, "rgba(217, 246, 251, 0.28)");
      knob.addColorStop(1, "rgba(42, 94, 112, 0.34)");
      ctx.fillStyle = knob;
      ctx.fill();
      ctx.strokeStyle = "rgba(34, 88, 106, 0.46)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      for (let x = 66; x <= 91; x += 4) {
        strokeLine([[x, 10], [x - 0.5, 27]], "rgba(255, 255, 255, 0.62)", 0.85);
        strokeLine([[x + 1.4, 10.5], [x + 0.8, 26]], "rgba(38, 92, 110, 0.15)", 0.6);
      }
      ctx.beginPath();
      ctx.ellipse(78.5, 9.5, 15.5, 2.2, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(247, 255, 255, 0.64)";
      ctx.lineWidth = 0.9;
      ctx.stroke();
      ctx.restore();

      ctx.save();
      frontPath();
      const outerStroke = ctx.createLinearGradient(27, 38, 130, 164);
      outerStroke.addColorStop(0, "rgba(18, 68, 86, 0.72)");
      outerStroke.addColorStop(0.24, "rgba(207, 247, 255, 0.86)");
      outerStroke.addColorStop(0.5, "rgba(64, 114, 132, 0.36)");
      outerStroke.addColorStop(0.78, "rgba(255, 255, 255, 0.72)");
      outerStroke.addColorStop(1, "rgba(23, 72, 88, 0.76)");
      ctx.strokeStyle = outerStroke;
      ctx.lineWidth = 2.35;
      ctx.stroke();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
      ctx.lineWidth = 0.72;
      ctx.stroke();
      ctx.restore();

      strokeLine([[38, 45], [38, 151]], "rgba(255, 255, 255, 0.68)", 2.2);
      strokeLine([[42, 47], [42, 151]], "rgba(61, 121, 139, 0.13)", 0.9);
      strokeLine([[121, 45], [121, 151]], "rgba(33, 91, 110, 0.34)", 2.1);
      strokeLine([[114, 48], [114, 150]], "rgba(255, 255, 255, 0.28)", 0.85);
      strokeLine([[48, 43], [109, 43]], "rgba(255, 255, 255, 0.38)", 0.85, 0.82);
      strokeLine([[128, 49], [137, 47], [137, 150], [128, 160]], "rgba(25, 77, 96, 0.38)", 1.15);
    };

    const drawChromatographyPaper = () => {
      ctx.save();
      ctx.shadowColor = "rgba(47, 43, 31, 0.18)";
      ctx.shadowBlur = 1.4;
      ctx.shadowOffsetY = 1;
      roundRect(16, 8, 44, 174, 2);
      const paper = ctx.createLinearGradient(16, 8, 60, 182);
      paper.addColorStop(0, "#fff9e9");
      paper.addColorStop(0.48, "#f4ecd5");
      paper.addColorStop(1, "#fbf6e7");
      ctx.fillStyle = paper;
      ctx.fill();
      ctx.restore();

      ctx.save();
      roundRect(16, 8, 44, 174, 2);
      ctx.clip();
      fillNoise(17, 10, 42, 170, 520, 0.38, ["#d9cfae", "#fffdf3", "#cfc3a3"]);
      for (let y = 18; y <= 172; y += 16) {
        strokeLine([[19, y + 0.2], [57, y - 0.9]], "rgba(130, 115, 83, 0.08)", 0.45);
      }
      ctx.restore();

      roundRect(16, 8, 44, 174, 2);
      ctx.strokeStyle = "rgba(87, 78, 61, 0.58)";
      ctx.lineWidth = 1.35;
      ctx.stroke();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
      ctx.lineWidth = 0.45;
      ctx.stroke();
      ctx.save();
      ctx.setLineDash([3, 2.2]);
      strokeLine([[20, 160], [56, 160]], "rgba(70, 64, 53, 0.58)", 1.1);
      ctx.restore();
    };

    const drawChromatographyCapillaryTube = () => {
      const top = { x: 49, y: 7 };
      const bottom = { x: 18, y: 173 };
      const dx = top.x - bottom.x;
      const dy = top.y - bottom.y;
      const length = Math.hypot(dx, dy);
      const unit = { x: dx / length, y: dy / length };
      const normal = { x: -unit.y, y: unit.x };
      const radius = 5.5;
      const sideA = (point) => ({ x: point.x + normal.x * radius, y: point.y + normal.y * radius });
      const sideB = (point) => ({ x: point.x - normal.x * radius, y: point.y - normal.y * radius });
      const pointAt = (fraction) => ({
        x: bottom.x + dx * fraction,
        y: bottom.y + dy * fraction,
      });
      const ellipseRotation = Math.atan2(normal.y, normal.x);

      ctx.save();
      ctx.shadowColor = "rgba(20, 43, 50, 0.24)";
      ctx.shadowBlur = 2.4;
      ctx.shadowOffsetX = 1.5;
      ctx.shadowOffsetY = 2;
      ctx.beginPath();
      ctx.moveTo(sideA(top).x, sideA(top).y);
      ctx.lineTo(sideA(bottom).x, sideA(bottom).y);
      ctx.lineTo(sideB(bottom).x, sideB(bottom).y);
      ctx.lineTo(sideB(top).x, sideB(top).y);
      ctx.closePath();
      const glass = ctx.createLinearGradient(18, 156, 54, 18);
      glass.addColorStop(0, "rgba(206, 231, 238, 0.58)");
      glass.addColorStop(0.28, "rgba(255, 255, 255, 0.82)");
      glass.addColorStop(0.55, "rgba(108, 146, 158, 0.32)");
      glass.addColorStop(0.82, "rgba(250, 255, 255, 0.72)");
      glass.addColorStop(1, "rgba(166, 204, 215, 0.52)");
      ctx.fillStyle = glass;
      ctx.fill();
      ctx.restore();

      strokeLine(
        [
          [sideA(bottom).x, sideA(bottom).y],
          [sideA(top).x, sideA(top).y],
        ],
        "rgba(37, 74, 87, 0.7)",
        1.7,
      );
      strokeLine(
        [
          [sideB(bottom).x, sideB(bottom).y],
          [sideB(top).x, sideB(top).y],
        ],
        "rgba(90, 135, 148, 0.55)",
        1.55,
      );
      strokeLine(
        [
          [bottom.x + normal.x * 0.7, bottom.y + normal.y * 0.7],
          [top.x + normal.x * 0.7, top.y + normal.y * 0.7],
        ],
        "rgba(255, 255, 255, 0.92)",
        1.45,
      );
      strokeLine(
        [
          [bottom.x - normal.x * 1.2, bottom.y - normal.y * 1.2],
          [top.x - normal.x * 1.2, top.y - normal.y * 1.2],
        ],
        "rgba(30, 83, 101, 0.3)",
        1,
      );

      const dyeCenter = pointAt(0.11);
      ctx.save();
      ctx.translate(dyeCenter.x, dyeCenter.y);
      ctx.rotate(ellipseRotation);
      const dye = ctx.createLinearGradient(-4.2, 0, 4.2, 0);
      dye.addColorStop(0, "rgba(108, 38, 70, 0.25)");
      dye.addColorStop(0.48, "rgba(167, 44, 73, 0.88)");
      dye.addColorStop(1, "rgba(84, 40, 86, 0.38)");
      ctx.strokeStyle = dye;
      ctx.lineWidth = 3.2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-5.7, 0);
      ctx.lineTo(5.7, 0);
      ctx.stroke();
      ctx.restore();

      const droplet = pointAt(0.035);
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(droplet.x - normal.x * 0.2, droplet.y - normal.y * 0.2, 3.5, 1.8, ellipseRotation, 0, Math.PI * 2);
      const sample = ctx.createRadialGradient(droplet.x - 0.5, droplet.y - 0.5, 0.4, droplet.x, droplet.y, 2.8);
      sample.addColorStop(0, "rgba(184, 58, 87, 0.88)");
      sample.addColorStop(1, "rgba(73, 34, 78, 0.52)");
      ctx.fillStyle = sample;
      ctx.fill();
      ctx.restore();

      for (const end of [top, bottom]) {
        ctx.save();
        ctx.translate(end.x, end.y);
        ctx.rotate(ellipseRotation);
        ctx.beginPath();
        ctx.ellipse(0, 0, 5.9, 2.3, 0, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(52, 91, 105, 0.68)";
        ctx.lineWidth = 1.15;
        ctx.stroke();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.76)";
        ctx.lineWidth = 0.55;
        ctx.stroke();
        ctx.restore();
      }
    };

    const drawCapillarySpotter = () => {
      drawChromatographyCapillaryTube();
    };

    const drawMetricRuler = () => {
      ctx.save();
      ctx.shadowColor = "rgba(63, 50, 20, 0.18)";
      ctx.shadowBlur = 1.5;
      ctx.shadowOffsetY = 0.8;
      roundRect(5, 7, 168, 20, 2.2);
      const wood = ctx.createLinearGradient(5, 7, 173, 27);
      wood.addColorStop(0, "#f8d978");
      wood.addColorStop(0.22, "#e4bb54");
      wood.addColorStop(0.52, "#f4d482");
      wood.addColorStop(0.86, "#d8a840");
      wood.addColorStop(1, "#f5d776");
      ctx.fillStyle = wood;
      ctx.fill();
      ctx.restore();

      ctx.save();
      roundRect(5, 7, 168, 20, 2.2);
      ctx.clip();
      fillNoise(7, 8, 164, 18, 360, 0.22, ["#b9872b", "#fff0a8", "#8b6724"]);
      for (let y = 10; y <= 24; y += 4.3) {
        strokeLine([[8, y], [170, y - 0.8]], "rgba(255, 240, 164, 0.18)", 0.55);
      }
      ctx.restore();

      roundRect(5, 7, 168, 20, 2.2);
      ctx.strokeStyle = "rgba(94, 69, 22, 0.72)";
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.strokeStyle = "rgba(255, 247, 195, 0.54)";
      ctx.lineWidth = 0.45;
      ctx.stroke();

      ctx.save();
      const start = 16;
      const end = 162;
      const minorStep = (end - start) / 100;
      for (let i = 0; i <= 100; i += 1) {
        const x = start + i * minorStep;
        const isCm = i % 10 === 0;
        const isHalfCm = i % 5 === 0;
        strokeLine(
          [[x, 8.4], [x, isCm ? 22 : isHalfCm ? 17.6 : 14.1]],
          "rgba(78, 54, 19, 0.9)",
          isCm ? 0.95 : isHalfCm ? 0.72 : 0.42,
        );
      }
      ctx.restore();

      ctx.save();
      ctx.font = "5.2px Arial, sans-serif";
      ctx.fillStyle = "rgba(74, 51, 15, 0.82)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      [0, 2, 4, 6, 8, 10].forEach((mark) => {
        ctx.fillText(String(mark), start + mark * 10 * minorStep, 24.1);
      });
      ctx.restore();
    };

    if (target.id === "chromatography-chamber") drawChromatographyChamber();
    if (target.id === "chromatography-paper") drawChromatographyPaper();
    if (target.id === "capillary-spotter") drawCapillarySpotter();
    if (target.id === "metric-ruler") drawMetricRuler();

    return canvas.toDataURL("image/png");
  }, { target: asset, output: outputDimensionsFor(asset), contentInset });

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const asset of assets) {
    const dataUrl = await renderPng(page, asset);
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
    const pngBuffer = Buffer.from(base64, "base64");
    const pngPath = join(outputDir, `${asset.id}.png`);
    const svgPath = join(outputDir, `${asset.id}.svg`);
    const output = outputDimensionsFor(asset);
    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${output.width}" height="${output.height}" viewBox="0 0 ${output.width} ${output.height}" role="img" aria-label="${escapeXml(asset.label)}">\n  <image width="${output.width}" height="${output.height}" href="data:image/png;base64,${base64}" preserveAspectRatio="xMidYMid meet"/>\n</svg>\n`;
    await writeGeneratedFile(pngPath, pngBuffer);
    await writeGeneratedFile(svgPath, svg, "utf8");
    console.log(`wrote ${pngPath}`);
    console.log(`wrote ${svgPath}`);
  }
} finally {
  await browser.close();
}
