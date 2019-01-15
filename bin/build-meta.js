#! /usr/bin/env node

require('moment-timezone');
const argv = require('yargs').argv
const branch = require('git-branch');
const childProcess = require('child_process');
const slashes = require('remove-trailing-slash');
const cwd = require('path').resolve();
const jsonfile = require('jsonfile');
const moment = require('moment');
const buildMetaCli = require('../lib/cli');

const commonPath = slashes(cwd);
const localPackageJson = require(`${commonPath}/package.json`);

const buildEnv = argv.env || process.env.NODE_ENV || process.env.PROFILE || 'development';
const srcFolder = slashes(argv['src-folder']);

const file = `${commonPath}/${srcFolder}/meta.json`;

function getTime() {
  const now = new Date();
  const edtTz = 'America/Toronto';
  const dateFormat = 'MM-DD-YYYY hh:mm:ss A [ET]';

  return moment(now).tz(edtTz).format(dateFormat);
}

function showBuildMeta() {
  branch((branchErr, branchName) => {
    branchErr && console.warn(`GIT GET CURRENT BRANCH ERR: ${branchErr}`);

    childProcess.exec('git log -1 --pretty=format:\'%an\'', (processErr, lastCommitAuthor) => {

      processErr && console.warn(`PROCESS EXEC ERROR: ${processErr}`);

      const meta = {
        version: localPackageJson.version,
        buildDate: getTime(),
        buildEnv,
        branchName,
        lastCommitAuthor
      };

      console.log(meta);

      buildMetaCli.setMetaData(meta);

      jsonfile.writeFile(file, meta, {
        spaces: 2
      }, (err) => {
        err && console.warn(`WRITE FILE ERR: ${err}`);
      });
    });
  });
}

showBuildMeta();
