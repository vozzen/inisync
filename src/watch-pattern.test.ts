import {describe, expect, test} from '@jest/globals';
import type {Stats} from 'fs';
import * as path from 'path';
import {createWatchSpec} from './watch-pattern';

const file = {isFile: () => true} as Stats;
const dir = {isFile: () => false} as Stats;

describe('createWatchSpec', () => {
  test('watches the directory of a file name pattern', () => {
    const spec = createWatchSpec('/data/downloads/aws_sts*.txt');

    expect(spec.target).toBe(path.resolve('/data/downloads'));
    expect(spec.depth).toBe(0);
  });

  test('only ignores files that do not match the pattern', () => {
    const {ignored} = createWatchSpec('/data/downloads/aws_sts*.txt');

    expect(ignored!('/data/downloads/aws_sts_1.txt', file)).toBe(false);
    expect(ignored!('/data/downloads/notes.txt', file)).toBe(true);
    expect(ignored!('/data/downloads/sub/aws_sts_1.txt', file)).toBe(true);
  });

  test('never ignores directories or paths without stats', () => {
    const {ignored} = createWatchSpec('/data/downloads/aws_sts*.txt');

    expect(ignored!('/data/downloads/sub', dir)).toBe(false);
    expect(ignored!('/data/downloads/notes.txt')).toBe(false);
  });

  test('limits depth to the number of path segments in the pattern', () => {
    expect(createWatchSpec('/data/*/aws*.txt').depth).toBe(1);
    expect(createWatchSpec('/data/*/*/aws*.txt').depth).toBe(2);
  });

  test('does not limit depth for ** and brace patterns', () => {
    expect(createWatchSpec('/data/**/aws*.txt').depth).toBeUndefined();
    expect(createWatchSpec('/data/{a,b/c}/aws*.txt').depth).toBeUndefined();
  });

  test('matches nested files for ** patterns', () => {
    const {ignored} = createWatchSpec('/data/**/aws*.txt');

    expect(ignored!('/data/aws_1.txt', file)).toBe(false);
    expect(ignored!('/data/a/b/aws_1.txt', file)).toBe(false);
    expect(ignored!('/data/a/b/other.txt', file)).toBe(true);
  });

  test('watches a literal file path as is, without filtering', () => {
    const spec = createWatchSpec('/data/downloads/credentials.txt');

    expect(spec.target).toBe(path.resolve('/data/downloads/credentials.txt'));
    expect(spec.ignored).toBeUndefined();
    expect(spec.depth).toBeUndefined();
  });

  test('resolves relative patterns against the working directory', () => {
    const {target, ignored} = createWatchSpec('downloads/aws*.txt');

    expect(target).toBe(path.resolve('downloads'));
    expect(ignored!(path.resolve('downloads/aws_1.txt'), file)).toBe(false);
    expect(ignored!(path.resolve('downloads/other.txt'), file)).toBe(true);
  });
});
