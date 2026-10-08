#!/usr/bin/env node

import * as chokidar from 'chokidar';
import log from './log';
import {defaultConfig, Config} from './config';
import {syncIniFiles} from './ini-sync';
import path = require('path');
import {program} from 'commander';

function parseCommandline(): Config {
  const applicationConfig: Config = defaultConfig;
  const options: {target: string; watch: string; deleteWatchedFile: boolean} =
    program
      .option(
        '-w, --watch <pattern>',
        'Path pattern to watch for new ini files, such as /Users/user/Downloads/aws_sts*.txt',
        path.join(applicationConfig.watchPath, applicationConfig.watchPattern),
      )
      .option(
        '-t, --target <path>',
        'File path of target ini file.',
        defaultConfig.credentialsPath,
      )
      .option(
        '--no-delete-watched-file',
        'Keep watched files after processing.',
      )
      .version(require('./version').LIB_VERSION)
      .parse()
      .opts();

  log.info(`Using the following configuration: ${JSON.stringify(options)}`);
  return {
    credentialsPath: options.target,
    watchPath: path.dirname(options.watch),
    watchPattern: path.basename(options.watch),
    keepWatchedFile: !options.deleteWatchedFile,
  };
}
const applicationConfig = parseCommandline();
log.debug(
  `Using the following configuration: ${JSON.stringify(applicationConfig)}`,
);

const patternToWatch = path.join(
  applicationConfig.watchPath,
  applicationConfig.watchPattern,
);

const watcher = chokidar.watch(patternToWatch, {ignoreInitial: true});

watcher.on('ready', () => {
  log.info(`Watching for new files matching: ${patternToWatch}`);
});

watcher.on('add', path => {
  log.info(
    `A new matching file has been detected at path: ${path}. Syncing...`,
  );
  try {
    syncIniFiles(
      path,
      applicationConfig.credentialsPath,
      applicationConfig.keepWatchedFile,
    );
    log.info('Syncing complete.');
  } catch (e) {
    log.error(`Error syncing file: ${e}`);
  }
});
