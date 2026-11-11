import { fuelMax } from '../sim/game';
import { nextStop } from '../sim/nav';
import type { GameState } from '../sim/types';
import { port } from '../sim/world';
import { VIEW_W } from '../view';

const PIPS = 8;

export interface HudInfo {
  /** At the helm flying the ship, or walking around. */
  mode: 'helm' | 'foot';
  autopilot: boolean;
  /** Where the player is, shown above the key hints. */
  place: string;
  /** One line is an action prompt; several are a notice (such as an arrival report). */
  prompt: string[];
  /** On foot: where the walker is in the frame, in screen pixels, so the prompt can sit under them. */
  anchor?: { x: number; y: number };
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** The pixel-style overlay: credits, fuel, course, where you are, and prompts. */
export class Hud {
  private last = '';
  constructor(private readonly el: HTMLElement) {}

  show(visible: boolean): void {
    this.el.hidden = !visible;
  }

  update(state: GameState, info: HudInfo): void {
    const s = state.ship;
    const lit = Math.ceil((s.fuel / fuelMax(state)) * PIPS);
    let course = 'No course set';
    if (state.target) {
      // On a long course the range shown is to the next stop, which is where the chevron points.
      const p = port(state, state.target), stop = port(state, nextStop(state) ?? state.target);
      const via = stop.id === p.id ? '' : `<br><small>via ${esc(stop.name)}</small>`;
      course = `<span>&gt; ${esc(p.name)}${via} - ${(Math.hypot(stop.x - s.x, stop.y - s.y) / 1000).toFixed(1)} Mm</span>`;
    }
    const pips = Array.from({ length: PIPS }, (_, i) => `<i class="${i < lit ? '' : 'off'}"></i>`).join('');
    const keys = info.mode === 'helm'
      ? 'Arrows / WASD fly<br>Q autopilot - E dock<br>Tab computer - X stand up'
      : 'Arrows / WASD walk<br>E use';
    let prompt = '';
    if (info.prompt.length === 1 && info.anchor) {
      // A small label under the walker keeps your eyes on the character. The stage is 100cqw wide.
      const cqw = VIEW_W / 100;
      const x = Math.max(70, Math.min(VIEW_W - 70, info.anchor.x)) / cqw, y = (info.anchor.y + 9) / cqw;
      prompt = `<div class="h-label" style="left:${x.toFixed(1)}cqw;top:${y.toFixed(1)}cqw">${esc(info.prompt[0])}</div>`;
    } else if (info.prompt.length) {
      prompt = `<div class="h-box h-prompt ${info.prompt.length > 1 ? 'notice' : 'mid'}">${info.prompt.map(l => `<div>${esc(l)}</div>`).join('')}</div>`;
    }
    const html = `
      <div class="h-box h-tl"><i class="coin"></i>${Math.round(state.credits).toLocaleString('en-US')} <span class="h-tag">Fuel</span><span class="pips${lit <= 2 ? ' low' : ''}">${pips}</span></div>
      <div class="h-box h-tr">Day ${state.day}</div>
      <div class="h-box h-br">${course}</div>
      <div class="h-hint"><b>${esc(info.place)}${info.autopilot ? ' - autopilot on' : ''}</b><br>${keys}</div>
      ${prompt}`;
    if (html !== this.last) {
      this.last = html;
      this.el.innerHTML = html;
    }
  }
}
