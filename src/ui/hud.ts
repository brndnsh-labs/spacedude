import { fuelMax } from '../sim/game';
import type { GameState } from '../sim/types';
import { port } from '../sim/world';

const PIPS = 8;

/** The in-flight overlay: credits, fuel, course and prompts, in the pixel style. */
export class Hud {
  private last = '';
  constructor(private readonly el: HTMLElement) {}

  show(visible: boolean): void {
    this.el.hidden = !visible;
  }

  update(state: GameState, opts: { autopilot: boolean; prompt: string }): void {
    const s = state.ship;
    const lit = Math.ceil((s.fuel / fuelMax(state)) * PIPS);
    let course = 'No course set';
    if (state.target) {
      const p = port(state.target);
      course = `&gt; ${p.name} - ${(Math.hypot(p.x - s.x, p.y - s.y) / 1000).toFixed(1)} Mm`;
    }
    const pips = Array.from({ length: PIPS }, (_, i) => `<i class="${i < lit ? '' : 'off'}"></i>`).join('');
    const html = `
      <div class="h-box h-tl">Cr ${Math.round(state.credits).toLocaleString('en-US')} <span class="pips${lit <= 2 ? ' low' : ''}">${pips}</span></div>
      <div class="h-box h-tr">Day ${state.day}</div>
      <div class="h-box h-br">${course}</div>
      <div class="h-hint">${opts.autopilot ? '<b>Autopilot on</b><br>' : ''}Arrows / WASD fly<br>Q autopilot - E dock<br>Tab console</div>
      ${opts.prompt ? `<div class="h-box h-prompt">${opts.prompt}</div>` : ''}`;
    if (html !== this.last) {
      this.last = html;
      this.el.innerHTML = html;
    }
  }
}
