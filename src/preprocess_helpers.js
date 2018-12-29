const tracerData = require('../glsl/index.js');
const preprocessFile = require('./preprocess_file.js');

function preprocess(mainFile, defines) {
  const paths = {};
  const overrides = {};
  Object.keys(defines).forEach((target) => {
    const v = defines[target];
    if (v.file) {
      paths[target] = v.file;
    } else if (v.hasOwnProperty('source')) {
      overrides[target] = v.source;
    } else {
      throw new Error('no file nor source defined');
    }
  });

  const files = Object.assign({}, tracerData, overrides);
  return preprocessFile(mainFile, paths, files);
}

module.exports = {
  preprocess
};
