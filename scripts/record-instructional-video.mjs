#!/usr/bin/env node
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(rootDir, "docs", "instructional-video");
const workDir = path.join(outputDir, ".render");
const rawDir = path.join(workDir, "raw");
const downloadDir = path.join(workDir, "downloads");
const outputMp4 = path.join(outputDir, "lab-studio-instructional.mp4");
const viewport = { width: 1280, height: 720 };
const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
const ffmpegBin = process.env.FFMPEG_BIN ?? "ffmpeg";
const ffprobeBin = process.env.FFPROBE_BIN ?? "ffprobe";
const viteCli = path.join(rootDir, "node_modules", "vite", "bin", "vite.js");
const captionsPath = path.join(outputDir, "captions.vtt");
const captionEvents = [];
let activeCaptionEvent;
let recordingStartMs = 0;

const elapsedSeconds = () => (Date.now() - recordingStartMs) / 1000;

const formatTimestamp = (seconds) => {
  const totalMilliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(totalMilliseconds / 3600000);
  const minutes = Math.floor((totalMilliseconds % 3600000) / 60000);
  const wholeSeconds = Math.floor((totalMilliseconds % 60000) / 1000);
  const milliseconds = totalMilliseconds % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(wholeSeconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
};

const startCaptionEvent = (text) => {
  const now = elapsedSeconds();
  if (activeCaptionEvent) activeCaptionEvent.end = now;
  activeCaptionEvent = { start: now, end: now, text };
  captionEvents.push(activeCaptionEvent);
};

const closeCaptionTimeline = () => {
  if (activeCaptionEvent) {
    activeCaptionEvent.end = elapsedSeconds();
    activeCaptionEvent = undefined;
  }
};

const writeCaptions = async (maxDurationSeconds) => {
  const firstStart = captionEvents[0]?.start ?? 0;
  const body = captionEvents
    .map((event) => {
      const start = Math.max(0, event.start - firstStart);
      const uncappedEnd = Math.max(start + 0.001, event.end - firstStart);
      const end = Math.min(uncappedEnd, maxDurationSeconds);
      if (start >= end) return undefined;
      return `${formatTimestamp(start)} --> ${formatTimestamp(end)}\n${event.text}`;
    })
    .filter(Boolean)
    .join("\n\n");
  await writeFile(captionsPath, `WEBVTT\n\n${body}\n`, "utf8");
};

const run = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: "inherit",
      shell: process.platform === "win32",
      ...options,
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
      }
    });
  });

const captureOutput = (command, args) =>
  new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const child = spawn(command, args, {
      cwd: rootDir,
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with code ${code}: ${stderr}`));
      }
    });
  });

const probeVideoDuration = async (filePath) => {
  const output = await captureOutput(ffprobeBin, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  const duration = Number(output);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Unable to read video duration from ${filePath}`);
  }
  return duration;
};

const findOpenPort = (startPort) =>
  new Promise((resolve, reject) => {
    const tryPort = (port) => {
      const server = net.createServer();
      server.once("error", () => tryPort(port + 1));
      server.once("listening", () => {
        server.close(() => resolve(port));
      });
      server.listen(port, "127.0.0.1");
    };
    try {
      tryPort(startPort);
    } catch (error) {
      reject(error);
    }
  });

const waitForServer = async (url, previewProcess) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30000) {
    if (previewProcess.exitCode !== null) {
      throw new Error("Vite preview exited before it was ready.");
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Keep polling until Vite is reachable.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
};

const stopProcessTree = async (child) => {
  if (!child || child.exitCode !== null) return;
  if (process.platform !== "win32") {
    child.kill("SIGTERM");
    return;
  }
  await new Promise((resolve) => {
    const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      shell: true,
    });
    killer.on("error", () => {
      child.kill();
      resolve();
    });
    killer.on("close", () => resolve());
  });
};

const startPreview = async () => {
  const port = await findOpenPort(4173);
  const preview = spawn(
    process.execPath,
    [viteCli, "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    {
      cwd: rootDir,
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    },
  );
  preview.stdout.on("data", (chunk) => process.stdout.write(chunk));
  preview.stderr.on("data", (chunk) => process.stderr.write(chunk));
  preview.on("error", (error) => {
    throw error;
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await waitForServer(baseUrl, preview);
  } catch (error) {
    await stopProcessTree(preview);
    throw error;
  }
  return { preview, baseUrl };
};

const ensureOverlay = async (page) => {
  await page.evaluate(() => {
    if (document.getElementById("recording-overlay-style")) return;
    const style = document.createElement("style");
    style.id = "recording-overlay-style";
    style.textContent = `
      #recording-caption {
        position: fixed;
        left: 50%;
        bottom: 24px;
        transform: translateX(-50%);
        z-index: 2147483646;
        width: min(1040px, calc(100vw - 96px));
        padding: 16px 20px;
        border: 1px solid rgba(255, 255, 255, 0.32);
        border-radius: 10px;
        background: rgba(9, 16, 20, 0.88);
        box-shadow: 0 18px 48px rgba(0, 0, 0, 0.28);
        color: #ffffff;
        font: 600 24px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        text-align: center;
        pointer-events: none;
      }
      #recording-cursor {
        position: fixed;
        left: 80px;
        top: 80px;
        z-index: 2147483647;
        width: 28px;
        height: 28px;
        border: 3px solid #ffffff;
        border-radius: 999px;
        background: rgba(0, 127, 123, 0.78);
        box-shadow: 0 0 0 5px rgba(0, 127, 123, 0.22), 0 6px 18px rgba(0, 0, 0, 0.35);
        transform: translate(-50%, -50%);
        transition: left 180ms ease, top 180ms ease, transform 120ms ease;
        pointer-events: none;
      }
      #recording-cursor.is-clicking {
        transform: translate(-50%, -50%) scale(0.72);
      }
      #recording-highlight {
        position: fixed;
        z-index: 2147483645;
        border: 4px solid rgba(0, 127, 123, 0.86);
        border-radius: 12px;
        box-shadow: 0 0 0 9999px rgba(255, 255, 255, 0.0), 0 0 0 8px rgba(0, 127, 123, 0.16);
        pointer-events: none;
        opacity: 0;
        transition: all 180ms ease, opacity 180ms ease;
      }
    `;
    document.head.append(style);

    const caption = document.createElement("div");
    caption.id = "recording-caption";
    caption.setAttribute("aria-hidden", "true");
    document.body.append(caption);

    const cursor = document.createElement("div");
    cursor.id = "recording-cursor";
    cursor.setAttribute("aria-hidden", "true");
    document.body.append(cursor);

    const highlight = document.createElement("div");
    highlight.id = "recording-highlight";
    highlight.setAttribute("aria-hidden", "true");
    document.body.append(highlight);
  });
};

const setCaption = async (page, text) => {
  await ensureOverlay(page);
  startCaptionEvent(text);
  await page.evaluate((captionText) => {
    const caption = document.getElementById("recording-caption");
    if (caption) caption.textContent = captionText;
  }, text);
};

const hold = async (page, seconds, captionText) => {
  if (captionText) await setCaption(page, captionText);
  await page.waitForTimeout(seconds * 1000);
};

const scrollToTop = async (page) => {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(250);
};

const highlight = async (page, locator) => {
  await ensureOverlay(page);
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) return;
  await page.evaluate(({ x, y, width, height }) => {
    const highlightBox = document.getElementById("recording-highlight");
    if (!highlightBox) return;
    highlightBox.style.left = `${Math.max(8, x - 8)}px`;
    highlightBox.style.top = `${Math.max(8, y - 8)}px`;
    highlightBox.style.width = `${width + 16}px`;
    highlightBox.style.height = `${height + 16}px`;
    highlightBox.style.opacity = "1";
  }, box);
};

const clearHighlight = async (page) => {
  await page.evaluate(() => {
    const highlightBox = document.getElementById("recording-highlight");
    if (highlightBox) highlightBox.style.opacity = "0";
  });
};

const moveCursorTo = async (page, locator) => {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) return undefined;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.evaluate(({ cursorX, cursorY }) => {
    const cursor = document.getElementById("recording-cursor");
    if (!cursor) return;
    cursor.style.left = `${cursorX}px`;
    cursor.style.top = `${cursorY}px`;
  }, { cursorX: x, cursorY: y });
  await page.mouse.move(x, y, { steps: 16 });
  await page.waitForTimeout(250);
  return { x, y };
};

const click = async (page, locator) => {
  const point = await moveCursorTo(page, locator);
  if (!point) {
    await locator.click();
    return;
  }
  await page.evaluate(() => document.getElementById("recording-cursor")?.classList.add("is-clicking"));
  await page.mouse.down();
  await page.waitForTimeout(120);
  await page.mouse.up();
  await page.evaluate(() => document.getElementById("recording-cursor")?.classList.remove("is-clicking"));
  await page.waitForTimeout(350);
};

const dragBetween = async (page, sourceLocator, targetLocator) => {
  await sourceLocator.scrollIntoViewIfNeeded();
  await targetLocator.scrollIntoViewIfNeeded();
  const sourceBox = await sourceLocator.boundingBox();
  const targetBox = await targetLocator.boundingBox();
  if (!sourceBox || !targetBox) return;
  const start = {
    x: sourceBox.x + sourceBox.width / 2,
    y: sourceBox.y + sourceBox.height / 2,
  };
  const end = {
    x: targetBox.x + targetBox.width / 2,
    y: targetBox.y + targetBox.height / 2,
  };
  await page.evaluate(({ cursorX, cursorY }) => {
    const cursor = document.getElementById("recording-cursor");
    if (!cursor) return;
    cursor.style.left = `${cursorX}px`;
    cursor.style.top = `${cursorY}px`;
  }, { cursorX: start.x, cursorY: start.y });
  await page.mouse.move(start.x, start.y, { steps: 16 });
  await page.waitForTimeout(250);
  await page.evaluate(() => document.getElementById("recording-cursor")?.classList.add("is-clicking"));
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 24 });
  await page.mouse.up();
  await page.evaluate(({ cursorX, cursorY }) => {
    const cursor = document.getElementById("recording-cursor");
    if (!cursor) return;
    cursor.style.left = `${cursorX}px`;
    cursor.style.top = `${cursorY}px`;
    cursor.classList.remove("is-clicking");
  }, { cursorX: end.x, cursorY: end.y });
  await page.waitForTimeout(500);
};

const gotoRoute = async (page, baseUrl, hash) => {
  await page.goto(`${baseUrl}/#/${hash}`);
  await page.waitForLoadState("networkidle");
  await ensureOverlay(page);
  await scrollToTop(page);
};

const recordWalkthrough = async (baseUrl) => {
  const browser = await chromium.launch();
  let context;
  let video;

  try {
    context = await browser.newContext({
      acceptDownloads: true,
      recordVideo: { dir: rawDir, size: viewport },
      viewport,
    });
    const page = await context.newPage();
    video = page.video();
    recordingStartMs = Date.now();
    captionEvents.length = 0;
    activeCaptionEvent = undefined;

    await gotoRoute(page, baseUrl, "");
    await page.getByRole("heading", { name: "Lab Studio" }).waitFor();
    await hold(page, 7, "Lab Studio is a static chemistry workspace for authoring and running schema-driven labs.");
    await highlight(page, page.getByRole("navigation", { name: "Main navigation" }));
    await hold(page, 7, "Teachers build structured process maps, and students practice the same workflows in the simulator.");
    await clearHighlight(page);
    await highlight(page, page.getByRole("heading", { name: "Bundled labs" }));
    await hold(page, 6, "Hash routes make each lab and technique easy to share from static hosting.");
    await clearHighlight(page);
    await highlight(page, page.getByRole("link", { name: "Run demo lab" }));
    await hold(page, 5, "This walkthrough covers the student flow first, then the teacher authoring flow.");
    await clearHighlight(page);

    await gotoRoute(page, baseUrl, "play/hard-water-demo");
    await page.getByRole("heading", { name: "Hard-Water Reference Demo" }).waitFor();
    await hold(page, 9, "In Student Player, the learner sees the goal, mode toggle, equipment, workbench, process progress, feedback, and evidence panels together.");
    await highlight(page, page.getByRole("group", { name: "Player mode" }));
    await hold(page, 9, "Guided mode keeps the expected step visible. Assessment mode lets the same runtime run with less scaffolding.");
    await clearHighlight(page);
    await highlight(page, page.getByLabel("Workbench"));
    await hold(page, 10, "The shelf and workbench keep equipment state visible while each process node advances.");
    await clearHighlight(page);
    await click(page, page.getByRole("button", { name: /Sample rack, available/i }));
    await click(page, page.getByRole("button", { name: /Graduated cylinder, available/i }));
    await dragBetween(
      page,
      page.getByRole("button", { name: /Sample rack, Hard water sample/i }),
      page.getByRole("button", { name: /Graduated cylinder, empty/i }),
    );
    await hold(page, 12, "Direct bench manipulation sends a typed action request through the simulator runtime.");
    await highlight(page, page.getByLabel("Process progress"));
    await hold(page, 12, "Feedback explains what changed, and the process map moves to the next required action.");
    await clearHighlight(page);
    await click(page, page.getByRole("button", { name: "Record sample volume" }));
    await hold(page, 14, "Evidence controls appear when measurements, calculations, or notebook entries are ready.");
    await click(page, page.getByRole("button", { name: "Assessment" }));
    await hold(page, 11, "Assessment mode uses the same lab definition, so teachers are not maintaining a separate activity.");
    await click(page, page.getByRole("button", { name: "Reset" }).first());
    await hold(page, 13, "Reset returns the lab to its initial equipment and process state for another attempt.");
    await hold(page, 15, "The hard-water demo is reference content built from general schema-backed actions.");

    await gotoRoute(page, baseUrl, "technique/filtration");
    await page.getByRole("heading", { name: "Filter a Precipitate" }).waitFor();
    await hold(page, 10, "Standalone techniques isolate one skill, such as filtering and rinsing a precipitate.");
    await click(page, page.getByRole("button", { name: /Filter paper, available/i }));
    await click(page, page.getByRole("button", { name: /Funnel and stand, available/i }));
    await dragBetween(
      page,
      page.getByRole("button", { name: /Filter paper, empty/i }),
      page.getByRole("button", { name: /Funnel and stand, empty/i }),
    );
    await hold(page, 14, "Learners can place equipment with pointer or drag interactions while the runtime records the same state transition.");
    await click(page, page.getByRole("button", { name: /Wash bottle, available/i }));
    await click(page, page.getByRole("button", { name: /Wash bottle, empty/i }));
    await click(page, page.getByRole("button", { name: /Filter paper, empty/i }));
    await hold(page, 11, "The keyboard path exposes source and target selection for the same underlying action.");
    await click(page, page.getByRole("button", { name: "Confirm accessible action" }));
    await hold(page, 15, "Confirm accessible action completes the expected step without requiring drag and drop.");
    await hold(page, 10, "Technique practice can be used alone or embedded inside a larger lab.");

    await gotoRoute(page, baseUrl, "studio");
    await page.getByRole("heading", { name: "Teacher Studio" }).waitFor();
    await hold(page, 12, "Teacher Studio authors constrained LabDefinition JSON instead of arbitrary teacher code.");
    await highlight(page, page.getByRole("heading", { name: "Templates" }));
    await hold(page, 13, "Templates add supported actions and nodes that the simulator already understands.");
    await clearHighlight(page);
    await click(page, page.getByRole("button", { name: /Filtration/ }));
    await hold(page, 13, "Adding a filtration template extends the process map and keeps the draft schema-driven.");
    const filtrationNode = page.locator(".map-node").filter({ hasText: "Filtration" }).last();
    await click(page, filtrationNode);
    const titleInput = page.getByRole("textbox", { name: "Title", exact: true });
    await click(page, titleInput);
    await titleInput.fill("Filtration checkpoint");
    await hold(page, 15, "The inspector edits structured fields such as title, description, hints, action parameters, and feedback.");
    await highlight(page, page.getByRole("heading", { name: "Edges" }));
    await hold(page, 14, "Validation rules, retry edges, required equipment, and start node choices stay explicit in the authoring surface.");
    await clearHighlight(page);
    await page.getByRole("heading", { name: "Live preview" }).scrollIntoViewIfNeeded();
    await highlight(page, page.getByRole("heading", { name: "Live preview" }));
    await hold(page, 14, "Live preview runs the current draft through the same Student Player used by learners.");
    await clearHighlight(page);
    await scrollToTop(page);
    await click(page, page.getByRole("button", { name: "Save draft" }));
    await hold(page, 9, "Save draft stores local authoring work for this browser.");
    const downloadPromise = page.waitForEvent("download");
    await click(page, page.getByRole("button", { name: "Export" }));
    const download = await downloadPromise;
    const exportPath = path.join(downloadDir, await download.suggestedFilename());
    await download.saveAs(exportPath);
    const chooserPromise = page.waitForEvent("filechooser");
    await click(page, page.locator("label.file-button").filter({ hasText: "Import" }));
    const chooser = await chooserPromise;
    await chooser.setFiles(exportPath);
    await page.getByText("Imported lab draft.").waitFor();
    await hold(page, 10, "Export and import round-trip the lab as portable JSON for review or publishing.");

    await gotoRoute(page, baseUrl, "");
    await page.getByRole("heading", { name: "Bundled labs" }).waitFor();
    await highlight(page, page.getByRole("heading", { name: "Bundled labs" }));
    await hold(page, 13, "Published bundled labs come from public JSON files and load through the same route path students use.");
    await clearHighlight(page);
    await highlight(page, page.getByRole("heading", { name: "Standalone techniques" }));
    await hold(page, 13, "Bundled techniques follow the same contract, so fixtures are not the publishing source of truth.");
    await clearHighlight(page);
    await highlight(page, page.getByRole("navigation", { name: "Main navigation" }));
    await hold(page, 14, "Share a lab with a URL like #/play/hard-water-demo, or publish new JSON-backed content after validation and build checks pass.");
    await clearHighlight(page);
    closeCaptionTimeline();

    await context.close();
    return await video.path();
  } catch (error) {
    if (context) await context.close().catch(() => undefined);
    throw error;
  } finally {
    await browser.close().catch(() => undefined);
  }
};

const transcodeToMp4 = async (inputWebm) => {
  await run(ffmpegBin, [
    "-y",
    "-i",
    inputWebm,
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outputMp4,
  ]);
};

const main = async () => {
  await mkdir(outputDir, { recursive: true });
  await rm(workDir, { recursive: true, force: true });
  await mkdir(rawDir, { recursive: true });
  await mkdir(downloadDir, { recursive: true });

  await run(npmBin, ["run", "build"]);
  const { preview, baseUrl } = await startPreview();
  try {
    const rawVideo = await recordWalkthrough(baseUrl);
    await transcodeToMp4(rawVideo);
    const duration = await probeVideoDuration(outputMp4);
    await writeCaptions(duration);
  } finally {
    await stopProcessTree(preview);
  }

  console.log(`Instructional video written to ${outputMp4}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
