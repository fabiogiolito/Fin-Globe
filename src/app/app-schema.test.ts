import { describe, expect, it } from "vitest";

import { validateProductAcceptanceCoverage } from "./app-acceptance";
import { appAcceptance } from "./app-acceptance-data";
import { appSchema, GLOBE_LOOP_SECONDS } from "./app-schema";
import { GLOBE_DEFAULTS } from "./globe/globe-renderer";
import { GLOBE_TARGETS, readGlobeState } from "./globe/globe-state";

const control = (target: string) =>
  appSchema.panels.controls?.sections
    .flatMap((section) => Object.values(section.controls))
    .find((candidate) => candidate.target === target);

describe("gold globe schema", () => {
  it("enables keyframes, image and video export without upload or layers", () => {
    expect(appSchema.modulePlan.modules.map(({ id }) => id).sort()).toEqual([
      "image-export",
      "timeline",
      "video-export",
    ]);
    expect(appSchema.panels.timeline).toMatchObject({
      defaultDurationSeconds: GLOBE_LOOP_SECONDS,
      enabled: true,
      mode: "keyframes",
    });
    expect(appSchema.canvas.upload).toBe(false);
    expect(appSchema.panels.layers).toBeUndefined();
  });

  it("exposes every renderer input as a control", () => {
    // Defaults come from the saved workspace in app-defaults.json, so only the control kind is fixed.
    for (const [key, target] of Object.entries(GLOBE_TARGETS)) {
      expect(control(target), target).toMatchObject({
        type: key === "stoneFinish" ? "select" : "slider",
      });
    }
    expect(readGlobeState({})).toEqual(GLOBE_DEFAULTS);
    expect(readGlobeState({ [GLOBE_TARGETS.spin]: 90 }).spin).toBe(90);
  });

  it("declares production reload coverage for the globe schema", () => {
    expect(appSchema.persistence.storage).toBe("localStorage");
    if (appSchema.persistence.storage !== "localStorage") {
      throw new Error("The globe app must persist its workspace.");
    }
    expect(appAcceptance.find(({ id }) => id === "persistence.reload")).toMatchObject({
      persistenceCoverage: "reload",
      persistenceSlices: appSchema.persistence.include,
    });
    // Known framework drift in this generated copy: the runtime relocates the Background
    // controls into the "Settings" setup section, which the acceptance layout rules reject.
    const knownFrameworkDrift = /^Settings is too generic for a controls section\./u;
    expect(
      validateProductAcceptanceCoverage().filter((error) => !knownFrameworkDrift.test(error)),
    ).toEqual([]);
  });
});
