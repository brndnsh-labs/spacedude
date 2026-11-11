// Browser check: starts the dev server, plays the game through with playwright-cli, and reports.
// Run with `npm run e2e`. Needs playwright-cli on the PATH (https://github.com/microsoft/playwright-cli).
// The play-through itself is e2e/smoke.js.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const PORT = 5199; // e2e/smoke.js goes to the same port
const SESSION = 'spacedude-e2e';
const cli = (...args) => execFileSync('playwright-cli', [`-s=${SESSION}`, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

async function serverUp(url, seconds) {
  for (let i = 0; i < seconds * 10; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not listening yet
    }
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error(`dev server did not come up at ${url}`);
}

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
let failed = true;
try {
  await serverUp(`http://localhost:${PORT}/`, 20);
  // A machine-local .playwright/cli.config.json picks the browser; without one, use Playwright's own Chromium.
  cli('open', `http://localhost:${PORT}/`, ...(existsSync('.playwright/cli.config.json') ? [] : ['--browser=chromium']));
  const result = JSON.parse(cli('--raw', 'run-code', '--filename=e2e/smoke.js'));
  for (const step of result.steps) console.log(`${step.ok ? 'ok  ' : 'FAIL'}  ${step.name}${step.ok ? '' : `  ${JSON.stringify(step.detail)}`}`);
  if (result.error) console.log(`\n${result.error}`);
  failed = !result.ok;
  console.log(failed ? '\nBrowser check failed.' : `\nBrowser check passed: ${result.steps.length} steps.`);
} catch (e) {
  console.error(e.stderr || e.stdout || e.message || e);
} finally {
  try {
    cli('close');
  } catch {
    // no browser to close
  }
  server.kill();
}
process.exit(failed ? 1 : 0);
