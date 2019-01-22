var metaData = null;

function setMetaData(d) {
  metaData = d;
}

function getMetaData() {
  return metaData;
}

function setMetaDataToWindow({
  namespace,
  meta,
}) {
  if (!window) {
    return false;
  } else {
    window[namespace] = window[namespace] || {};
    window[namespace].meta = window[namespace].meta || meta

    return true;
  }
}

module.exports = {
  setMetaData,
  getMetaData,
  setMetaDataToWindow,
}
