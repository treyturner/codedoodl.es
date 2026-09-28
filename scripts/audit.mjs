import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const output = resolve(process.argv[2] || 'tests/artifacts/security');
mkdirSync(output, { recursive: true });
let failed = false;
for (const [name, directory, extra] of [
  ['runtime', '.', ['--omit=dev']], ['build', '.', []], ['tests', 'tests', []],
]) {
  const result = spawnSync('npm', ['audit', '--package-lock-only', '--json', ...extra], { cwd: directory, encoding: 'utf8' });
  writeFileSync(`${output}/npm-${name}.json`, result.stdout || '{}');
  let report;
  try { report = JSON.parse(result.stdout); } catch { /* handled below */ }
  if (result.error || ![0, 1].includes(result.status) || report?.error || !report?.metadata?.vulnerabilities) {
    console.error(`${name}: audit failed to obtain a report`);
    failed = true;
    continue;
  }
  const counts = report.metadata.vulnerabilities;
  console.log(`${name}: ${JSON.stringify(counts)}`);
  if (counts.high || counts.critical) failed = true;
}
if (failed) process.exitCode = 1;
