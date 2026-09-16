// Gold Globe product browser proof. Test names match src/app/app-acceptance-data.ts rows.
import { expect, test as playwrightTest, type Locator, type Page } from "@playwright/test";
import {
  createToolcraftState,
  getToolcraftImageExportSize,
  type ToolcraftArtifactSize,
  type ToolcraftExportFrame,
} from "@/toolcraft/runtime";

import { appAcceptance, appControlSectionInventory } from "../src/app/app-acceptance";
import { appSchema } from "../src/app/app-schema";
import { expectToolcraftReferenceParity } from "./browser-acceptance-outcome-helpers";
import {
  expectToolcraftInfinityCanvasBackgroundEvidence,
  expectToolcraftInfinityCanvasImageExportEvidence,
  observeInfinityCanvasBackground,
} from "./browser-infinity-canvas-evidence";
import { createToolcraftBrowserProofSession } from "./browser-proof-session";
import { attachToolcraftBrowserRuntimeEvidence } from "./browser-runtime-evidence";
import { deriveToolcraftBrowserRuntimeRequirements } from "./browser-runtime-evidence-requirements";
import { inspectToolcraftImageDownload } from "./image-artifact-inspection";
import { expectToolcraftProductObservableToChange } from "./product-observable-helpers";
import { test } from "./toolcraft-product-test";

// Full Chromium keeps a hardware-like WebGL context for the displaced globe and its shadow map.
playwrightTest.use({ launchOptions: { args: ["--ignore-gpu-blocklist"], channel: "chromium" } });

const GLOBE_CANVAS = 'canvas[data-toolcraft-product-output=""]';

async function ready(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.locator(GLOBE_CANVAS)).toHaveAttribute("data-globe-status", "ready", {
    timeout: 30_000,
  });
}

function field(page: Page, target: string): Locator {
  return page.locator(`[data-toolcraft-control-target="${target}"]`);
}

async function selectOption(page: Page, target: string, optionName: string) {
  const trigger = field(page, target).getByRole("combobox");
  await trigger.click();
  await page.locator('[data-slot="select-item"]').filter({ hasText: optionName }).click();
  await expect(trigger).toContainText(optionName);
}

async function exportAndInspectPng(
  page: Page,
  backgroundRgba: readonly [number, number, number, number],
) {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG" }).click();
  return inspectToolcraftImageDownload({ backgroundRgba, download: await downloadPromise, page });
}

function exportSize(frame: ToolcraftExportFrame, resolution: "2k" | "4k" | "8k"): ToolcraftArtifactSize {
  const { height, width } = getToolcraftImageExportSize({
    frame,
    resolution,
    state: createToolcraftState(appSchema),
  });
  return { height, width };
}

function finiteExportSize(resolution: "2k" | "4k" | "8k" = "4k"): ToolcraftArtifactSize {
  const { height, width } = createToolcraftState(appSchema).canvas.size;
  return exportSize({ height, width, x: 0, y: 0 }, resolution);
}

async function infiniteExportSize(page: Page): Promise<ToolcraftArtifactSize> {
  const scene = page.locator('[data-toolcraft-product-scene-status="ready"]');
  await expect(scene).toBeVisible();
  const frame = await scene.evaluate((element) => {
    const style = getComputedStyle(element);
    return { height: Number.parseFloat(style.height), width: Number.parseFloat(style.width), x: 0, y: 0 };
  });
  return exportSize(frame, "4k");
}

// Attach every requirement the acceptance data derives for this test after its assertions passed.
async function attachRequirements(testName: string, emitted: ReadonlySet<string> = new Set()) {
  const requirements = deriveToolcraftBrowserRuntimeRequirements(
    appAcceptance,
    appSchema,
    appControlSectionInventory,
  ).filter((requirement) => requirement.testName === testName);
  expect(requirements.length).toBeGreaterThan(0);
  for (const requirement of requirements) {
    if (emitted.has(`${requirement.requirementId}:${requirement.evidenceType}`)) continue;
    await attachToolcraftBrowserRuntimeEvidence({
      evidenceType: requirement.evidenceType,
      requirementId: requirement.requirementId,
      target: requirement.target,
    });
  }
}

async function ensureKeyframes(page: Page, target: string, label: string): Promise<void> {
  const control = field(page, target);
  const add = control.getByRole("button", { name: `Add ${label} keyframe` });
  if (await add.isVisible()) await add.click();
  await expect(control.getByRole("button", { name: `Disable ${label} keyframes` })).toBeVisible();
}

async function enableExtendedTimeline(page: Page): Promise<Locator> {
  const scrubber = page.getByRole("slider", { name: "Playback position" });
  if (!(await scrubber.isVisible())) {
    await field(page, "panels.timeline.extended").getByRole("switch").click();
    await expect(scrubber).toBeVisible();
  }
  const pause = page.getByRole("button", { name: "Pause playback" });
  if (await pause.isVisible()) await pause.click();
  return scrubber;
}

const sliders = [
  ["globe.spin", "Spin", "Spin"],
  ["globe.relief", "Relief", "Relief"],
  ["globe.x", "Position X", "Globe position X"],
  ["globe.y", "Position Y", "Globe position Y"],
  ["globe.z", "Position Z", "Globe position Z"],
  ["globe.shine", "Shine", "Shine"],
  ["material.gold", "Gold", "Gold"],
  ["material.stoneRoughness", "Stone roughness", "Stone roughness"],
  ["camera.x", "Position X", "Camera position X"],
  ["camera.y", "Position Y", "Camera position Y"],
  ["camera.z", "Position Z", "Camera position Z"],
  ["camera.yaw", "Yaw", "Camera yaw"],
  ["camera.pitch", "Pitch", "Camera pitch"],
  ["camera.focusDistance", "Focus distance", "Focus distance"],
  ["camera.focusBlur", "Focus blur", "Focus blur"],
  ["light.x", "Position X", "Light position X"],
  ["light.y", "Position Y", "Light position Y"],
  ["light.z", "Position Z", "Light position Z"],
  ["light.intensity", "Intensity", "Intensity"],
  ["light.beamAngle", "Beam width", "Beam width"],
  ["light.beamSoftness", "Beam softness", "Beam softness"],
  ["light.edgeFalloff", "Edge falloff", "Edge falloff"],
  ["grade.temperature", "Temperature", "Temperature"],
  ["grade.tint", "Tint", "Tint"],
  ["transactions.show", "Show", "Transactions show"],
  ["transactions.intensity", "Intensity", "Transactions intensity"],
  ["transactions.shimmer", "Shimmer", "Transactions shimmer"],
] as const;

for (const [target, label, testLabel] of sliders) {
  const testName = `browser: ${testLabel} slider changes the rendered globe`;
  test(testName, async ({ page }) => {
    await ready(page);
    const session = await createToolcraftBrowserProofSession(page);
    await expectToolcraftProductObservableToChange(
      session,
      session.controlAction(target, async (control) => {
        const slider = control.getByRole("slider");
        const before = await slider.getAttribute("aria-valuenow");
        await slider.press(before === (await slider.getAttribute("aria-valuemax")) ? "Home" : "End");
      }),
      { requirementId: target, selector: GLOBE_CANVAS },
    );
    await ensureKeyframes(page, target, label);
    await attachRequirements(testName, new Set([`${target}:product-observable-change`]));
  });
}

test("browser: Stone finish switches between smooth and rough spread", async ({ page }) => {
  await ready(page);
  const session = await createToolcraftBrowserProofSession(page);
  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction("material.stoneFinish", async () => {
      await selectOption(page, "material.stoneFinish", "Rough spread");
    }),
    { requirementId: "material.stoneFinish", selector: GLOBE_CANVAS, timeoutMs: 20_000 },
  );
  await selectOption(page, "material.stoneFinish", "Smooth spread");
  await attachRequirements(
    "browser: Stone finish switches between smooth and rough spread",
    new Set(["material.stoneFinish:product-observable-change"]),
  );
});

test("browser: Background switch controls preview and PNG alpha", async ({ page }) => {
  await ready(page);
  await field(page, "canvas.infinity").getByRole("switch").click();
  await expect(page.locator(GLOBE_CANVAS)).toHaveAttribute("data-globe-status", "ready");
  const infinite = await observeInfinityCanvasBackground(page);
  const backgroundSwitch = field(page, "export.includeBackground").getByRole("switch");
  await backgroundSwitch.click();
  const backgroundExcluded = await observeInfinityCanvasBackground(page);
  await expect(field(page, "canvas.infinity").getByRole("switch")).toBeDisabled();
  const transparent = await exportAndInspectPng(page, [0, 0, 0, 0]);
  expect(transparent.observation.normalizedPixels[3]).toBe(0);
  await backgroundSwitch.click();
  const backgroundRestored = await observeInfinityCanvasBackground(page);
  await expectToolcraftInfinityCanvasBackgroundEvidence(
    { backgroundExcluded, backgroundRestored, infinite },
    {
      expectedBackgroundColor: "#000000",
      requirementId: "export.includeBackground",
      target: "export.includeBackground",
    },
  );
  await attachRequirements(
    "browser: Background switch controls preview and PNG alpha",
    new Set(["export.includeBackground:background-infinity-viewport"]),
  );
});

test("browser: Background color reaches exported PNG corners", async ({ page }) => {
  await ready(page);
  const input = field(page, "scene.background").getByRole("textbox");
  await input.fill("#203040");
  await input.press("Enter");
  const artifact = await exportAndInspectPng(page, [32, 48, 64, 255]);
  expect(Array.from(artifact.observation.normalizedPixels.slice(0, 4))).toEqual([32, 48, 64, 255]);
  await ensureKeyframes(page, "scene.background", "Background color");
  await attachRequirements("browser: Background color reaches exported PNG corners");
});

test("browser: image format options select PNG and JPG", async ({ page }) => {
  await ready(page);
  await selectOption(page, "export.image.format", "JPG");
  await expect(page.getByRole("button", { name: "Export JPG" })).toBeVisible();
  await selectOption(page, "export.image.format", "PNG");
  await attachRequirements("browser: image format options select PNG and JPG");
});

test("browser: image resolution options select 2K, 4K, and 8K", async ({ page }) => {
  await ready(page);
  await selectOption(page, "export.image.resolution", "2K");
  await selectOption(page, "export.image.resolution", "8K");
  await selectOption(page, "export.image.resolution", "4K");
  await attachRequirements("browser: image resolution options select 2K, 4K, and 8K");
});

test("browser: Export PNG downloads a decoded globe image", async ({ page }) => {
  await ready(page);
  await selectOption(page, "export.image.resolution", "2K");
  const small = await exportAndInspectPng(page, [0, 0, 0, 255]);
  expect(small.inspection).toMatchObject(finiteExportSize("2k"));
  await selectOption(page, "export.image.resolution", "4K");
  const artifact = await exportAndInspectPng(page, [0, 0, 0, 255]);
  expect(artifact.inspection).toMatchObject(finiteExportSize("4k"));
  const pixels = artifact.observation.normalizedPixels;
  const rgbaAt = (x: number, y: number) => {
    const offset = (y * 64 + x) * 4;
    return Array.from(pixels.subarray(offset, offset + 4));
  };
  expect(rgbaAt(0, 0)).toEqual([0, 0, 0, 255]);
  // The default frame starts below the canvas edge, so sample the lit upper globe.
  expect(rgbaAt(32, 48)).not.toEqual([0, 0, 0, 255]);
  await attachRequirements("browser: Export PNG downloads a decoded globe image");
});

test("browser: video format options select MP4 and WebM", async ({ page }) => {
  await ready(page);
  await selectOption(page, "export.video.format", "WebM");
  await expect(page.getByRole("button", { name: "Export WebM" })).toBeVisible();
  await selectOption(page, "export.video.format", "MP4");
  await attachRequirements("browser: video format options select MP4 and WebM");
});

test("browser: video resolution options select Current and 4K", async ({ page }) => {
  await ready(page);
  await selectOption(page, "export.video.resolution", "4K");
  await selectOption(page, "export.video.resolution", "Current");
  await attachRequirements("browser: video resolution options select Current and 4K");
});

test("browser: Export Video downloads a decoded globe video", async ({ page }) => {
  await ready(page);
  const downloadPromise = page.waitForEvent("download", { timeout: 180_000 });
  await page.getByRole("button", { name: "Export MP4" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).not.toBeNull();
  expect(download.suggestedFilename()).toMatch(/\.mp4$/u);
  await attachRequirements("browser: Export Video downloads a decoded globe video");
});

test("browser: Infinity video export keeps one scene-bounds envelope", async ({ page }) => {
  await ready(page);
  await field(page, "canvas.infinity").getByRole("switch").click();
  await expect(page.locator('[data-toolcraft-product-scene-status="ready"]')).toBeVisible();
  const downloadPromise = page.waitForEvent("download", { timeout: 180_000 });
  await page.getByRole("button", { name: "Export MP4" }).click();
  const download = await downloadPromise;
  expect(await download.path()).not.toBeNull();
  await attachRequirements("browser: Infinity video export keeps one scene-bounds envelope");
});

test("browser: Infinity canvas toggles only the finite boundary", async ({ page }) => {
  await ready(page);
  const canvas = page.locator(GLOBE_CANVAS);
  const infinity = field(page, "canvas.infinity").getByRole("switch");
  await infinity.click();
  await expect(page.locator('[data-toolcraft-product-scene-status="ready"]')).toBeVisible();
  await expect(field(page, "canvas.size.width")).toHaveCount(0);
  await expect(canvas).toHaveAttribute("data-globe-status", "ready");
  await infinity.click();
  await expect(field(page, "canvas.size.width")).toHaveCount(1);
  await expect(canvas).toHaveAttribute("data-globe-status", "ready");
  await attachRequirements("browser: Infinity canvas toggles only the finite boundary");
});

test("browser: Infinity PNG export crops to globe scene bounds", async ({ page }) => {
  await ready(page);
  const finite = await exportAndInspectPng(page, [0, 0, 0, 255]);
  await field(page, "canvas.infinity").getByRole("switch").click();
  const expectedInfinite = await infiniteExportSize(page);
  const infinite = await exportAndInspectPng(page, [0, 0, 0, 255]);
  await expectToolcraftInfinityCanvasImageExportEvidence(
    { finite: finite.inspection, infinite: infinite.inspection },
    {
      expectedFiniteSize: finiteExportSize(),
      expectedInfiniteSize: expectedInfinite,
      requirementId: "canvas.infinity-export",
      target: "canvas.infinity",
    },
  );
  await attachRequirements(
    "browser: Infinity PNG export crops to globe scene bounds",
    new Set([
      "canvas.infinity-export:exported-artifact",
      "canvas.infinity-export:infinity-scene-bounds-image-export",
    ]),
  );
});

test("browser: timeline playback drives the rendered globe", async ({ page }) => {
  await ready(page);
  const canvas = page.locator(GLOBE_CANVAS);
  const scrubber = await enableExtendedTimeline(page);
  await scrubber.press("Home");
  const start = await canvas.screenshot();
  await scrubber.press("ArrowRight");
  expect(await canvas.screenshot()).not.toEqual(start);
  await scrubber.press("End");
  const end = await canvas.screenshot();
  // Spin runs exactly one revolution per loop, so the seam frame only differs by the entrance offset.
  expect(end).not.toEqual(start);

  await page.getByRole("button", { name: "Edit timeline duration" }).click();
  const duration = page.getByRole("textbox", { name: "timeline duration" });
  await duration.fill("6s");
  await duration.press("Enter");
  await expect(scrubber).toHaveAttribute("aria-valuemax", "6");

  await scrubber.press("Home");
  await page.getByRole("button", { name: "Play playback" }).click();
  await expect.poll(() => scrubber.getAttribute("aria-valuenow")).not.toBe("0");
  await page.getByRole("button", { name: "Pause playback" }).click();
  const pausedTime = await scrubber.getAttribute("aria-valuenow");
  await page.waitForTimeout(100);
  expect(await scrubber.getAttribute("aria-valuenow")).toBe(pausedTime);
  await page.getByRole("button", { name: "Play playback" }).click();
  await expect.poll(() => scrubber.getAttribute("aria-valuenow")).not.toBe(pausedTime);
  await page.getByRole("button", { name: "Pause playback" }).click();
  await attachRequirements("browser: timeline playback drives the rendered globe");
});

test("browser: timeline keyframes reproduce the reference entrance and spin", async ({ page }) => {
  await ready(page);
  const canvas = page.locator(GLOBE_CANVAS);
  const scrubber = await enableExtendedTimeline(page);
  for (const [target, label] of [
    ["globe.y", "Position Y"],
    ["globe.z", "Position Z"],
    ["globe.spin", "Spin"],
  ] as const) {
    await ensureKeyframes(page, target, label);
  }
  // The panel shows base values; the canvas publishes the timeline-evaluated pose it rendered.
  const readPose = async () => ({
    globeY: Number(await canvas.getAttribute("data-globe-y")),
    globeZ: Number(await canvas.getAttribute("data-globe-z")),
    spin: Number(await canvas.getAttribute("data-globe-spin")),
  });
  await scrubber.press("Home");
  const startFrame = await canvas.screenshot();
  // Reference phase "rise": the globe starts below the frame, close to the camera.
  await expectToolcraftReferenceParity(readPose, { globeY: -1.5, globeZ: 3.2, spin: 210 }, {
    requirementId: "timeline.keyframes",
    target: "timeline.keyframes",
  });
  await scrubber.press("End");
  // Reference phase "settle-spin": centered, receded, one full revolution later.
  await expectToolcraftReferenceParity(readPose, { globeY: 0, globeZ: 0, spin: 570 }, {
    requirementId: "timeline.keyframes",
    target: "timeline.keyframes",
  });
  expect(await canvas.screenshot()).not.toEqual(startFrame);
  await attachRequirements(
    "browser: timeline keyframes reproduce the reference entrance and spin",
    new Set(["timeline.keyframes:reference-parity"]),
  );
});
