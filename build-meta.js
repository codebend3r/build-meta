#! /usr/bin/env node

require('moment-timezone');
const cwd = require('path').resolve();
const jsonfile = require('jsonfile');
const branch = require('git-branch');
const moment = require('moment');
const childProcess = require('child_process');
const localPackageJson = require(`${cwd}/package.json`);

const buildEnv = process.env.NODE_ENV || process.env.PROFILE || 'development';

const file = './src/meta.json';

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

      jsonfile.writeFile(file, meta, {
        spaces: 2
      }, (err) => {
        err && console.warn(`WRITE FILE ERR: ${err}`);
      });
    });
  });
}

showBuildMeta();
