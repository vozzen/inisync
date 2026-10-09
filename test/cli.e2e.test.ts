import {afterEach, beforeEach, describe, expect, test} from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import {parse} from 'ini';
import {
  makeTempDir,
  READY_MESSAGE,
  RunningCli,
  startCli,
  waitFor,
} from './cli-helpers';

// End-to-end tests: run the real CLI, drop a matching file into the watched
// directory, and verify the target file is merged, backed up, and the watched
// file is handled as configured.
describe('CLI end-to-end workflow', () => {
  let dir: string;
  let targetPath: string;
  let cli: RunningCli | undefined;

  const start = async (
    extraArgs: string[] = [],
    pattern = path.join(dir, 'aws_sts*.txt'),
  ) => {
    cli = startCli(['--watch', pattern, '--target', targetPath, ...extraArgs]);
    await cli.waitForOutput(READY_MESSAGE);
  };

  const backups = () =>
    fs.readdirSync(dir).filter(name => /^credentials\.\d+\.bak$/.test(name));

  beforeEach(() => {
    dir = makeTempDir();
    targetPath = path.join(dir, 'credentials');
  });

  afterEach(async () => {
    await cli?.stop();
    cli = undefined;
    fs.rmSync(dir, {recursive: true, force: true});
  });

  test('merges a new file into the target, backs up, and removes it', async () => {
    const original = '[default]\nkey=old\n\n[other]\nkey=keep\n';
    fs.writeFileSync(targetPath, original);
    await start();

    const incoming = path.join(dir, 'aws_sts_token.txt');
    fs.writeFileSync(incoming, '[default]\nkey=new\n\n[added]\nkey=value\n');

    await cli!.waitForOutput('Syncing complete.');
    await waitFor(() => !fs.existsSync(incoming));

    expect(parse(fs.readFileSync(targetPath, 'utf-8'))).toEqual({
      default: {key: 'new'},
      other: {key: 'keep'},
      added: {key: 'value'},
    });

    const backupFiles = backups();
    expect(backupFiles).toHaveLength(1);
    expect(fs.readFileSync(path.join(dir, backupFiles[0]), 'utf-8')).toBe(
      original,
    );
  }, 20_000);

  test('creates the target file if it does not exist', async () => {
    await start();

    fs.writeFileSync(path.join(dir, 'aws_sts.txt'), '[default]\nkey=value\n');

    await cli!.waitForOutput('Syncing complete.');
    expect(parse(fs.readFileSync(targetPath, 'utf-8'))).toEqual({
      default: {key: 'value'},
    });
  }, 20_000);

  test('keeps the watched file with --no-delete-watched-file', async () => {
    await start(['--no-delete-watched-file']);

    const incoming = path.join(dir, 'aws_sts.txt');
    fs.writeFileSync(incoming, '[default]\nkey=value\n');

    await cli!.waitForOutput('Syncing complete.');
    expect(fs.existsSync(incoming)).toBe(true);
    expect(parse(fs.readFileSync(targetPath, 'utf-8'))).toEqual({
      default: {key: 'value'},
    });
  }, 20_000);

  test('ignores files that do not match the pattern', async () => {
    fs.writeFileSync(targetPath, '[default]\nkey=old\n');
    await start();

    const unrelated = path.join(dir, 'notes.txt');
    fs.writeFileSync(unrelated, '[default]\nkey=new\n');
    // Then drop a matching file so we know the watcher has processed events.
    fs.writeFileSync(path.join(dir, 'aws_sts.txt'), '[marker]\nkey=1\n');

    await cli!.waitForOutput('Syncing complete.');
    expect(fs.existsSync(unrelated)).toBe(true);
    expect(parse(fs.readFileSync(targetPath, 'utf-8'))).toEqual({
      default: {key: 'old'},
      marker: {key: '1'},
    });
  }, 20_000);

  test('matches nested files with a ** pattern', async () => {
    await start([], path.join(dir, '**', 'aws_sts*.txt'));

    const nested = path.join(dir, 'a', 'b');
    fs.mkdirSync(nested, {recursive: true});
    // Give the watcher time to notice the new directories before the file.
    await new Promise(resolve => setTimeout(resolve, 500));
    fs.writeFileSync(path.join(nested, 'aws_sts.txt'), '[nested]\nkey=1\n');

    await cli!.waitForOutput('Syncing complete.');
    expect(parse(fs.readFileSync(targetPath, 'utf-8'))).toEqual({
      nested: {key: '1'},
    });
  }, 20_000);

  test('does not look in subdirectories for a flat pattern', async () => {
    fs.mkdirSync(path.join(dir, 'sub'));
    await start();

    const deep = path.join(dir, 'sub', 'aws_sts.txt');
    fs.writeFileSync(deep, '[deep]\nkey=1\n');
    // Then drop a matching top-level file so we know events were processed.
    fs.writeFileSync(path.join(dir, 'aws_sts.txt'), '[top]\nkey=1\n');

    await cli!.waitForOutput('Syncing complete.');
    expect(fs.existsSync(deep)).toBe(true);
    expect(parse(fs.readFileSync(targetPath, 'utf-8'))).toEqual({
      top: {key: '1'},
    });
  }, 20_000);

  test('watches a literal file path that does not exist yet', async () => {
    await start([], path.join(dir, 'incoming.txt'));

    fs.writeFileSync(path.join(dir, 'incoming.txt'), '[lit]\nkey=1\n');

    await cli!.waitForOutput('Syncing complete.');
    expect(parse(fs.readFileSync(targetPath, 'utf-8'))).toEqual({
      lit: {key: '1'},
    });
  }, 20_000);
});
