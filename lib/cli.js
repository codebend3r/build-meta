var metaData = null;

function setMetaData(d) {
  console.log('SET | meta data');
  metaData = d;
}

function getMetaData() {
  console.log('GET | meta data');
  return metaData;
}

function setMetaDataToWindow(namespace) {
  if (!window) {
    return false;
  } else {
    console.log('SET | saving meta data to window');
    window[namespace] = window[namespace] || {};
    window[namespace].meta = window[namespace].meta || metaData

    return true;
  }
}

module.exports = {
  setMetaData,
  getMetaData,
  setMetaDataToWindow,
}
