const jsonfile = require('jsonfile');
const branch = require('git-branch');
const moment = require('moment');
require('moment-timezone');
const childProcess = require('child_process');
const pjson = require('../package.json');

const file = './src/meta.json';

function getTime() {
  const now = new Date();
  const edtTz = 'America/Toronto';
  const dateFormat = 'MM-DD-YYYY hh:mm:ss A [ET]';

  return moment(now).tz(edtTz).format(dateFormat);
}

function showBuildMeta() {
  const env = process.argv[2];
  branch((branchErr, branchName) => {
    branchErr && console.warn(`GIT GET CURRENT BRANCH ERR: ${branchErr}`);

    childProcess.exec('git log -1 --pretty=format:\'%an\'', (processErr, author) => {

      processErr && console.warn(`PROCESS EXEC ERROR: ${processErr}`);

      const meta = {
        version: pjson.version,
        buildDate: getTime(),
        buildEnv: env,
        branchName,
        lastCommitBy: author
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
