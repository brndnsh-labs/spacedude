import {
  UPGRADES, acceptJob, buyFuel, buyUpgrade, cargoMax, fuelFor, fuelMax, holdTons, upgradeCost,
} from '../sim/game';
import type { GameState, Result } from '../sim/types';
import { PORTS, port } from '../sim/world';

export type Tab = 'port' | 'jobs' | 'hold' | 'yard' | 'nav';

const TABS: readonly { id: Tab; label: string; needsDock: boolean; action: string }[] = [
  { id: 'port', label: 'Port', needsDock: true, action: 'Buy' },
  { id: 'jobs', label: 'Jobs', needsDock: true, action: 'Accept' },
  { id: 'hold', label: 'Hold', needsDock: false, action: 'Set course' },
  { id: 'yard', label: 'Yard', needsDock: true, action: 'Fit' },
  { id: 'nav', label: 'Nav', needsDock: false, action: 'Set course' },
];

export interface ConsoleHost {
  state(): GameState;
  launch(): Result;
  resume(): void;
  /** Called after anything that changed the game state. */
  changed(): void;
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const num = (n: number) => Math.round(n).toLocaleString('en-US');
const mm = (d: number) => `${(d / 1000).toFixed(1)} Mm`;
const signed = (n: number) => `${n > 0 ? '+' : ''}${num(n)}`;

/** The ship's computer: an amber terminal for jobs, cargo, upgrades and navigation. */
export class Console {
  tab: Tab = 'port';
  private sel: Record<Tab, number> = { port: 0, jobs: 0, hold: 0, yard: 0, nav: 0 };
  private msg = '';

  constructor(private readonly el: HTMLElement, private readonly host: ConsoleHost) {
    el.addEventListener('click', e => this.onClick(e));
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  open(tab?: Tab, msg = ''): void {
    const docked = !!this.host.state().docked;
    this.tab = tab ?? (docked ? 'port' : 'nav');
    if (!this.available(this.tab)) this.tab = 'nav';
    this.msg = msg;
    this.el.hidden = false;
    this.render();
  }

  close(): void {
    this.el.hidden = true;
  }

  private available(tab: Tab): boolean {
    return !!this.host.state().docked || !TABS.find(t => t.id === tab)!.needsDock;
  }

  private rowCount(): number {
    const s = this.host.state();
    switch (this.tab) {
      case 'port': return 2;
      case 'jobs': return s.docked ? s.boards[s.docked].length : 0;
      case 'hold': return s.hold.length;
      case 'yard': return UPGRADES.length;
      case 'nav': return PORTS.length;
    }
  }

  private setTab(tab: Tab): void {
    if (!this.available(tab)) {
      this.msg = 'No dock link. Dock to use that.';
    } else {
      this.tab = tab;
      this.msg = '';
    }
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
          r = { ok: true, msg: `Course set: ${port(job.to).name}.` };
        }
        break;
      }
      case 'yard':
        r = buyUpgrade(s, UPGRADES[i].id);
        break;
      case 'nav': {
        const p = PORTS[i];
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

  private launch(): void {
    const r = this.host.launch();
    if (!r.ok) {
      this.msg = r.msg;
      this.render();
    }
  }

  /** Handle a key press. Returns true if the console used it. */
  key(e: KeyboardEvent): boolean {
    const docked = !!this.host.state().docked;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k >= '1' && k <= '5') this.setTab(TABS[+k - 1].id);
    else if (k === 'ArrowUp' || k === 'w') this.move(-1);
    else if (k === 'ArrowDown' || k === 's') this.move(1);
    else if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'a' || k === 'd') {
      const open = TABS.filter(t => this.available(t.id));
      const step = k === 'ArrowLeft' || k === 'a' ? -1 : 1;
      this.setTab(open[(open.findIndex(t => t.id === this.tab) + step + open.length) % open.length].id);
    } else if (k === 'Enter' || k === ' ') this.activate();
    else if (k === 'l' && docked) this.launch();
    else if ((k === 'Tab' || k === 'Escape') && !docked) this.host.resume();
    else if (k !== 'Tab') return false;
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
    else if (t.dataset.act === 'launch') this.launch();
    else if (t.dataset.act === 'resume') this.host.resume();
  }

  render(): void {
    const s = this.host.state();
    const n = this.rowCount();
    this.sel[this.tab] = Math.max(0, Math.min(this.sel[this.tab], n - 1));
    const tabDef = TABS.find(t => t.id === this.tab)!;

    const tabs = TABS.map((t, i) =>
      `<button data-tab="${t.id}" class="${t.id === this.tab ? 'on' : ''}${this.available(t.id) ? '' : ' off'}">${i + 1} ${t.label}</button>`).join('');
    const body = { port: this.portTab, jobs: this.jobsTab, hold: this.holdTab, yard: this.yardTab, nav: this.navTab }[this.tab].call(this, s);

    this.el.innerHTML = `
      <div class="c-head">
        <span>${esc(s.docked ? port(s.docked).name : 'In flight')}</span>
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
          ${n ? `<button data-act="go">[Enter] ${tabDef.action}</button>` : ''}
          ${s.docked ? '<button data-act="launch">[L] Launch</button>' : '<button data-act="resume">[Tab] Resume</button>'}
        </span>
      </div>`;
  }

  private row(i: number, cls: string, cells: string[]): string {
    return `<div class="row ${cls}${this.sel[this.tab] === i ? ' sel' : ''}" data-row="${i}">${cells.map(c => `<span>${c}</span>`).join('')}</div>`;
  }

  private portTab(s: GameState): string {
    const p = port(s.docked!);
    const space = fuelMax(s) - s.ship.fuel;
    const report = s.report.map(l =>
      `<div class="line"><span>${esc(l.text)}</span>${l.amount === undefined ? '' : `<span class="${l.amount < 0 ? 'neg' : ''}">${signed(l.amount)}</span>`}</div>`).join('');
    return `
      <div class="dim">${esc(p.blurb)}</div>
      <div class="sect">Arrival report</div>
      ${report || '<div class="dim">Nothing to report.</div>'}
      <div class="sect">Fuel dock - ${p.fuelPrice.toFixed(1)} cr per unit</div>
      ${this.row(0, 'r-port', ['Fill the tank', `${Math.round(space)} units`, `${num(Math.ceil(space * p.fuelPrice))} cr`])}
      ${this.row(1, 'r-port', ['Take on 10', `${Math.round(Math.min(10, space))} units`, `${num(Math.ceil(Math.min(10, space) * p.fuelPrice))} cr`])}`;
  }

  private jobsTab(s: GameState): string {
    const board = s.boards[s.docked!];
    if (!board.length) return `<div class="dim">The board's empty. Try another port.</div>`;
    const free = cargoMax(s) - holdTons(s);
    const rows = board.map((j, i) => this.row(i, `r-jobs${j.tons > free ? ' nofit' : ''}`, [
      esc(j.cargo), esc(port(j.to).name), `${j.tons} t`, `Day ${j.due}`, `${num(j.pay)} cr`, j.kind,
    ])).join('');
    const j = board[this.sel.jobs];
    return `
      <div class="row r-jobs dim"><span>Cargo</span><span>To</span><span>Load</span><span>Due</span><span>Pays</span><span>Type</span></div>
      ${rows}
      <div class="sect">From ${esc(j.client)}</div>
      <div>${esc(j.note)}</div>
      <div class="dim">${j.tons > free ? `Won't fit: needs ${j.tons} t, ${free} t free.` : `Needs ${j.tons} t of your ${free} t free.`} Late delivery pays 60%.</div>`;
  }

  private holdTab(s: GameState): string {
    if (!s.hold.length) return `<div class="dim">The hold is empty. ${s.docked ? 'Take work from the jobs board.' : 'Dock somewhere and find work.'}</div>`;
    const rows = s.hold.map((j, i) => this.row(i, 'r-hold', [
      esc(j.cargo), esc(port(j.to).name), `${j.tons} t`, s.day > j.due ? 'Late' : `Day ${j.due}`, `${num(j.pay)} cr`,
    ])).join('');
    return `
      <div class="row r-hold dim"><span>Cargo</span><span>Deliver to</span><span>Load</span><span>Due</span><span>Pays</span></div>
      ${rows}
      <div class="sect">Manifest</div>
      <div class="dim">${holdTons(s)} of ${cargoMax(s)} t used. ${s.stats.delivered} jobs delivered, ${num(s.stats.earned)} cr earned to date.</div>`;
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
      <div class="dim">${s.credits < 0 ? "Settle your tab before you talk to me about fittings." : 'Cash up front. No tabs, no trades.'}</div>`;
  }

  private navTab(s: GameState): string {
    const ship = s.ship;
    const rows = PORTS.map((p, i) => {
      const d = Math.hypot(p.x - ship.x, p.y - ship.y);
      const drops = s.hold.filter(j => j.to === p.id).length;
      const here = p.id === s.docked;
      return this.row(i, 'r-nav', [
        `${p.id === s.target ? '&gt;' : '&nbsp;'} ${esc(p.name)}`,
        here ? 'Here' : mm(d),
        here ? '' : `${fuelFor(s, d)} f`,
        drops ? `${drops} drop${drops > 1 ? 's' : ''}` : '',
      ]);
    }).join('');
    return `<div class="nav">${this.navMap(s)}<div>
      <div class="row r-nav dim"><span>&nbsp; Port</span><span>Range</span><span>Fuel</span><span>Cargo</span></div>
      ${rows}
      <div class="sect">Course</div>
      <div class="dim">${s.target ? `Laid in for ${esc(port(s.target).name)}.` : 'None laid in.'} In flight, Q engages the autopilot.</div>
    </div></div>`;
  }

  private navMap(s: GameState): string {
    let grid = '';
    for (let x = -1500; x <= 3000; x += 500) grid += `M${x},-1100V2900`;
    for (let y = -1000; y <= 2900; y += 500) grid += `M-1500,${y}H3000`;
    const selected = PORTS[this.sel.nav];
    const ports = PORTS.map(p => `
      <circle cx="${p.x}" cy="${p.y}" r="70"/>
      ${s.hold.some(j => j.to === p.id) ? `<circle cx="${p.x}" cy="${p.y}" r="28" class="fill"/>` : ''}
      ${p === selected ? `<circle cx="${p.x}" cy="${p.y}" r="150" class="dash"/>` : ''}
      ${p.id === s.target ? `<path d="M${p.x - 210},${p.y - 120}v-90h90M${p.x + 120},${p.y - 210}h90v90M${p.x + 210},${p.y + 120}v90h-90M${p.x - 120},${p.y + 210}h-90v-90"/>` : ''}
      <text x="${p.x}" y="${p.y + 400}">${esc(p.name)}</text>`).join('');
    const t = s.target ? port(s.target) : null;
    return `<svg class="map" viewBox="-1500 -1100 4500 4000" role="img" aria-label="System map">
      <path d="${grid}" class="grid"/>
      ${t ? `<path d="M${s.ship.x.toFixed(0)},${s.ship.y.toFixed(0)}L${t.x},${t.y}" class="dash"/>` : ''}
      ${ports}
      <path d="M130,0L-80,-75L-80,75Z" class="fill" transform="translate(${s.ship.x.toFixed(0)} ${s.ship.y.toFixed(0)}) rotate(${((s.ship.angle * 180) / Math.PI).toFixed(0)})"/>
    </svg>`;
  }
}
