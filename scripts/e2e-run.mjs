// Cross-platform runner for the opt-in practice E2E suite.
//   node scripts/e2e-run.mjs            → run, transcripts printed (no API judge)
//   node scripts/e2e-run.mjs --judge    → also run the LLM judge (extra API cost)
import { spawn } from 'child_process';

const judge = process.argv.includes('--judge');
const env = { ...process.env, E2E_RUN: '1' };
if (judge) env.E2E_JUDGE = '1';

const args = ['playwright', 'test', 'e2e/practice-flow.spec.ts', '--project=chromium', '--workers=1', '--reporter=list'];
const child = spawn('npx', args, { stdio: 'inherit', env, shell: true });
child.on('exit', (code) => process.exit(code ?? 1));
