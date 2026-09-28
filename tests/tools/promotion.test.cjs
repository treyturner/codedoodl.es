const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const digest = 'sha256:' + 'a'.repeat(64);
const candidate = 'candidate-' + 'b'.repeat(40) + '-123-1';

test('promotion preserves immutable bytes and validates both mirrors before writing', t => {
  const cwd = mkdtempSync(join(tmpdir(), 'codedoodles-release-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const log = join(cwd, 'commands.jsonl');
  writeFileSync(join(cwd, 'docker'), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.TEST_LOG, JSON.stringify(args)+'\\n');
if (args[2] === 'inspect') console.log(JSON.stringify({ digest: process.env.TEST_MISMATCH && args[3].startsWith('forgejo.') ? 'sha256:'+'c'.repeat(64) : process.env.TEST_DIGEST }));
else if (args[2] !== 'create') process.exit(1);
`, { mode: 0o755 });
  const run = (args, environment = {}) => {
    writeFileSync(log, '');
    const result = spawnSync('bash', [resolve(__dirname, '../../scripts/promote-image.sh'), ...args], {
      encoding: 'utf8', env: { ...process.env, PATH: `${cwd}:${process.env.PATH}`, GITHUB_REF: 'refs/heads/master', TEST_LOG: log, TEST_DIGEST: digest, ...environment },
    });
    return { ...result, commands: readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) };
  };
  const dry = run(['owner', candidate, digest]);
  assert.equal(dry.status, 0, dry.stderr);
  assert.equal(dry.commands.length, 2);
  assert.ok(dry.commands.every(args => args[2] === 'inspect'));
  const applied = run(['owner', candidate, digest, '--apply']);
  assert.equal(applied.status, 0, applied.stderr);
  assert.deepEqual(applied.commands.slice(0, 2).map(args => args[2]), ['inspect', 'inspect']);
  const writes = applied.commands.filter(args => args[2] === 'create');
  assert.equal(writes.length, 2);
  for (const args of writes) {
    assert.ok(args.includes('--prefer-index=false'));
    assert.ok(args.at(-1).endsWith('@' + digest));
    assert.ok(args.at(-2).endsWith(':latest'));
  }
  const mismatch = run(['owner', candidate, digest, '--apply'], { TEST_MISMATCH: '1' });
  assert.equal(mismatch.status, 1);
  assert.ok(mismatch.commands.every(args => args[2] === 'inspect'));
  for (const args of [['owner', 'latest', digest], ['owner', candidate, 'sha256:no'], ['bad/owner', candidate, digest]]) {
    const invalid = run(args);
    assert.equal(invalid.status, 1);
    assert.equal(invalid.commands.length, 0);
  }
  const branch = run(['owner', candidate, digest, '--apply'], { GITHUB_REF: 'refs/heads/feat/modernize' });
  assert.equal(branch.status, 1);
  assert.equal(branch.commands.length, 0);
});
