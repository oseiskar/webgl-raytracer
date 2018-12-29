function preprocessFile(mainFile, includeMapping, files) {
  // this might break down if utilizing heavy preprocessor magic near
  // the #include directive
  function getIncludeTarget(l) {
    const line = l.trim('');
    // try to handle commented includes... not bulletproof
    if (line.startsWith('//') || line.startsWith('/*')) return null;

    const pattern = /^#include\s*["<]([^">]+)/;
    const match = pattern.exec(line);
    return match && match[1];
  }

  function isString(str) {
    // https://stackoverflow.com/a/17772086/1426569
    return Object.prototype.toString.call(str) === '[object String]';
  }

  function getFile(fn) {
    if (!fn || fn === '') {
      throw new Error('no file name given');
    }
    const parts = fn.split('/');
    let data = files;
    while (parts.length > 0 && data) {
      data = data[parts.shift()];
    }
    if (!isString(data)) {
      throw new Error(`'${fn}' file not found`);
    }
    return data;
  }

  const included = {};

  function resolveTarget(target) {
    return includeMapping[target] || target;
  }

  function preprocess(source) {
    const result = [];
    source.split('\n').forEach((line) => {
      // find include directive
      const includeTarget = getIncludeTarget(line);
      if (includeTarget) {
        if (!included[includeTarget]) {
          included[includeTarget] = true;
          const resolved = resolveTarget(includeTarget);
          if (!resolved) throw new Error(`#include <${includeTarget}> not specified`);
          // eslint-disable-next-line no-use-before-define
          result.push(doPreprocess(resolved));
        }
      } else if (line) {
        result.push(line);
      }
    });
    return result.join('\n');
  }

  function doPreprocess(fileName) {
    return preprocess(getFile(fileName));
  }

  return doPreprocess(mainFile);
}

module.exports = preprocessFile;
