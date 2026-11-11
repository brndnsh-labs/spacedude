/**
 * The CRT filter: an optional picture-tube look for the whole stage.
 *
 * `stage` is the element that holds the game canvas and the HUD and terminal drawn over it in the DOM;
 * `source` is the game canvas, redrawn by the game every frame before `present` is called.
 *
 * Switched on, it adds two things to the stage and takes them away again when switched off:
 *
 * - `canvas.crt-screen`, laid exactly over the game canvas and under the DOM layers. Each frame the game canvas
 *   is uploaded as a texture and drawn through the shaders in shaders.ts at the display's own resolution:
 *   beam scanlines, an aperture-grille mask and a glow, all in linear light.
 * - `div.crt-glass`, over everything, which the pointer passes through. The HUD and terminal are DOM, so no
 *   shader can reach them; the glass gives them the same faint scanlines, plus the vignette, a reflection and
 *   the tube's rounded corners for the whole picture. The shader knows about the glass's scanlines and
 *   brightens under them, so the game picture is not darkened twice.
 *
 * If WebGL2 is missing, or the context is lost, the screen canvas steps aside and the glass alone remains over
 * the plain game canvas, until the context comes back.
 */
import './crt.css';
import { GLOW_ACROSS_FRAG, GLOW_DOWN_FRAG, ROWS_FRAG, TUBE_FRAG, VERT } from './shaders';

/* ---------- tunables: the look ---------- */

/** Scanline strength, 0..1. 0 is no lines at all; 1 is the full beam profile set by BEAM_DARK and BEAM_BRIGHT. */
const SCANLINES = 1;
/** Beam thickness for dark colours (gaussian sigma, in source rows). Smaller is thinner lines and wider gaps. */
const BEAM_DARK = 0.25;
/** Beam thickness for a gun at full drive, in the same units. Near 0.4 the lines of bright areas all but merge. */
const BEAM_BRIGHT = 0.38;
/**
 * Beam shape at full drive: 2 is a gaussian, higher is flatter on top with steeper sides. A fat gaussian spills
 * into the rows above and below and eats one-pixel dark outlines; a flat-topped beam fills its own row instead.
 */
const BEAM_SHAPE = 6;
/** Mask strength, 0..1: how deeply the red, green and blue grille stripes cut. 0 is no mask. */
const MASK = 0.3;
/** Source pixels per red-green-blue triad of the mask. 1 is a television; 0.5 is a finer monitor tube. */
const MASK_PITCH = 1;
/** Bloom: how much of the highlights' light spreads into a soft glow around them. 0 is none. */
const BLOOM = 0.22;
/** How far the glow spreads (gaussian sigma, in source pixels; up to about 4). */
const BLOOM_RADIUS = 3;
/** How much of an ordinary, not-bright colour's light joins the glow. Raise for a hazier, mistier tube. */
const BLOOM_HAZE = 0.04;
/** Linear-light levels where a colour starts to count as a highlight for the glow, and where it fully does. */
const BLOOM_KNEE: readonly [number, number] = [0.3, 0.95];
/** Softness of vertical edges (gaussian sigma, in source pixels). 0.25 is razor sharp, 0.5 is a worn cable. */
const SOFTNESS = 0.3;
/**
 * Where the horizontal softening is done: 1 blends the encoded video signal (edges soften evenly, but dither
 * patterns darken), 2.2 blends light (dither keeps its level, but bright pixels eat thin dark outlines).
 */
const SOFTNESS_SPACE = 1.6;
/**
 * Curvature: how far the picture's corners are pulled in by the tube's bulge, as a fraction of the picture.
 * 0 is a flat tube. Keep it under about 0.03: curved scanlines no longer sit on whole rows of display pixels,
 * and the HUD and terminal cannot bend with the picture.
 */
const CURVATURE: number = 0;
/** Vignette: how dark the corners of the glass get, 0..1. Applies to the game, the HUD and the terminal alike. */
const VIGNETTE = 0.22;
/** Strength of the faint scanlines the glass lays over the HUD and terminal text, 0..1. */
const GLASS_LINES = 0.12;
/** Brightness of the reflection across the top left of the glass, 0..1. */
const GLASS_SHEEN = 0.025;
/** Radius of the tube's rounded corners, as a percentage of the stage width. 0 is square. */
const CORNER = 2;
/** Overall brightness. The filter keeps the picture's light on its own; nudge this only to taste. */
const GAIN = 1;

/* ---------- the contract main.ts relies on ---------- */

export interface Crt {
  /** Turn the filter on or off. Off must leave the game looking exactly as it does without this module. */
  setEnabled(on: boolean): void;
  /** Called once per frame after the game has drawn `source`. `time` is in seconds. */
  present(time: number): void;
}

/* ---------- WebGL plumbing ---------- */

interface Gpu {
  gl: WebGL2RenderingContext;
  rows: WebGLProgram;
  glowAcross: WebGLProgram;
  glowDown: WebGLProgram;
  tube: WebGLProgram;
  /** Pass 1's target: output width by source height. Made again whenever the output width changes. */
  rowsTex: WebGLTexture | null;
  rowsFbo: WebGLFramebuffer;
  glowFboA: WebGLFramebuffer;
  glowFboB: WebGLFramebuffer;
  maxSize: number;
}

// Texture units, bound once and left alone: the game canvas, pass 1's rows, and the glow's two steps.
const UNIT_SRC = 0, UNIT_ROWS = 1, UNIT_GLOW_A = 2, UNIT_GLOW_B = 3;

function program(gl: WebGL2RenderingContext, frag: string): WebGLProgram {
  const make = (type: number, text: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, text);
    gl.compileShader(s);
    return s;
  };
  const p = gl.createProgram()!;
  const vs = make(gl.VERTEX_SHADER, VERT), fs = make(gl.FRAGMENT_SHADER, frag);
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.bindAttribLocation(p, 0, 'a_pos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) {
    throw new Error(`CRT shader: ${gl.getProgramInfoLog(p)}\n${gl.getShaderInfoLog(vs)}\n${gl.getShaderInfoLog(fs)}`);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return p;
}

/**
 * A texture, left bound to its unit. Two formats are used: RGBA8 for the game canvas as it comes, and
 * SRGB8_ALPHA8 for everything the passes write, which holds linear light at 8 bits without banding in the darks
 * because the GPU decodes it on every read and encodes it on every write.
 */
function texture(gl: WebGL2RenderingContext, unit: number, format: number, w: number, h: number, filter: number): WebGLTexture {
  const t = gl.createTexture()!;
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texStorage2D(gl.TEXTURE_2D, 1, format, w, h);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

function target(gl: WebGL2RenderingContext, tex: WebGLTexture | null): WebGLFramebuffer {
  const f = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, f);
  if (tex) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  return f;
}

/** Everything that lives in the context and does not depend on the output size. Throws if the GPU cannot do it. */
function buildGpu(gl: WebGL2RenderingContext, srcW: number, srcH: number): Gpu {
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);
  // The game canvas goes up as it is: no flip (the shaders read row 0 as the top), no colour conversion.
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  texture(gl, UNIT_SRC, gl.RGBA8, srcW, srcH, gl.NEAREST);
  const glowA = texture(gl, UNIT_GLOW_A, gl.SRGB8_ALPHA8, srcW, srcH, gl.NEAREST);
  const glowB = texture(gl, UNIT_GLOW_B, gl.SRGB8_ALPHA8, srcW, srcH, gl.LINEAR);
  const gpu: Gpu = {
    gl,
    rows: program(gl, ROWS_FRAG),
    glowAcross: program(gl, GLOW_ACROSS_FRAG),
    glowDown: program(gl, GLOW_DOWN_FRAG),
    tube: program(gl, TUBE_FRAG),
    rowsTex: null,
    rowsFbo: target(gl, null),
    glowFboA: target(gl, glowA),
    glowFboB: target(gl, glowB),
    maxSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
  };
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE && !gl.isContextLost()) {
    throw new Error('CRT: cannot render to an sRGB texture');
  }

  // Uniforms that never change.
  const set = (p: WebGLProgram) => {
    gl.useProgram(p);
    return (name: string) => gl.getUniformLocation(p, name);
  };
  let u = set(gpu.rows);
  gl.uniform1i(u('u_src'), UNIT_SRC);
  gl.uniform1f(u('u_space'), SOFTNESS_SPACE);
  for (const [p, unit, dx, dy] of [[gpu.glowAcross, UNIT_SRC, 1, 0], [gpu.glowDown, UNIT_GLOW_A, 0, 1]] as const) {
    u = set(p);
    gl.uniform1i(u('u_tex'), unit);
    gl.uniform2i(u('u_dir'), dx, dy);
    gl.uniform1f(u('u_sigma'), BLOOM_RADIUS);
    gl.uniform3f(u('u_knee'), BLOOM_HAZE, BLOOM_KNEE[0], BLOOM_KNEE[1]);
  }
  u = set(gpu.tube);
  gl.uniform1i(u('u_rows'), UNIT_ROWS);
  gl.uniform1i(u('u_glow'), UNIT_GLOW_B);
  gl.uniform2f(u('u_src'), srcW, srcH);
  gl.uniform3f(u('u_knee'), BLOOM_HAZE, BLOOM_KNEE[0], BLOOM_KNEE[1]);
  gl.uniform1f(u('u_glowAmt'), BLOOM);
  gl.uniform1f(u('u_curve'), CURVATURE);
  gl.uniform1f(u('u_gain'), GAIN);
  return gpu;
}

/* ---------- how the look adapts to the scale ---------- */

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * What can be shown at `n` output pixels per source pixel.
 *
 * - Beams are gaussians, which carry almost nothing above the frequency 1/sigma; kept wider than 0.6/n rows,
 *   they can be sampled by the output rows wherever they fall without the picture's brightness beating, so
 *   scales that are not whole numbers (a fractional devicePixelRatio, browser zoom) do not make moire.
 * - At 2x there are only two output rows per source row. Sampled evenly they would both get the same light and
 *   show no line at all, so the beams are slid up by half an output row (one row on the beam, one between
 *   beams) and the strength is halved. Under 2x the lines fade out and only the softening and glow are left.
 * - The mask needs three output pixels a triad, so it fades in between 2x and 3x; from 6x its stripes double.
 */
function fitToScale(n: number) {
  const beamDark = Math.max(BEAM_DARK, 0.6 / n);
  return {
    phase: n < 2.5 ? 0.5 / n : 0,
    lines: smooth(1.5, 2, n) * (0.5 + 0.5 * smooth(2, 3, n)),
    // The shaders take the width where a beam falls to 1/e, which for a gaussian is sigma times root 2.
    beamDark: beamDark * Math.SQRT2,
    beamBright: Math.max(BEAM_BRIGHT, beamDark) * Math.SQRT2,
    // Flat-topped beams are not as band-limited as gaussians, so they are kept for when every scanline sits
    // squarely on output rows: a whole-number scale and a flat tube.
    shape: Math.abs(n - Math.round(n)) < 0.02 && CURVATURE === 0 ? BEAM_SHAPE : 2,
    mask: MASK * smooth(2, 3, n),
    stripe: Math.max(1, Math.floor((n * MASK_PITCH) / 3 + 1e-3)),
  };
}

/** The glass's scanline for one output row: none on the beam, strongest half-way between two beams. */
const glassLine = (row: number, n: number, phase: number) => {
  const t = (row + 0.5) / n + phase;
  const g = t - Math.floor(t) - 0.5;
  return 4 * g * g;
};

/* ---------- the filter ---------- */

export function createCrt(stage: HTMLElement, source: HTMLCanvasElement): Crt {
  let on = false;
  // Nothing below exists until the filter is first switched on.
  let glass: HTMLDivElement | null = null;
  let lines: HTMLCanvasElement | null = null;
  let screen: HTMLCanvasElement | null = null;
  /** Null when there is no WebGL2 here, or while the context is lost: the glass carries on alone. */
  let gpu: Gpu | null = null;
  /** The stage in device pixels, as last laid out. */
  let outW = 0, outH = 0;
  /** Set when the screen canvas and pass 1's texture need to catch up with outW and outH. */
  let stale = true;
  let observer: ResizeObserver | null = null;
  let density: MediaQueryList | null = null;

  function build(): void {
    glass = document.createElement('div');
    glass.className = 'crt-glass';
    glass.setAttribute('aria-hidden', 'true');
    glass.style.setProperty('--crt-vignette', String(VIGNETTE));
    glass.style.setProperty('--crt-sheen', String(GLASS_SHEEN));
    glass.style.setProperty('--crt-corner', `${CORNER}cqw`);
    lines = document.createElement('canvas');
    lines.className = 'crt-lines';
    lines.width = 1;
    glass.append(lines);

    screen = document.createElement('canvas');
    screen.className = 'crt-screen';
    screen.setAttribute('aria-hidden', 'true');
    screen.addEventListener('webglcontextlost', e => {
      e.preventDefault(); // or the browser will never hand the context back
      gpu = null;
      showScreen();
    });
    screen.addEventListener('webglcontextrestored', startGpu);
    startGpu();
  }

  /** Make (or remake, after a lost context) everything in the WebGL context. */
  function startGpu(): void {
    gpu = null;
    try {
      const gl = screen!.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false });
      if (gl && !gl.isContextLost()) gpu = buildGpu(gl, source.width, source.height);
    } catch (e) {
      console.warn(e);
    }
    stale = true;
    showScreen();
    if (on && gpu && outW) draw(); // a context that has just come back; a new one waits for its first layout
  }

  /** The screen canvas covers the game canvas only while it has a picture to show. */
  function showScreen(): void {
    screen!.style.visibility = gpu ? '' : 'hidden';
    stage.classList.toggle('crt-flat', on && !gpu);
  }

  /** Take the stage's size in device pixels and redo whatever depends on it. */
  function layout(w: number, h: number): void {
    w = Math.max(1, Math.round(w));
    h = Math.max(1, Math.round(h));
    if (w === outW && h === outH) return;
    outW = w;
    outH = h;
    stale = true;

    // The glass's scanlines: one device pixel wide, a pixel for each output row, stretched across by CSS.
    const n = h / source.height, fit = fitToScale(n);
    const strength = GLASS_LINES * fit.lines;
    lines!.height = h;
    const ctx = lines!.getContext('2d')!;
    const img = ctx.createImageData(1, h);
    for (let y = 0; y < h; y++) img.data[y * 4 + 3] = Math.round(255 * strength * glassLine(y, n, fit.phase));
    ctx.putImageData(img, 0, 0);
  }

  /** Bring the screen canvas, pass 1's texture and the scale-dependent uniforms up to date with the layout. */
  function resizeGpu(g: Gpu): void {
    const gl = g.gl;
    const w = Math.min(outW, g.maxSize), h = Math.min(outH, g.maxSize);
    screen!.width = w;
    screen!.height = h;
    gl.deleteTexture(g.rowsTex);
    g.rowsTex = texture(gl, UNIT_ROWS, gl.SRGB8_ALPHA8, w, source.height, gl.LINEAR);
    gl.bindFramebuffer(gl.FRAMEBUFFER, g.rowsFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, g.rowsTex, 0);

    const n = h / source.height, fit = fitToScale(n);
    gl.useProgram(g.rows);
    gl.uniform1f(gl.getUniformLocation(g.rows, 'u_sigma'), SOFTNESS);
    gl.useProgram(g.tube);
    const u = (name: string) => gl.getUniformLocation(g.tube, name);
    gl.uniform2f(u('u_out'), w, h);
    gl.uniform1f(u('u_scale'), n);
    gl.uniform1f(u('u_phase'), fit.phase);
    gl.uniform1f(u('u_scan'), SCANLINES * fit.lines);
    gl.uniform2f(u('u_beam'), fit.beamDark, fit.beamBright);
    gl.uniform1f(u('u_shape'), fit.shape);
    gl.uniform1f(u('u_mask'), fit.mask);
    gl.uniform1f(u('u_stripe'), fit.stripe);
    gl.uniform1f(u('u_glass'), GLASS_LINES * fit.lines);
    stale = false;
  }

  /** One frame through the four passes. Nothing here allocates. */
  function draw(): void {
    const g = gpu!, gl = g.gl;
    if (stale) resizeGpu(g);
    gl.activeTexture(gl.TEXTURE0 + UNIT_SRC);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);

    gl.bindFramebuffer(gl.FRAMEBUFFER, g.rowsFbo);
    gl.viewport(0, 0, screen!.width, source.height);
    gl.useProgram(g.rows);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindFramebuffer(gl.FRAMEBUFFER, g.glowFboA);
    gl.viewport(0, 0, source.width, source.height);
    gl.useProgram(g.glowAcross);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, g.glowFboB);
    gl.useProgram(g.glowDown);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, screen!.width, screen!.height);
    gl.useProgram(g.tube);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /**
   * Take the stage's size in device pixels. The observer's device-pixel box is exact where the layout size times
   * devicePixelRatio can be a pixel out, so it is used when the two agree that closely. When they do not (browser
   * dev tools emulating a pixel ratio report the box unscaled), the ratio is the one the page is really drawn at.
   */
  function measure(exact?: ResizeObserverSize): void {
    const box = stage.getBoundingClientRect();
    const w = box.width * devicePixelRatio, h = box.height * devicePixelRatio;
    if (exact && Math.abs(exact.inlineSize - w) < 1.5 && Math.abs(exact.blockSize - h) < 1.5) layout(exact.inlineSize, exact.blockSize);
    else layout(w, h);
  }

  function resized(entries: ResizeObserverEntry[]): void {
    measure(entries[0].devicePixelContentBoxSize?.[0]);
    // Resizing a canvas clears it, and this runs after the frame's `present`: draw again or the frame is black.
    if (stale && gpu) draw();
  }

  /** devicePixelRatio has no change event of its own: watch a media query that is true only at today's value. */
  function watchDensity(): void {
    density?.removeEventListener('change', densityChanged);
    density = matchMedia(`(resolution: ${devicePixelRatio}dppx)`);
    density.addEventListener('change', densityChanged);
  }
  function densityChanged(): void {
    watchDensity();
    measure();
    if (stale && gpu) draw();
  }

  return {
    setEnabled(next) {
      if (next === on) return;
      on = next;
      if (on) {
        if (!glass) build();
        source.after(screen!);
        stage.append(glass!);
        stage.classList.add('crt-on');
        showScreen();
        measure();
        observer = new ResizeObserver(resized);
        try {
          observer.observe(stage, { box: 'device-pixel-content-box' });
        } catch {
          observer.observe(stage); // Safari: no device-pixel box, so sizes come from `measure`
        }
        watchDensity();
        if (gpu) draw(); // the game's last frame, so the tube never shows an empty picture
      } else {
        observer?.disconnect();
        observer = null;
        density?.removeEventListener('change', densityChanged);
        density = null;
        screen!.remove();
        glass!.remove();
        stage.classList.remove('crt-on', 'crt-flat');
      }
    },
    present() {
      if (!on || !gpu) return;
      try {
        draw();
      } catch (e) {
        // Whatever went wrong, it must not stop the game's frame loop: fall back to the glass alone.
        console.warn(e);
        gpu = null;
        showScreen();
      }
    },
  };
}
