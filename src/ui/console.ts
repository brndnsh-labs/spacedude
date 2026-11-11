import {
  TUNING, UPGRADES, acceptJob, buyFuel, buyUpgrade, cargoMax, fuelFor, fuelMax, fuelQuote, holdTons, upgradeCost,
} from '../sim/game';
import { nextStop, planRoute, routeLegs } from '../sim/nav';
import { PORT_TYPES } from '../sim/sector';
import type { GameState, PortId, Result } from '../sim/types';
import { charted, port } from '../sim/world';

export type Tab = 'log' | 'port' | 'jobs' | 'hold' | 'yard' | 'nav';

const TABS: Record<Tab, { label: string; action: string }> = {
  log: { label: 'Log', action: '' },
  port: { label: 'Fuel', action: 'Buy' },
  jobs: { label: 'Jobs', action: 'Accept' },
  hold: { label: 'Hold', action: 'Set course' },
  yard: { label: 'Yard', action: 'Fit' },
  nav: { label: 'Nav', action: 'Set course' },
};

export interface ConsoleHost {
  state(): GameState;
  /** Called after anything that changed the game state. */
  changed(): void;
  /** Called when the player leaves the screen. */
  closed(): void;
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const num = (n: number) => Math.round(n).toLocaleString('en-US');
const mm = (d: number) => `${(d / 1000).toFixed(1)} Mm`;
/** How many ports the nav list shows at once. */
const NAV_ROWS = 7;
const signed = (n: number) => `${n > 0 ? '+' : ''}${num(n)}`;

/**
 * An amber terminal screen. Which tabs it offers depends on where the player
 * opened it: the ship's computer, or one of a station's counters.
 */
export class Console {
  tab: Tab = 'nav';
  private tabs: Tab[] = ['nav'];
  private sel: Record<Tab, number> = { log: 0, port: 0, jobs: 0, hold: 0, yard: 0, nav: 0 };
  private msg = '';

  constructor(private readonly el: HTMLElement, private readonly host: ConsoleHost) {
    el.addEventListener('click', e => this.onClick(e));
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  /** Show the given tabs, starting on the first. */
  open(tabs: Tab[], msg = ''): void {
    this.tabs = tabs;
    this.tab = tabs[0];
    this.msg = msg;
    this.el.hidden = false;
    this.render();
  }

  close(): void {
    if (!this.isOpen) return;
    this.el.hidden = true;
    this.host.closed();
  }

  /** Redraw with current numbers, for when the ship is flying behind the screen. */
  refresh(): void {
    if (this.isOpen) this.render();
  }

  private rowCount(): number {
    const s = this.host.state();
    switch (this.tab) {
      case 'log': return 0;
      case 'port': return 2;
      case 'jobs': return s.docked ? s.boards[s.docked].length : 0;
      case 'hold': return s.hold.length;
      case 'yard': return UPGRADES.length;
      case 'nav': return s.ports.length;
    }
  }

  private setTab(tab: Tab): void {
    this.tab = tab;
    this.msg = '';
    this.render();
  }

  private move(delta: number): void {
    const n = this.rowCount();
    if (n) this.sel[this.tab] = (this.sel[this.tab] + delta + n) % n;
    this.msg = '';
    this.render();
  }

  private activate(): void {
    const s = this.host.state(), i = this.sel[this.tab];
    let r: Result | null = null;
    switch (this.tab) {
      case 'log':
        break;
      case 'port':
        r = buyFuel(s, i === 0 ? 'fill' : 10);
        break;
      case 'jobs': {
        const job = s.docked ? s.boards[s.docked][i] : undefined;
        if (job) r = acceptJob(s, job.id);
        break;
      }
      case 'hold': {
        const job = s.hold[i];
        if (job) {
          s.target = job.to;
          r = { ok: true, msg: `Course set: ${port(s, job.to).name}.` };
        }
        break;
      }
      case 'yard':
        r = buyUpgrade(s, UPGRADES[i].id);
        break;
      case 'nav': {
        const p = s.ports[i];
        if (p.id === s.docked) r = { ok: false, msg: 'You are already here.' };
        else {
          s.target = p.id;
          r = { ok: true, msg: `Course set: ${p.name}.` };
        }
        break;
      }
    }
    if (r) this.msg = r.msg;
    this.host.changed();
    this.render();
  }

  /** Handle a key press. Returns true if the console used it. */
  key(e: KeyboardEvent): boolean {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k >= '1' && k <= '9') {
      const tab = this.tabs[+k - 1];
      if (tab) this.setTab(tab);
    } else if (k === 'ArrowUp' || k === 'w') this.move(-1);
    else if (k === 'ArrowDown' || k === 's') this.move(1);
    else if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'a' || k === 'd') {
      const step = k === 'ArrowLeft' || k === 'a' ? -1 : 1;
      this.setTab(this.tabs[(this.tabs.indexOf(this.tab) + step + this.tabs.length) % this.tabs.length]);
    } else if (k === 'Enter' || k === ' ') this.activate();
    else if (k === 'Escape' || k === 'Tab') this.close();
    else return false;
    return true;
  }

  private onClick(e: MouseEvent): void {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-tab],[data-row],[data-act]');
    if (!t) return;
    if (t.dataset.tab) this.setTab(t.dataset.tab as Tab);
    else if (t.dataset.row) {
      this.sel[this.tab] = +t.dataset.row;
      this.msg = '';
      this.render();
    } else if (t.dataset.act === 'go') this.activate();
    else if (t.dataset.act === 'close') this.close();
  }

  render(): void {
    const s = this.host.state();
    const n = this.rowCount();
    this.sel[this.tab] = Math.max(0, Math.min(this.sel[this.tab], n - 1));

    const tabs = this.tabs.map((id, i) =>
      `<button data-tab="${id}" class="${id === this.tab ? 'on' : ''}">${i + 1} ${TABS[id].label}</button>`).join('');
    const body = {
      log: this.logTab, port: this.portTab, jobs: this.jobsTab, hold: this.holdTab, yard: this.yardTab, nav: this.navTab,
    }[this.tab].call(this, s);

    this.el.innerHTML = `
      <div class="c-head">
        <span>${esc(s.docked ? port(s, s.docked).name : 'Under way')}</span>
        <span>Day ${s.day}</span>
        <span class="${s.credits < 0 ? 'neg' : ''}">Cr ${num(s.credits)}</span>
        <span>Fuel ${Math.round(s.ship.fuel)}/${fuelMax(s)}</span>
        <span>Hold ${holdTons(s)}/${cargoMax(s)} t</span>
      </div>
      <nav class="c-tabs">${tabs}</nav>
      <div class="c-body">${body}</div>
      <div class="c-foot">
        <span class="c-msg">&gt; ${esc(this.msg)}<span class="cursor">_</span></span>
        <span class="c-actions">
          ${n ? `<button data-act="go">[Enter] ${TABS[this.tab].action}</button>` : ''}
          <button data-act="close">[Esc] Leave</button>
        </span>
      </div>`;
  }

  private row(i: number, cls: string, cells: string[]): string {
    return `<div class="row ${cls}${this.sel[this.tab] === i ? ' sel' : ''}" data-row="${i}">${cells.map(c => `<span>${c}</span>`).join('')}</div>`;
  }

  private logTab(s: GameState): string {
    const report = s.report.map(l =>
      `<div class="line"><span>${esc(l.text)}</span>${l.amount === undefined ? '' : `<span class="${l.amount < 0 ? 'neg' : ''}">${signed(l.amount)}</span>`}</div>`).join('');
    return `
      <div class="sect">Last port call</div>
      ${report || '<div class="dim">Nothing to report.</div>'}
      <div class="sect">To date</div>
      <div class="dim">${s.stats.delivered} jobs delivered, ${num(s.stats.earned)} cr earned.</div>
      ${s.startSeed === undefined ? '' : `<div class="sect">Sector</div>
      <div class="dim">Seed ${s.startSeed}. Add ?seed=${s.startSeed} to the address for a new game in this same sector.</div>`}`;
  }

  private portTab(s: GameState): string {
    const p = port(s, s.docked!);
    // Quote what the pump will really give: a maxed tab buys less, and the harbormaster may front some.
    const quote = (label: string, units: number | 'fill') => {
      const q = fuelQuote(s, units);
      return [label, `${Math.round(q.paid + q.fronted)} units`, `${num(q.cost)} cr`];
    };
    return `
      <div class="dim">${esc(p.blurb)}</div>
      <div class="sect">Fuel dock - ${p.fuelPrice.toFixed(1)} cr per unit</div>
      ${this.row(0, 'r-port', quote('Fill the tank', 'fill'))}
      ${this.row(1, 'r-port', quote('Take on 10', 10))}
      <div class="sect">Dock clerk says</div>
      <div class="dim">${s.credits < 0 ? "It's on your tab. The tab has limits." : 'Berth fee is already on your account.'}</div>`;
  }

  private jobsTab(s: GameState): string {
    const board = s.boards[s.docked!];
    if (!board.length) return `<div class="dim">The board's empty. Try another port.</div>`;
    const free = cargoMax(s) - holdTons(s);
    const rows = board.map((j, i) => this.row(i, `r-jobs${j.tons > free ? ' nofit' : ''}`, [
      esc(j.cargo), esc(port(s, j.to).name), `${j.tons} t`, `Day ${j.due}`, `${num(j.pay)} cr`, j.kind,
    ])).join('');
    const j = board[this.sel.jobs];
    const to = port(s, j.to), run = charted(s, s.docked!, j.to);
    const where = run.hops > 1 ? `${mm(run.dist)} out, ${run.hops} lanes away in ${esc(to.region)}.` : `${mm(run.dist)} out, one lane away.`;
    return `
      <div class="row r-jobs dim"><span>Cargo</span><span>To</span><span>Load</span><span>Due</span><span>Pays</span><span>Type</span></div>
      ${rows}
      <div class="sect">From ${esc(j.client)}</div>
      <div>${esc(j.note)}</div>
      <div class="dim">${esc(to.name)}: ${where}</div>
      <div class="dim">${j.tons > free ? `Won't fit: needs ${j.tons} t, ${free} t free.` : `Needs ${j.tons} t of your ${free} t free.`} Late delivery pays ${Math.round(TUNING.lateFactor * 100)}%.</div>`;
  }

  private holdTab(s: GameState): string {
    if (!s.hold.length) return `<div class="dim">The hold is empty. Ask about work at a station.</div>`;
    const rows = s.hold.map((j, i) => this.row(i, 'r-hold', [
      esc(j.cargo), esc(port(s, j.to).name), `${j.tons} t`, s.day > j.due ? 'Late' : `Day ${j.due}`, `${num(j.pay)} cr`,
    ])).join('');
    return `
      <div class="row r-hold dim"><span>Cargo</span><span>Deliver to</span><span>Load</span><span>Due</span><span>Pays</span></div>
      ${rows}
      <div class="sect">Manifest</div>
      <div class="dim">${holdTons(s)} of ${cargoMax(s)} t used.</div>`;
  }

  private yardTab(s: GameState): string {
    const rows = UPGRADES.map((u, i) => {
      const cost = upgradeCost(s, u.id);
      return this.row(i, 'r-yard', [u.name, `Mk ${s.upgrades[u.id]}/${u.costs.length}`, u.effect, cost === null ? 'Maxed' : `${num(cost)} cr`]);
    }).join('');
    return `
      <div class="row r-yard dim"><span>Fitting</span><span>Level</span><span>Each level</span><span>Cost</span></div>
      ${rows}
      <div class="sect">Yard boss says</div>
      <div class="dim">${s.credits < 0 ? 'Settle your tab before you talk to me about fittings.' : 'Cash up front. No tabs, no trades.'}</div>`;
  }

  /** Fuel and legs to each port from where the ship is now. */
  private reach(s: GameState, id: PortId): { dist: number; fuel: number; legs: number } {
    if (s.docked) {
      const legs = routeLegs(s, s.docked, id);
      return { dist: legs.reduce((a, l) => a + l.dist, 0), fuel: legs.reduce((a, l) => a + fuelFor(s, l.dist), 0), legs: legs.length };
    }
    const p = port(s, id), dist = Math.hypot(p.x - s.ship.x, p.y - s.ship.y);
    return { dist, fuel: fuelFor(s, dist), legs: 1 };
  }

  private navTab(s: GameState): string {
    const sel = this.sel.nav, n = s.ports.length;
    // The list scrolls: keep the selected port in a window of a few rows.
    const top = Math.max(0, Math.min(n - NAV_ROWS, sel - Math.floor(NAV_ROWS / 2)));
    const rows = s.ports.slice(top, top + NAV_ROWS).map((p, k) => {
      const i = top + k, r = this.reach(s, p.id);
      const drops = s.hold.filter(j => j.to === p.id).length;
      const here = p.id === s.docked;
      return this.row(i, 'r-nav', [
        `${p.id === s.target ? '&gt;' : '&nbsp;'} ${esc(p.name)}`,
        here ? 'Here' : mm(r.dist),
        here ? '' : `${r.fuel} f`,
        here || r.legs < 2 ? '' : `${r.legs} legs`,
        drops ? `${drops} drop${drops > 1 ? 's' : ''}` : '',
      ]);
    }).join('');

    const p = s.ports[sel], r = this.reach(s, p.id);
    let way = 'You are docked here.';
    if (p.id !== s.docked) {
      if (!s.docked) way = r.fuel > s.ship.fuel ? `Straight there needs ${r.fuel} fuel. You have ${Math.round(s.ship.fuel)}.` : `Straight there: ${r.fuel} fuel.`;
      else if (r.legs > 1) way = `Too far for one tank. Via ${planRoute(s, s.docked, p.id).slice(0, -1).map(id => esc(port(s, id).name)).join(', ')}.`;
      else way = r.fuel > s.ship.fuel ? `One leg, but it needs ${r.fuel} fuel. You have ${Math.round(s.ship.fuel)}.` : 'One leg on this tank.';
    }
    return `<div class="nav">${this.navMap(s)}<div>
      <div class="row r-nav dim"><span>&nbsp; Port ${top > 0 ? '^' : ''}${top + NAV_ROWS < n ? 'v' : ''}</span><span>Range</span><span>Fuel</span><span>Route</span><span>Cargo</span></div>
      ${rows}
      <div class="sect">${esc(p.name)} - ${esc(p.region)}</div>
      <div>${PORT_TYPES[p.type].label}. Fuel ${p.fuelPrice.toFixed(1)} cr. ${p.yard ? 'Shipyard.' : 'No shipyard.'}</div>
      <div class="dim">${way}</div>
      <div class="dim">${s.target ? `Course laid in: ${esc(port(s, s.target).name)}.` : 'No course laid in.'}</div>
    </div></div>`;
  }

  private navMap(s: GameState): string {
    const xs = s.ports.map(p => p.x), ys = s.ports.map(p => p.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    // One unit of chart furniture: dots, labels and the ship are sized from the span of the sector.
    const u = Math.max(x1 - x0, y1 - y0) / 100, pad = u * 12;
    const at = (id: PortId) => port(s, id);
    const lanes = s.lanes.map(([a, b]) => `M${at(a).x},${at(a).y}L${at(b).x},${at(b).y}`).join('');
    const selected = s.ports[this.sel.nav];
    const ports = s.ports.map(p => `
      <circle cx="${p.x}" cy="${p.y}" r="${u * 1.3}" class="${s.hold.some(j => j.to === p.id) ? 'fill' : 'dot'}"/>
      ${p === selected ? `<circle cx="${p.x}" cy="${p.y}" r="${u * 3.2}" class="dash"/>` : ''}
      ${p.id === s.target ? `<path d="M${p.x - u * 4},${p.y - u * 2.2}v${-u * 1.8}h${u * 1.8}M${p.x + u * 2.2},${p.y - u * 4}h${u * 1.8}v${u * 1.8}M${p.x + u * 4},${p.y + u * 2.2}v${u * 1.8}h${-u * 1.8}M${p.x - u * 2.2},${p.y + u * 4}h${-u * 1.8}v${-u * 1.8}"/>` : ''}`).join('');
    // Region names sit above their ports; the selected port is named too.
    const regions = [...new Set(s.ports.map(p => p.region))].map(name => {
      const mine = s.ports.filter(p => p.region === name);
      const cx = mine.reduce((a, p) => a + p.x, 0) / mine.length, top = Math.min(...mine.map(p => p.y));
      return `<text x="${cx.toFixed(0)}" y="${(top - u * 4.5).toFixed(0)}" class="region">${esc(name)}</text>`;
    }).join('');
    const label = `<text x="${selected.x}" y="${selected.y + u * 8.5}">${esc(selected.name)}</text>`;

    // The course: from the ship through each stop to the far end.
    let course = '';
    const stop = nextStop(s);
    if (s.target && stop) {
      const stops = [stop, ...planRoute(s, stop, s.target)];
      course = `<path d="M${s.ship.x.toFixed(0)},${s.ship.y.toFixed(0)}${stops.map(id => `L${at(id).x},${at(id).y}`).join('')}" class="course"/>`;
    }
    const ship = `<path d="M${u * 3},0L${-u * 2},${-u * 1.8}L${-u * 2},${u * 1.8}Z" class="fill" transform="translate(${s.ship.x.toFixed(0)} ${s.ship.y.toFixed(0)}) rotate(${((s.ship.angle * 180) / Math.PI).toFixed(0)})"/>`;
    return `<svg class="map" viewBox="${x0 - pad} ${y0 - pad} ${x1 - x0 + pad * 2} ${y1 - y0 + pad * 2}" style="--u:${u}px" role="img" aria-label="Sector chart">
      <path d="${lanes}" class="lane"/>
      ${course}
      ${ports}
      ${regions}
      ${label}
      ${ship}
    </svg>`;
  }
}
