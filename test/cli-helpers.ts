import {spawn, spawnSync, ChildProcess} from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Tests run against the compiled CLI, exactly as users get it from npm.
// `npm test` compiles first via the "pretest" script.
export const CLI_PATH = path.resolve(
  __dirname,
  '..',
  'build',
  'src',
  'index.js',
);

export const READY_MESSAGE = 'Watching for new files matching';

export const makeTempDir = (): string =>
  fs.mkdtempSync(path.join(os.tmpdir(), 'inisync-test-'));

export const runCli = (args: string[]) =>
  spawnSync(process.execPath, [CLI_PATH, ...args], {
    encoding: 'utf-8',
    timeout: 10_000,
  });

export interface RunningCli {
  process: ChildProcess;
  output: () => string;
  waitForOutput: (text: string, timeoutMs?: number) => Promise<void>;
  stop: () => Promise<void>;
}

export const startCli = (args: string[]): RunningCli => {
  const child = spawn(process.execPath, [CLI_PATH, ...args]);
  let output = '';
  child.stdout.on('data', chunk => (output += chunk));
  child.stderr.on('data', chunk => (output += chunk));

  const waitForOutput = (text: string, timeoutMs = 10_000) =>
    waitFor(
      () => output.includes(text),
      timeoutMs,
      () => {
        return `Timed out waiting for "${text}". Output so far:\n${output}`;
      },
    );

  const stop = () =>
    new Promise<void>(resolve => {
      if (child.exitCode !== null || child.signalCode !== null) {
        resolve();
        return;
      }
      child.once('exit', () => resolve());
      child.kill();
    });

  return {process: child, output: () => output, waitForOutput, stop};
};

export const waitFor = async (
  condition: () => boolean,
  timeoutMs = 10_000,
  describe: () => string = () => 'Timed out waiting for condition',
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) {
      throw new Error(describe());
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
};
