/**
 * The CRT filter's shaders (GLSL ES 3.00, WebGL2). Four small passes; see index.ts for how they are chained.
 *
 * Conventions shared by all of them:
 * - Row 0 of every texture is the top of the picture (the game canvas is uploaded unflipped).
 * - The game canvas arrives sRGB-encoded. Everything after the first pass is in linear light, stored in
 *   SRGB8_ALPHA8 textures so the GPU decodes on read and encodes on write with no banding in the darks.
 */

/** One triangle that covers the target. */
export const VERT = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const HEAD = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 v_uv;
out vec4 o;
`;

const TO_LINEAR = `
vec3 toLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}`;

/**
 * How much of a colour's light goes into the glow: a little of everything, most of the highlights.
 * The glow passes spread that share of each pixel around it; the final pass takes the same share back out of
 * the picture. So the glow moves light rather than adding it: a flat area keeps its level exactly, a highlight
 * gives a little of itself to its surroundings, and nothing lays a grey veil over the darks.
 */
const GLOW_PART = `
uniform vec3 u_knee; // x: share of ordinary colours that glows, y..z: where highlights start and are full
float glowShare(vec3 c) {
  return mix(u_knee.x, 1.0, smoothstep(u_knee.y, u_knee.z, max(c.r, max(c.g, c.b))));
}`;

/**
 * Pass 1, the video signal: each source row resampled across to output width with a small gaussian, so
 * vertical edges are slightly soft the way a band-limited video signal makes them. Rows are left alone.
 *
 * The blend is done part-way between the encoded signal and linear light (u_space): in pure linear light a
 * bright pixel eats most of a one-pixel dark outline beside it; in the encoded signal dither patterns go dark.
 */
export const ROWS_FRAG = `${HEAD}
uniform sampler2D u_src;  // the game canvas, sRGB-encoded
uniform float u_sigma;    // horizontal softness, in source pixels
uniform float u_space;    // exponent of the space the blend is done in: 1 = encoded signal, 2.2 = linear light
${TO_LINEAR}
vec3 tap(int x, int y, int w) {
  return pow(texelFetch(u_src, ivec2(clamp(x, 0, w - 1), y), 0).rgb, vec3(u_space));
}
void main() {
  ivec2 size = textureSize(u_src, 0);
  float x = v_uv.x * float(size.x) - 0.5;
  float i = floor(x), f = x - i;
  int x0 = int(i), y = int(v_uv.y * float(size.y));
  vec4 d = vec4(f + 1.0, f, 1.0 - f, 2.0 - f);
  vec4 w = exp(d * d * (-0.5 / (u_sigma * u_sigma)));
  vec3 sum = w.x * tap(x0 - 1, y, size.x) + w.y * tap(x0, y, size.x)
           + w.z * tap(x0 + 1, y, size.x) + w.w * tap(x0 + 2, y, size.x);
  sum /= w.x + w.y + w.z + w.w;
  o = vec4(toLinear(pow(sum, vec3(1.0 / u_space))), 1.0);
}`;

/**
 * Passes 2 and 3, the glow: a separable gaussian blur at source size, in linear light.
 * The across pass reads the raw game canvas, decodes it and keeps each pixel's glowing share; the down pass
 * reads the across pass's result.
 */
const blurFrag = (decode: boolean) => `${HEAD}
uniform sampler2D u_tex;
uniform ivec2 u_dir;
uniform float u_sigma; // in source pixels
${TO_LINEAR}
${GLOW_PART}
const int R = 10;
void main() {
  ivec2 size = textureSize(u_tex, 0);
  ivec2 p = ivec2(v_uv * vec2(size));
  float k = -0.5 / (u_sigma * u_sigma);
  vec3 sum = vec3(0.0);
  float total = 0.0;
  for (int i = -R; i <= R; i++) {
    float w = exp(float(i * i) * k);
    vec3 c = texelFetch(u_tex, clamp(p + u_dir * i, ivec2(0), size - 1), 0).rgb;
    ${decode ? 'c = toLinear(c); c *= glowShare(c);' : ''}
    sum += w * c;
    total += w;
  }
  o = vec4(sum / total, 1.0);
}`;
export const GLOW_ACROSS_FRAG = blurFrag(true);
export const GLOW_DOWN_FRAG = blurFrag(false);

/**
 * Pass 4, the tube. For every output pixel:
 *
 * 1. Scanlines. Each source row is a beam, one per colour gun. A dark colour's beam is a thin gaussian; the
 *    harder a gun is driven the wider its beam gets and the flatter its top (u_beam, u_shape), and its height
 *    is always scaled so the light summed over the row equals the source value. So dark colours become thin
 *    bright lines with gaps, highlights swell until their lines merge, and nothing is thrown away that would
 *    have to be boosted back. The flat top matters: a fat gaussian would spill into the rows above and below
 *    and wash out one-pixel outlines, where a flat-topped beam fills its own row and stops.
 * 2. Mask. An aperture grille in output pixels: red, green and blue stripes. Also light-preserving: the lit
 *    stripe gains what the two dark ones lose, and the depth backs off where a channel has no headroom left
 *    (so white stays white rather than going grey and striped).
 * 3. Glow, added after the mask because it is light scattered in the glass, not by the phosphor.
 * 4. Encode to sRGB, pre-brightened under the glass overlay's scanlines (see crt.css) so the two do not
 *    stack, and dithered by under one code value so the glow's soft gradients do not band.
 */
export const TUBE_FRAG = `${HEAD}
uniform sampler2D u_rows;  // pass 1: linear light, output width by source height
uniform sampler2D u_glow;  // pass 3: blurred linear light, source size
uniform vec2 u_src;        // source size in pixels
uniform vec2 u_out;        // output size in device pixels
uniform float u_scale;     // output pixels per source pixel
uniform float u_phase;     // how far beam centres sit above row centres, in rows (non-zero only near 2x)
uniform float u_scan;      // scanline strength after the fade for small scales, 0..1
uniform vec2 u_beam;       // beam half-width in rows (where it falls to 1/e): at black, at full drive
uniform float u_shape;     // beam exponent at full drive: 2 is a gaussian, more is flatter-topped
uniform float u_mask;      // mask depth after the fade for small scales
uniform float u_stripe;    // width of one mask stripe, in output pixels
uniform float u_glowAmt;
uniform float u_curve;
uniform float u_glass;     // alpha of the glass overlay's scanlines, to be undone here
uniform float u_gain;
${GLOW_PART}

vec3 beam(vec3 c, float d) {
  vec3 t = clamp(c, 0.0, 1.0);
  vec3 w = mix(vec3(u_beam.x), vec3(u_beam.y), t);
  vec3 n = mix(vec3(2.0), vec3(u_shape), t);
  // The area under exp(-(d/w)^n) is 2 w gamma(1 + 1/n), and that gamma is 0.886 at n = 2, rising 0.01 per unit.
  return c * exp(-pow(vec3(abs(d)) / w, n)) / (2.0 * w * (0.866 + 0.0101 * n));
}
vec3 encode(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float noise(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

void main() {
  // Where on the tube face, 0..1 from the top left; the bulge pulls the corners in.
  vec2 c = vec2(v_uv.x, 1.0 - v_uv.y) * 2.0 - 1.0;
  c *= 1.0 + u_curve * c.yx * c.yx;
  vec2 q = c * 0.5 + 0.5;
  vec2 sp = q * u_src;

  // The source row this pixel lies in, and the next one on the side of the row this pixel is nearer to.
  // Beams are narrow enough that a third row would add under one part in thirty, so it is not fetched.
  float row = floor(sp.y);
  float f = sp.y - row - 0.5; // -0.5..0.5 from the row's centre
  float d = f + u_phase;      // from the row's beam centre
  float side = f < 0.0 ? -1.0 : 1.0;
  float v = (row + 0.5) / u_src.y;
  vec3 here = texture(u_rows, vec2(q.x, v)).rgb;
  vec3 next = texture(u_rows, vec2(q.x, v + side / u_src.y)).rgb;

  vec3 lit = beam(here, d) + beam(next, d - side);
  // The picture with no scanlines: rows as crisp as the output grid allows (exactly nearest at whole scales).
  float h = 0.5 / u_scale;
  float share = clamp((h - 0.5 + abs(f)) / (2.0 * h), 0.0, 1.0); // how much of this pixel lies in the next row
  vec3 plain = mix(here, next, share);
  vec3 col = mix(plain, lit, u_scan);

  // Aperture grille.
  vec3 stripe = vec3(-1.0);
  stripe[int(mod(floor(gl_FragCoord.x / u_stripe), 3.0))] = 2.0;
  vec3 depth = clamp((1.0 - col) / (2.0 * col + 1e-4), 0.0, u_mask);
  col *= 1.0 + depth * stripe;

  // Glow.
  col = col * (1.0 - u_glowAmt * glowShare(plain)) + u_glowAmt * texture(u_glow, q).rgb;
  col *= u_gain;

  // Off the edge of the bulged picture is unlit tube.
  vec2 edge = (0.5 - abs(q - 0.5)) * u_out;
  col *= clamp(min(edge.x, edge.y) + 0.5, 0.0, 1.0);

  vec3 e = encode(clamp(col, 0.0, 1.0));
  float g = fract((u_out.y - gl_FragCoord.y) / u_scale + u_phase) - 0.5;
  e /= 1.0 - u_glass * 4.0 * g * g;
  e += (noise(gl_FragCoord.xy) - 0.5) / 255.0;
  o = vec4(e, 1.0);
}`;
