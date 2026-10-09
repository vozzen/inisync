import path = require('path');
import picomatch = require('picomatch');
import type {Stats} from 'fs';

export interface WatchSpec {
  /** What to hand to chokidar: the static directory part of the pattern. */
  target: string;
  /** How many directory levels below target can contain matches. */
  depth?: number;
  /** chokidar `ignored` matcher. Skips files that do not match the pattern. */
  ignored?: (filePath: string, stats?: Stats) => boolean;
}

const toPosix = (p: string) =>
  path.sep === '\\' ? p.split(path.sep).join('/') : p;

/**
 * chokidar 4+ no longer understands glob patterns. Split the pattern into the
 * static directory to watch and a matcher that filters files inside it.
 */
export const createWatchSpec = (pattern: string): WatchSpec => {
  const {base, glob, isGlob} = picomatch.scan(toPosix(pattern));
  const target = path.resolve(base);
  if (!isGlob) {
    return {target};
  }

  const isMatch = picomatch(`${toPosix(target)}/${glob}`);
  // Without `**` or braces the pattern has a fixed number of path segments, so
  // there is no need to watch deeper than that.
  const unbounded = glob.includes('**') || glob.includes('{');
  return {
    target,
    depth: unbounded ? undefined : glob.split('/').length - 1,
    // Directories are never ignored, otherwise chokidar would not descend.
    ignored: (filePath, stats) =>
      !!stats?.isFile() && !isMatch(toPosix(path.resolve(filePath))),
  };
};
