// Bakes the globe's PBR maps once on the CPU from real elevation data; the stone is fully procedural.
// Output: albedo (sRGB), packed surface (G = roughness, B = metalness), tangent-space normal, height.
import * as THREE from "three";

export interface GlobeBakeSources {
  readonly elevation: HTMLImageElement;
  /** Blue Marble color raster; its navy ocean is the authoritative water mask. */
  readonly landColor: HTMLImageElement;
  /** One non-repeating travertine slab photograph covering the whole map: color and relief. */
  readonly stone: HTMLImageElement;
}

export interface GlobeMaps {
  readonly albedo: THREE.DataTexture;
  readonly height: THREE.DataTexture;
  readonly normal: THREE.DataTexture;
  readonly surface: THREE.DataTexture;
  /** Baked height (0..1) at a sphere uv, matching what the displacement map applies. */
  sampleHeight(u: number, v: number): number;
  dispose(): void;
}

// Palette from the user's travertine-and-brass reference: warm porous beige stone, satin amber gold.
const GOLD = [0.95, 0.7, 0.3] as const;
const GOLD_SHADE = [0.5, 0.33, 0.1] as const;
const STONE = [1.0, 0.96, 0.86] as const;
// Continents sit on a plateau above the ocean; real relief rides on top of it.
const PLATEAU = 0.42;
const RELIEF = 0.58;

function readPixels(image: HTMLImageElement, width: number, height: number): Uint8ClampedArray {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas 2D is unavailable for globe baking.");
  context.drawImage(image, 0, 0, width, height);
  return context.getImageData(0, 0, width, height).data;
}

function texture(data: Uint8Array, width: number, height: number, srgb: boolean): THREE.DataTexture {
  const result = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
  result.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  result.wrapS = THREE.RepeatWrapping;
  result.wrapT = THREE.ClampToEdgeWrapping;
  result.minFilter = THREE.LinearMipmapLinearFilter;
  result.magFilter = THREE.LinearFilter;
  result.generateMipmaps = true;
  result.anisotropy = 8;
  result.flipY = true;
  result.needsUpdate = true;
  return result;
}

export function bakeGlobeMaps(sources: GlobeBakeSources, size: readonly [number, number]): GlobeMaps {
  const [width, height] = size;
  const count = width * height;
  const elevation = readPixels(sources.elevation, width, height);
  // Land mask from the Blue Marble water color (dark navy and cyan shallows are ocean), so
  // low-lying land such as the Amazon basin stays land even where elevation rounds to zero.
  const landColor = readPixels(sources.landColor, width, height);
  const land = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const r = landColor[i * 4]!;
    const g = landColor[i * 4 + 1]!;
    const b = landColor[i * 4 + 2]!;
    const ocean = b > r * 1.3 && b > g * 0.9 && r < 80;
    land[i] = ocean ? 0 : 1;
  }
  const softLand = blur(land, width, height, 2);

  // Stone relief comes from the slab photograph: its high-passed luminance is the height (pores and
  // cracks are dark, so they sink), with a little fine procedural grain so the surface never looks flat.
  const stonePixels = readPixels(sources.stone, width, height);
  const stoneLum = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    stoneLum[i] = (0.299 * stonePixels[i * 4]! + 0.587 * stonePixels[i * 4 + 1]! + 0.114 * stonePixels[i * 4 + 2]!) / 255;
  }
  // Two bands: broad trowel sweeps (wide high-pass) and fine sand grain / hairline ridges (narrow
  // high-pass, amplified), plus procedural speckle finer than the photo so the surface stays granular.
  const stoneLow = blur(stoneLum, width, height, 30);
  const stoneMid = blur(stoneLum, width, height, 3);
  const grainA = createValueNoise(1400, 700, 701);
  const grainB = createValueNoise(2800, 1400, 702);
  const speckle = createValueNoise(5600, 2800, 703);
  const OCEAN_BASE = 0.1;
  const stoneHeight = new Float32Array(count);
  const heightField = new Float32Array(count);
  for (let y = 0; y < height; y += 1) {
    const v = y / height;
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      const u = x / width;
      const e = elevation[i * 4]! / 255;
      const relief = Math.pow(e, 0.8) * RELIEF;
      const stone = 1 - softLand[i]!;
      // Trowel sweeps and sandy grain; dark specks are clamped so nothing reads as a hole.
      const sweeps = Math.max(-0.05, stoneMid[i]! - stoneLow[i]!);
      const fine = Math.max(-0.04, Math.min(0.04, stoneLum[i]! - stoneMid[i]!));
      const grain = (grainA(u, v) - 0.5) * 0.4 + (grainB(u, v) - 0.5) * 0.35 + (speckle(u, v) - 0.5) * 0.5;
      const crag = Math.min(1, Math.max(0, 0.5 + sweeps * 2.0 + fine * 5.0 + grain * 0.3));
      stoneHeight[i] = crag;
      // Stone relief spans about 0.14 height units against the continents' 0.42 plateau.
      heightField[i] = softLand[i]! * (PLATEAU + relief) + stone * (OCEAN_BASE + 0.13 * (crag - 0.5));
    }
  }

  const albedo = new Uint8Array(count * 4);
  const surface = new Uint8Array(count * 4);
  const normal = new Uint8Array(count * 4);
  const heightMap = new Uint8Array(count * 4);

  // The scan has a grain direction, so both placements keep its orientation; scale and offset differ.
  for (let y = 0; y < height; y += 1) {
    const v = y / height;
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      const u = x / width;
      const mask = softLand[i]!;
      const h = heightField[i]!;

      // Stone: the slab's own color, held down so a direct key lights it without clipping to white.
      const o4 = i * 4;
      const crevice = 0.88 + 0.12 * stoneHeight[i]!;
      const stoneShade = 0.92 * crevice;
      // Gold: darker in the valleys, bright on the ridges, so the relief reads through the metal.
      const ridge = Math.min(1, Math.max(0, (h - PLATEAU) / RELIEF));
      const goldMix = 0.35 + 0.65 * ridge;
      const o = i * 4;
      for (let c = 0; c < 3; c += 1) {
        const stone = (stonePixels[o4 + c]! / 255) * STONE[c]! * stoneShade;
        const gold = GOLD_SHADE[c]! + (GOLD[c]! - GOLD_SHADE[c]!) * goldMix;
        albedo[o + c] = Math.round(255 * Math.min(1, stone + (gold - stone) * mask));
      }
      albedo[o + 3] = 255;

      const roughness = (0.9 - 0.08 * stoneHeight[i]!) * (1 - mask) + (0.3 - 0.08 * ridge) * mask;
      surface[o] = 0;
      surface[o + 1] = Math.round(255 * roughness);
      surface[o + 2] = Math.round(255 * mask);
      surface[o + 3] = 255;

      heightMap[o] = heightMap[o + 1] = heightMap[o + 2] = Math.round(255 * h);
      heightMap[o + 3] = 255;

      // Normal from the height field: terrain on land, pores and micro bumps on the stone.
      const left = heightField[y * width + ((x - 1 + width) % width)]!;
      const right = heightField[y * width + ((x + 1) % width)]!;
      const up = heightField[Math.max(0, y - 1) * width + x]!;
      const down = heightField[Math.min(height - 1, y + 1) * width + x]!;
      const strength = 18;
      let nx = (left - right) * strength;
      let ny = (down - up) * strength;
      // Stone micro bumps are already in the height field; the slider scales them at render time.
      let nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      normal[o] = Math.round(255 * (nx * 0.5 + 0.5));
      normal[o + 1] = Math.round(255 * (ny * 0.5 + 0.5));
      normal[o + 2] = Math.round(255 * (nz * 0.5 + 0.5));
      normal[o + 3] = 255;
    }
  }

  const albedoTexture = texture(albedo, width, height, true);
  const surfaceTexture = texture(surface, width, height, false);
  const normalTexture = texture(normal, width, height, false);
  const heightTexture = texture(heightMap, width, height, false);
  return {
    albedo: albedoTexture,
    height: heightTexture,
    normal: normalTexture,
    surface: surfaceTexture,
    sampleHeight(u, v) {
      // Row 0 of the baked data is the north edge; the sphere's uv.y is 1 at the north pole.
      const x = Math.min(width - 1, Math.max(0, Math.round(((u % 1) + 1) % 1 * (width - 1))));
      const y = Math.min(height - 1, Math.max(0, Math.round((1 - v) * (height - 1))));
      return heightMap[(y * width + x) * 4]! / 255;
    },
    dispose() {
      albedoTexture.dispose();
      surfaceTexture.dispose();
      normalTexture.dispose();
      heightTexture.dispose();
    },
  };
}

// Smooth value noise on a random lattice that wraps in longitude; two octaves are enough to hide tiling.
function createValueNoise(cellsX: number, cellsY: number, seed: number): (u: number, v: number) => number {
  const lattice = new Float32Array(cellsX * cellsY);
  let state = seed >>> 0;
  for (let i = 0; i < lattice.length; i += 1) {
    state = (Math.imul(state ^ (state >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0;
    lattice[i] = (state & 0xffff) / 0xffff;
  }
  const at = (x: number, y: number) => lattice[Math.min(cellsY - 1, Math.max(0, y)) * cellsX + ((x % cellsX) + cellsX) % cellsX]!;
  return (u, v) => {
    const x = u * cellsX;
    const y = v * cellsY;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const sx = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
    const sy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
    const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
    return top + (bottom - top) * sy;
  };
}

// Separable box blur, wrapping in x (longitude) and clamping in y (latitude).
function blur(source: Float32Array, width: number, height: number, radius: number): Float32Array {
  const pass = new Float32Array(source.length);
  const result = new Float32Array(source.length);
  const span = radius * 2 + 1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let k = -radius; k <= radius; k += 1) sum += source[y * width + ((x + k + width) % width)]!;
      pass[y * width + x] = sum / span;
    }
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let k = -radius; k <= radius; k += 1) {
        const yy = Math.min(height - 1, Math.max(0, y + k));
        sum += pass[yy * width + x]!;
      }
      result[y * width + x] = sum / span;
    }
  }
  return result;
}
