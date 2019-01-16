#! /usr/bin/env node

require('moment-timezone');
const argv = require('yargs').argv
const branch = require('git-branch');
const childProcess = require('child_process');
const slashes = require('remove-trailing-slash');
const cwd = require('path').resolve();
const jsonfile = require('jsonfile');
const moment = require('moment');

const commonPath = slashes(cwd);
const localPackageJson = require(`${commonPath}/package.json`);

const buildEnv = argv.env || process.env.NODE_ENV || process.env.PROFILE || 'development';
const srcFolder = slashes(argv['src-folder']);
const timeZone = 'America/Toronto';

const file = `${commonPath}/${srcFolder}/meta.json`;

function getTime() {
  const now = new Date();
  const edtTz = timeZone;
  const dateFormat = 'MM-DD-YYYY hh:mm:ss A [ET]';

  return moment(now).tz(edtTz).format(dateFormat);
}

function wrap(func, val) {
  // const value = func();
  console.log('func:', func);
  console.log('val:', val);

  // if (value) {
  //   return value;
  // } else {
  //   setTimeout(() => {
  //     wrap(func);
  //   }, 100);
  // }
}

function promise(customFunction) {
  const maxRetries = 5;
  let retryTimer = null;
  let retries = 0;
  let data = null;

  return new Promise((resolve, reject) => {
    function retryFunction() {
      data = customFunction();
  
      if (data) {
        clearInterval(retryTimer);
        resolve(data);
      } else if (retries < maxRetries) {
        reject();
      } else {
        retries += 1;
        console.log(`retry # ${retries}`);
        retryTimer = setInterval(retryFunction, 100);
      }
    }

    retryFunction();
  })
};

function showBuildMeta() {
  // let lastCommitHash = null;
  // let lastCommitAuthor = null;

  const meta = {};

  // let returnFunc = (bErr, bName) => {
  //   if (bErr) {
  //     console.warn(`git branch name error: ${bErr}`);
  //     return null;
  //   } else {
  //     console.log(`RESOLVED: ${bName}`);
  //     meta['branchName'] = bName;
  //     console.log('meta:', meta);
  //     return bName;
  //   }
  // };

  const foo = (bErr, bName) => {
    console.log('branch()');
    resolve(1234);
    // if (bErr) {
    //   console.warn(`git branch name error: ${bErr}`);
    //   return null;
    // } else {
    //   console.log(`RESOLVED: ${bName}`);
    //   meta['branchName'] = bName;
    //   console.log('meta:', meta);
    //   resolve(bName);
    //   return bName;
    // }
  }

  const branchName = promise(branch.bind(this, foo)).then((data) => {
    console.log('1 | promise resolved', data);
  });

  // console.log('meta:', meta);

  // let branchName = wrap(branchFunc)
  // console.log('branchName:', branchName);


  // childProcess.exec('git rev-parse HEAD', (commitHashError, commitHash) => {
  //   commitHashError && console.warn(`process exec error: ${commitHashError}`);

  //   lastCommitHash = commitHash;
  //   console.log('lastCommitHash:', lastCommitHash);

  //   return this;
  // });

  // childProcess.exec('git log -1 --pretty=format:\'%an\'', (commitAuthorError, commitAuthor) => {
  //   commitAuthorError && console.warn(`process exec error: ${commitAuthorError}`);

  //   lastCommitAuthor = commitAuthor;
  //   console.log('lastCommitAuthor:', lastCommitAuthor);
  // });

  // const meta = {
  //   version: localPackageJson.version,
  //   buildDate: getTime(),
  //   buildEnv,
  //   branchName,
  //   lastCommitAuthor,
  //   lastCommitHash,
  // };

  // console.log('META:', meta);

  // jsonfile.writeFile(file, meta, {
  //   spaces: 2
  // }, (err) => {
  //   err && console.warn(`write file error: ${err}`);
  // });
}

showBuildMeta();
