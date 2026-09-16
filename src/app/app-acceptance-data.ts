import type {
  ToolcraftComponentAcceptance,
  ToolcraftControlSectionInventoryEntry,
  ToolcraftMotionReferenceInput,
  ToolcraftProductReadiness,
  ToolcraftTransferMode,
} from "./acceptance/types";
import { appSchema, GLOBE_LOOP_SECONDS } from "./app-schema";
import referenceEvidence from "./reference-studies/motion-v1-c079eb47f7c348acf71e8013d21f8e79f6b1faef775151d2b781d7353a4a2abb/evidence.json" with { type: "json" };

const persistenceSlices =
  appSchema.persistence.storage === "localStorage"
    ? appSchema.persistence.include
    : [];

const GLOBE_SPEC = "e2e/app-controls.spec.ts" as const;

const REFERENCE_ID =
  "motion-reference-v1-c079eb47f7c348acf71e8013d21f8e79f6b1faef775151d2b781d7353a4a2abb" as const;
const STUDY_ID = referenceEvidence.studyId;

// The supplied clip: a stone-and-gold globe rises into frame from below, recedes to center,
// then keeps a slow spin under one fixed upper-left key light on black.
const goldGlobeReference: ToolcraftMotionReferenceInput = {
  behaviors: [
    {
      acceptanceId: "timeline.keyframes",
      description:
        "The globe enters from below the frame, close to the camera, and eases back to a centered, smaller framing.",
      id: "globe-enters-frame",
      implementationIntent:
        "Keyframe the globe's Position Y and Position Z on the timeline; camera and light stay put.",
      timingClaims: [{ claim: "duration", studyId: STUDY_ID }],
    },
    {
      acceptanceId: "timeline.keyframes",
      description:
        "The globe rotates slowly around its own axis for the whole clip while the key light stays fixed relative to the camera.",
      id: "globe-spins-on-axis",
      implementationIntent:
        "Keyframe Spin on the timeline; light direction is camera-relative so illumination stays put while the globe turns.",
      timingClaims: [{ claim: "speed", studyId: STUDY_ID }],
    },
  ],
  kind: "motion-reference",
  referenceId: REFERENCE_ID,
  studies: [
    {
      events: [
        {
          behaviorIds: ["globe-enters-frame"],
          classification: "product-behavior",
          evidenceEventId: "motion-event:change:7-8-9",
          id: "rise-accelerates",
        },
        {
          behaviorIds: ["globe-enters-frame"],
          classification: "product-behavior",
          evidenceEventId: "motion-event:change:24-25-26",
          id: "recede-begins",
        },
        {
          behaviorIds: ["globe-spins-on-axis"],
          classification: "product-behavior",
          evidenceEventId: "motion-event:change:48-49-50",
          id: "settle-into-spin",
        },
        {
          behaviorIds: [],
          classification: "edit-boundary",
          evidenceEventId: "motion-event:loop-seam:72-0-1",
          id: "clip-cut",
          reason:
            "The clip is a cut, not a loop: the last frame is a centered globe and the first frame is a globe below the frame.",
        },
      ],
      evidence: referenceEvidence as ToolcraftMotionReferenceInput["studies"][number]["evidence"],
      evidencePath:
        "src/app/reference-studies/motion-v1-c079eb47f7c348acf71e8013d21f8e79f6b1faef775151d2b781d7353a4a2abb/evidence.json",
      phases: [
        {
          behaviorIds: ["globe-enters-frame", "globe-spins-on-axis"],
          fromFrameId: "source-frame:0",
          id: "rise",
          toFrameId: "source-frame:26",
          visualState:
            "Only the upper half of a large globe is visible at the bottom of a black frame; it rises while spinning, lit from the upper left with a hard terminator.",
        },
        {
          behaviorIds: ["globe-enters-frame", "globe-spins-on-axis"],
          fromFrameId: "source-frame:28",
          id: "recede",
          toFrameId: "source-frame:46",
          visualState:
            "The whole globe is in frame and shrinks toward the center as the camera pulls back; the Americas rotate toward the left limb.",
        },
        {
          behaviorIds: ["globe-spins-on-axis"],
          fromFrameId: "source-frame:48",
          id: "settle-spin",
          toFrameId: "source-frame:72",
          visualState:
            "A centered globe about half the frame height keeps a slow spin; Africa and Europe turn into the light while the right limb falls into shadow.",
        },
      ],
      studyId: STUDY_ID,
    },
  ],
};

export const appTransferMode: ToolcraftTransferMode = {
  animationIntent: {
    loopDuration: {
      evidence:
        "Product-derived: one full keyframed revolution of the globe reads clearly at 12 s; the 3 s reference clip is a cut of that motion, not a loop.",
      seconds: GLOBE_LOOP_SECONDS,
      source: "product-derived",
    },
    mode: "timeline-keyframes",
  },
  mode: "new-toolcraft-app",
  referenceInputs: [goldGlobeReference],
};

export const appProductReadiness: ToolcraftProductReadiness = {
  exportIntent: {
    image: { mode: "toolcraft-default" },
    svg: { mode: "not-requested" },
    video: {
      evidence: {
        messageRef:
          "~/.claude/projects/-Users-fabiogiolito-Sites-design-builder/6b6f6584-08e0-444a-8bcd-c33878a32b06.jsonl#user-message:video-export",
        messageText:
          "Add options to export video, but take into account the playback performance can be slow on some computers, is there a way to mitigat that?",
        quote: "Add options to export video",
        source: "user-message",
      },
      mode: "user-requested",
    },
  },
  interactionOwnership: [
    {
      alternative: {
        reason:
          "A canvas orbit drag would duplicate the keyframeable camera sliders and bypass the timeline.",
        surface: "canvas",
      },
      capability: "property-edit",
      evidence: {
        detail:
          "User asked for a globe that can be programmatically controlled into view and animated through the timeline.",
        source: "user-request",
      },
      id: "camera-yaw-panel",
      reason: "Panel sliders give exact keyframeable values for the camera pose.",
      selectionScope: { mode: "global" },
      surface: "panel",
      target: "camera.yaw",
    },
    {
      alternative: {
        reason:
          "A canvas orbit drag would duplicate the keyframeable camera sliders and bypass the timeline.",
        surface: "canvas",
      },
      capability: "property-edit",
      evidence: {
        detail:
          "User asked for a globe that can be programmatically controlled into view and animated through the timeline.",
        source: "user-request",
      },
      id: "camera-pitch-panel",
      reason: "Panel sliders give exact keyframeable values for the camera pose.",
      selectionScope: { mode: "global" },
      surface: "panel",
      target: "camera.pitch",
    },
    {
      alternative: {
        reason:
          "A canvas drag on the globe would conflict with the keyframed spin track.",
        surface: "canvas",
      },
      capability: "property-edit",
      evidence: {
        detail:
          "User asked for the rotation around the globe axis to be controllable so it can be animated.",
        source: "user-request",
      },
      id: "globe-spin-panel",
      reason: "The panel slider gives an exact keyframeable spin angle.",
      selectionScope: { mode: "global" },
      surface: "panel",
      target: "globe.spin",
    },
    {
      alternative: {
        reason:
          "A light handle on the canvas would be a second editor for the same direction value.",
        surface: "canvas",
      },
      capability: "property-edit",
      evidence: {
        detail:
          "User asked for correct, controllable illumination that stays consistent while the camera animates.",
        source: "user-request",
      },
      id: "light-x-panel",
      reason: "Panel sliders give exact keyframeable light position values.",
      selectionScope: { mode: "global" },
      surface: "panel",
      target: "light.x",
    },
    {
      alternative: {
        reason:
          "A light handle on the canvas would be a second editor for the same direction value.",
        surface: "canvas",
      },
      capability: "property-edit",
      evidence: {
        detail:
          "User asked for correct, controllable illumination that stays consistent while the camera animates.",
        source: "user-request",
      },
      id: "light-y-panel",
      reason: "Panel sliders give exact keyframeable light position values.",
      selectionScope: { mode: "global" },
      surface: "panel",
      target: "light.y",
    },
  ],
  mode: "product",
  productName: "Gold Globe",
  productSummary:
    "A Three.js globe with real terrain relief, pitted stone oceans and cast-gold continents under one key light, framed and animated through keyframeable sliders.",
  requestedBehavior:
    "Control globe spin, camera framing, and light direction with panel sliders, keyframe them on the timeline, and export a PNG.",
  viewInteraction: {
    authority: {
      kind: "explicit-user-request",
      requestQuote:
        "bring everything together into a globe that can be programatically controlled into view, with the correct illumination, the rotation around itself should also be controllable so it can be animated",
    },
    mode: "timeline-camera",
  },
};

function sliderRow(
  target: string,
  label: string,
  observable: string,
  interactionId?: string,
): ToolcraftComponentAcceptance {
  return {
    automated: true,
    automatedTestName: `${target} drives the globe frame`,
    browser: {
      budget: "standard",
      file: GLOBE_SPEC,
      testName: `browser: ${label} slider changes the rendered globe`,
    },
    componentType: "slider",
    evidence: "rendered-pixels",
    expectedObservable: observable,
    fixture: "default globe frame",
    id: target,
    ...(interactionId ? { interactionId } : {}),
    kind: "control",
    target,
    timelineCoverage: "keyframes",
    userAction: `Drag the ${label} slider and observe the canvas during the drag.`,
  };
}

export const appAcceptance: readonly ToolcraftComponentAcceptance[] = [
  sliderRow("globe.spin", "Spin", "Continents rotate around the globe axis.", "globe-spin-panel"),
  sliderRow("globe.relief", "Relief", "Coastline and gold-ripple shading deepens or flattens."),
  sliderRow("globe.x", "Globe position X", "The globe moves sideways through the light and the frame."),
  sliderRow("globe.y", "Globe position Y", "The globe moves up or down through the light and the frame."),
  sliderRow("globe.z", "Globe position Z", "The globe moves toward or away from the camera and in or out of the beam."),
  sliderRow("globe.shine", "Shine", "Gold goes from matte cast metal to mirror polish."),
  sliderRow("material.gold", "Gold", "Continents shift from silver to deep saturated gold."),
  sliderRow("material.stoneRoughness", "Stone roughness", "Ocean stone goes from smooth plaster to coarse pitted rock."),
  {
    automated: true,
    automatedTestName: "stone finish selects the spread photograph",
    browser: {
      budget: "standard",
      file: GLOBE_SPEC,
      testName: "browser: Stone finish switches between smooth and rough spread",
    },
    componentType: "select",
    evidence: "rendered-pixels",
    expectedObservable:
      "Rough spread re-bakes the ocean with short choppy trowel strokes; Smooth spread restores the long sweeps.",
    fixture: "default globe frame",
    id: "material.stoneFinish",
    kind: "control",
    optionCoverage: ["smooth", "rough"],
    target: "material.stoneFinish",
    userAction: "Select Rough spread, then Smooth spread, and watch the ocean stone.",
  },
  sliderRow("camera.x", "Camera position X", "The viewpoint moves sideways."),
  sliderRow("camera.y", "Camera position Y", "The viewpoint moves up or down."),
  sliderRow("camera.z", "Camera position Z", "The viewpoint moves closer or farther."),
  sliderRow("camera.yaw", "Camera yaw", "The camera turns left or right.", "camera-yaw-panel"),
  sliderRow("camera.pitch", "Camera pitch", "The camera tilts up or down.", "camera-pitch-panel"),
  sliderRow("camera.focusDistance", "Focus distance", "The plane of sharp focus moves nearer or farther; the globe softens away from it."),
  sliderRow("camera.focusBlur", "Focus blur", "Out-of-focus areas blur more or less."),
  sliderRow("light.x", "Light position X", "The key light moves sideways and the terminator follows.", "light-x-panel"),
  sliderRow("light.y", "Light position Y", "The key light moves up or down and the lit hemisphere tilts.", "light-y-panel"),
  sliderRow("light.z", "Light position Z", "The key light moves in front of or behind the globe."),
  sliderRow("light.intensity", "Intensity", "Gold highlights brighten or dim."),
  sliderRow("light.beamAngle", "Beam width", "The lit region widens or narrows to a tight cone."),
  sliderRow("light.beamSoftness", "Beam softness", "The beam edge goes from hard to feathered."),
  sliderRow("light.edgeFalloff", "Edge falloff", "The limb of the globe darkens as it curves away from the camera."),
  sliderRow("grade.temperature", "Temperature", "The whole frame shifts cool or warm."),
  sliderRow("grade.tint", "Tint", "The whole frame shifts green or magenta."),
  sliderRow("transactions.show", "Transactions show", "Transaction beams appear or vanish; keyframe it as a trigger."),
  sliderRow("transactions.intensity", "Transactions intensity", "Beams and their reflected light brighten or dim."),
  sliderRow("transactions.shimmer", "Transactions shimmer", "The pulse travelling along each beam strengthens or flattens."),
  {
    automated: true,
    automatedTestName: "background inclusion controls preview and PNG alpha",
    backgroundOutputCoverage: [
      "preview-hidden-when-excluded",
      "image-transparent-when-excluded",
      "infinity-viewport-color-and-dependency",
      "video-background-preserved",
    ],
    browser: {
      budget: "standard",
      file: GLOBE_SPEC,
      testName: "browser: Background switch controls preview and PNG alpha",
    },
    componentType: "switch",
    evidence: "rendered-pixels",
    expectedObservable:
      "Background off removes the finite preview base, makes PNG corners transparent, disables Infinity canvas, and video keeps the background.",
    fixture: "default globe frame",
    id: "export.includeBackground",
    kind: "control",
    target: "export.includeBackground",
    userAction: "Toggle Background and compare preview, Infinity availability, and PNG alpha.",
  },
  {
    automated: true,
    automatedTestName: "background color reaches the export corners",
    browser: {
      budget: "extended-io",
      file: GLOBE_SPEC,
      testName: "browser: Background color reaches exported PNG corners",
    },
    componentType: "color",
    evidence: "exported-bytes",
    expectedObservable: "The selected background color appears at the export corners.",
    fixture: "default globe frame",
    id: "scene.background",
    kind: "control",
    target: "scene.background",
    timelineCoverage: "keyframes",
    userAction: "Change Background color, export PNG, and inspect decoded corners.",
  },
  {
    automated: true,
    automatedTestName: "image format options remain selectable",
    browser: {
      budget: "standard",
      file: GLOBE_SPEC,
      testName: "browser: image format options select PNG and JPG",
    },
    componentType: "select",
    evidence: "product-output",
    expectedObservable: "PNG and JPG are selectable and the export button label follows.",
    fixture: "default globe frame",
    id: "export.image.format",
    kind: "control",
    optionCoverage: ["png", "jpg"],
    target: "export.image.format",
    userAction: "Select PNG and JPG.",
  },
  {
    automated: true,
    automatedTestName: "image resolution options remain selectable",
    browser: {
      budget: "standard",
      file: GLOBE_SPEC,
      testName: "browser: image resolution options select 2K, 4K, and 8K",
    },
    componentType: "select",
    evidence: "product-output",
    expectedObservable: "2K, 4K, and 8K are selectable.",
    fixture: "default globe frame",
    id: "export.image.resolution",
    kind: "control",
    optionCoverage: ["2k", "4k", "8k"],
    target: "export.image.resolution",
    userAction: "Select 2K, 4K, and 8K.",
  },
  {
    actionCoverage: ["export.png", "export.video"],
    automated: true,
    automatedTestName: "PNG export renders the globe frame",
    browser: {
      budget: "extended-io",
      file: GLOBE_SPEC,
      testName: "browser: Export PNG downloads a decoded globe image",
    },
    componentType: "panelActions",
    evidence: "exported-bytes",
    exportArtifactCoverage: "all-required-image-export-behavior",
    expectedObservable:
      "PNG/JPG export at each resolution decodes to the expected dimensions with gold continent pixels.",
    fixture: "default globe frame",
    id: "export.image",
    kind: "control",
    target: "actions.output",
    userAction: "Select each format and resolution and click the export button.",
  },
  {
    automated: true,
    automatedTestName: "video format options remain selectable",
    browser: {
      budget: "standard",
      file: GLOBE_SPEC,
      testName: "browser: video format options select MP4 and WebM",
    },
    componentType: "select",
    evidence: "product-output",
    expectedObservable: "MP4 and WebM are selectable and the export button label follows.",
    fixture: "default globe frame",
    id: "export.video.format",
    kind: "control",
    optionCoverage: ["mp4", "webm"],
    target: "export.video.format",
    userAction: "Select MP4 and WebM.",
  },
  {
    automated: true,
    automatedTestName: "video resolution options remain selectable",
    browser: {
      budget: "standard",
      file: GLOBE_SPEC,
      testName: "browser: video resolution options select Current and 4K",
    },
    componentType: "select",
    evidence: "product-output",
    expectedObservable: "Current and 4K are selectable.",
    fixture: "default globe frame",
    id: "export.video.resolution",
    kind: "control",
    optionCoverage: ["current", "4k"],
    target: "export.video.resolution",
    userAction: "Select Current and 4K.",
  },
  {
    actionCoverage: ["export.png", "export.video"],
    automated: true,
    automatedTestName: "video export renders every timeline frame offline",
    browser: {
      budget: "extended-io",
      file: GLOBE_SPEC,
      testName: "browser: Export Video downloads a decoded globe video",
    },
    componentType: "panelActions",
    evidence: "exported-bytes",
    exportArtifactCoverage: "all-required-video-export-behavior",
    expectedObservable:
      "MP4/WebM export at Current and 4K decodes to the expected dimensions, 30 FPS cadence, loop duration, kept background, and changing globe pixels, independent of live playback speed.",
    fixture: "default globe frame",
    id: "export.video",
    kind: "control",
    target: "actions.output",
    userAction: "Select each format and resolution and click Export Video.",
  },
  {
    automated: true,
    automatedTestName: "Infinity canvas keeps the globe frame continuous",
    browser: {
      budget: "standard",
      file: GLOBE_SPEC,
      testName: "browser: Infinity canvas toggles only the finite boundary",
    },
    componentType: "canvas",
    evidence: "viewport-side-effect",
    expectedObservable:
      "Infinity on/off changes only the artboard boundary and size controls; the globe rect, renderer identity, and backing stay continuous.",
    fixture: "default globe frame",
    id: "canvas.infinity-mode",
    infinityCanvasCoverage: "mode-continuity-and-restoration",
    kind: "runtime",
    target: "canvas.infinity",
    userAction: "Toggle Infinity canvas both directions.",
  },
  {
    automated: true,
    automatedTestName: "Infinity export crops to the globe scene bounds",
    browser: {
      budget: "extended-io",
      file: GLOBE_SPEC,
      testName: "browser: Infinity PNG export crops to globe scene bounds",
    },
    componentType: "canvas",
    evidence: "exported-bytes",
    expectedObservable:
      "Infinite PNG export dimensions equal the sceneBoundsProvider rect, not the dormant finite size.",
    fixture: "default globe frame",
    id: "canvas.infinity-export",
    infinityCanvasCoverage: "scene-bounds-image-export",
    kind: "runtime",
    target: "canvas.infinity",
    userAction: "Enable Infinity canvas, export PNG, compare decoded dimensions with provider bounds.",
  },
  {
    automated: true,
    automatedTestName: "Infinity video export uses one scene-bounds envelope",
    browser: {
      budget: "extended-io",
      file: GLOBE_SPEC,
      testName: "browser: Infinity video export keeps one scene-bounds envelope",
    },
    componentType: "canvas",
    evidence: "exported-bytes",
    expectedObservable:
      "Infinite video export sizes every frame from one time-range union of the sceneBoundsProvider rect.",
    fixture: "default globe frame",
    id: "canvas.infinity-video-export",
    infinityCanvasCoverage: "scene-bounds-video-export",
    kind: "runtime",
    target: "canvas.infinity",
    userAction: "Enable Infinity canvas, export video, compare decoded dimensions with the provider bounds envelope.",
  },
  {
    automated: true,
    automatedTestName: "timeline playback drives the globe frame",
    browser: {
      budget: "standard",
      file: GLOBE_SPEC,
      testName: "browser: timeline playback drives the rendered globe",
    },
    componentType: "timeline",
    evidence: "timeline-output",
    expectedObservable:
      "Pause, scrub, duration edit, and forward loop all map timeline time to the rendered spin frame.",
    fixture: "spin keyframes at 0° and 360°",
    id: "timeline.playback",
    kind: "runtime",
    target: "timeline.playback",
    timelineCoverage: "playback",
    timelineLoopProof: {
      direction: "forward-only",
      durationChange: "reproved-after-edit",
      reversePlayback: "forbidden",
      seam: "first-last-match",
    },
    timelinePlaybackCoverage: ["pause-resume", "scrub", "duration", "loop", "rendered-frame"],
    userAction: "Play, pause, scrub, edit duration, and let the loop wrap.",
  },
  {
    automated: true,
    automatedTestName: "timeline keyframes reproduce the reference entrance and spin",
    browser: {
      budget: "standard",
      file: GLOBE_SPEC,
      testName: "browser: timeline keyframes reproduce the reference entrance and spin",
    },
    componentType: "timeline",
    evidence: "timeline-output",
    expectedObservable:
      "Keyframing the globe's Position Y, Position Z, and Spin reproduces the reference rise-recede-spin sequence: scrubbing evaluates the globe low and close at the start, centered and back in the light at the end, and rotated between.",
    fixture: "reference entrance keyframes",
    id: "timeline.keyframes",
    kind: "runtime",
    motionReferenceCoverage: [
      { behaviorId: "globe-enters-frame", referenceId: REFERENCE_ID },
      { behaviorId: "globe-spins-on-axis", referenceId: REFERENCE_ID },
    ],
    target: "timeline.keyframes",
    timelineCoverage: "keyframes",
    userAction:
      "Create Position Y, Position Z, and Spin keyframes matching the reference phases, then scrub through them.",
  },
  {
    automated: true,
    automatedTestName: "declares production reload coverage for the globe schema",
    browser: {
      budget: "extended-io",
      file: "e2e/app-persistence.spec.ts",
      testName: "browser: app restores exact canvas, values, and panel workspace slices after reload",
    },
    componentType: "persistence",
    evidence: "persistence-state",
    expectedObservable:
      "Canvas size and zoom, control values, timeline, and the moved/collapsed Controls panel are restored after reload.",
    fixture: "globe persisted workspace",
    id: "persistence.reload",
    kind: "runtime",
    persistenceCoverage: "reload",
    persistenceSlices,
    target: "canvas.size.width",
    userAction: "Edit Canvas width and zoom, move and collapse Controls, wait for persistence, reload.",
  },
];

export const appControlSectionInventory: readonly ToolcraftControlSectionInventoryEntry[] = [
  {
    entity: "Globe",
    entityId: "globe",
    finiteSelectors: [],
    groupingReason: "Spin, relief, and the globe's world position share one reset scope.",
    id: "globe",
    targets: ["globe.spin", "globe.relief", "globe.x", "globe.y", "globe.z"],
    title: "Globe",
  },
  {
    entity: "Material",
    entityId: "material",
    finiteSelectors: [
      {
        reason: "Stone finish changes only which photograph the stone maps are baked from.",
        role: "parameter",
        target: "material.stoneFinish",
      },
    ],
    groupingReason: "Shine, gold saturation, stone roughness, and stone finish define the two surface materials.",
    id: "material",
    targets: ["globe.shine", "material.gold", "material.stoneRoughness", "material.stoneFinish"],
    title: "Material",
  },
  {
    entity: "Camera",
    entityId: "camera",
    finiteSelectors: [],
    groupingReason: "World position, orientation, and depth of field define one camera.",
    id: "camera",
    targets: ["camera.x", "camera.y", "camera.z", "camera.yaw", "camera.pitch", "camera.focusDistance", "camera.focusBlur"],
    title: "Camera",
  },
  {
    entity: "Light",
    entityId: "light",
    finiteSelectors: [],
    groupingReason: "World position, intensity, beam shape, and edge falloff define the single key light.",
    id: "light",
    targets: ["light.x", "light.y", "light.z", "light.intensity", "light.beamAngle", "light.beamSoftness", "light.edgeFalloff"],
    title: "Light",
  },
  {
    entity: "Transactions",
    entityId: "transactions",
    finiteSelectors: [
      {
        reason: "Show is an on/off gate for starting transactions; it changes only its own outcome.",
        role: "parameter",
        target: "transactions.show",
      },
    ],
    groupingReason: "Show, intensity, and shimmer define how the transaction beams render.",
    id: "transactions",
    targets: ["transactions.show", "transactions.intensity", "transactions.shimmer"],
    title: "Transactions",
  },
  {
    entity: "Image grade",
    entityId: "grade",
    finiteSelectors: [],
    groupingReason: "Temperature and tint are the two white-balance controls on the final image.",
    id: "grade",
    targets: ["grade.temperature", "grade.tint"],
    title: "Grade",
  },
  {
    entity: "Output background",
    entityId: "output-background",
    finiteSelectors: [
      {
        affectedTargets: ["scene.background"],
        reason: "Background inclusion determines whether its color affects output.",
        role: "branch",
        target: "export.includeBackground",
      },
    ],
    groupingReason: "Inclusion and color jointly define the preview and exported background.",
    id: "background",
    targets: ["export.includeBackground", "scene.background"],
    title: "Background",
  },
  {
    entity: "Image delivery",
    entityId: "image-delivery",
    finiteSelectors: [
      {
        reason: "Format changes only its own artifact encoding.",
        role: "parameter",
        target: "export.image.format",
      },
      {
        reason: "Resolution changes only its own artifact dimensions.",
        role: "parameter",
        target: "export.image.resolution",
      },
    ],
    groupingReason: "Format and resolution configure the exported globe image.",
    id: "runtime.image-export",
    targets: ["export.image.format", "export.image.resolution"],
    title: "Image Export",
  },
  {
    entity: "Video delivery",
    entityId: "video-delivery",
    finiteSelectors: [
      {
        reason: "Format changes only its own container and codec.",
        role: "parameter",
        target: "export.video.format",
      },
      {
        reason: "Resolution changes only its own artifact dimensions.",
        role: "parameter",
        target: "export.video.resolution",
      },
    ],
    groupingReason: "Format and resolution configure the exported globe video.",
    id: "runtime.video-export",
    targets: ["export.video.format", "export.video.resolution"],
    title: "Video Export",
  },
];
