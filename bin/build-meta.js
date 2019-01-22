#! /usr/bin/env node

require('moment-timezone');
const argv = require('yargs').argv
const branch = require('git-branch');
const childProcess = require('child_process');
const slashes = require('remove-trailing-slash');
const cwd = require('path').resolve();
const jsonfile = require('jsonfile');
const moment = require('moment');
const git = require('git-last-commit');

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
  let lastCommitHash = null;
  let lastCommitAuthor = null;
  let branchName = null;

  branch((bError, bName) => {
    bError && console.warn(`git current branch error: ${bError}`);

    branchName = bName;

    childProcess.exec('git rev-parse HEAD', (commitHashError, commitHash) => {
      commitHashError && console.warn(`process exec error: ${commitHashError}`);
  
      lastCommitHash = commitHash;
  
      childProcess.exec('git log -1 --pretty=format:\'%an\'', (commitAuthorError, commitAuthor) => {
        commitAuthorError && console.warn(`process exec error: ${commitAuthorError}`);
    
        lastCommitAuthor = commitAuthor;

        const meta = {
          version: localPackageJson.version,
          buildDate: getTime(),
          buildEnv,
          branchName,
          lastCommitAuthor,
          lastCommitHash,
        };
      
        console.info({ meta });
      
        jsonfile.writeFile(file, meta, {
          spaces: 2
        }, (err) => {
          err && console.warn(`write file error: ${err}`);
        });
      });
    });
  });
}

showBuildMeta();
