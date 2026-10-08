import {afterEach, describe, expect, test} from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import {
  makeTempDir,
  READY_MESSAGE,
  runCli,
  RunningCli,
  startCli,
} from './cli-helpers';

// Smoke tests: the CLI starts and its runtime dependencies (commander, pino,
// pino-pretty, chokidar) load and work together. Meant to catch breaking
// dependency updates that the unit tests cannot see.
describe('CLI smoke test', () => {
  let cli: RunningCli | undefined;

  afterEach(async () => {
    await cli?.stop();
    cli = undefined;
  });

  test('prints the package version', () => {
    const result = runCli(['--version']);
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf-8'),
    );

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(pkg.version);
  });

  test('prints help with all options', () => {
    const result = runCli(['--help']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('--watch <pattern>');
    expect(result.stdout).toContain('--target <path>');
    expect(result.stdout).toContain('--no-delete-watched-file');
  });

  test('starts watching and keeps running', async () => {
    const dir = makeTempDir();
    cli = startCli([
      '--watch',
      path.join(dir, 'incoming*.txt'),
      '--target',
      path.join(dir, 'credentials'),
    ]);

    await cli.waitForOutput(READY_MESSAGE);
    expect(cli.process.exitCode).toBeNull();
    expect(cli.output()).not.toMatch(/ERROR/);
  }, 20_000);
});
