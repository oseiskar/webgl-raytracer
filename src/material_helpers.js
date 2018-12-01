
function convertToGrayscale(property, value) {
  // if already a number
  if (Number.isFinite(value)) return value;
  // if RGB
  if (value.length === 3) return (value[0]+value[1]+value[2])/3;

  throw new Error(`cannot convert ${JSON.stringify(value)} to scalar ${property}`);
}

function convertToRgb(property, value) {
  const isScalar = {
    'ior': true
  };
  if (isScalar[property]) {
    return convertToGrayscale(property, value);
  }

  // scalar
  if (Number.isFinite(value)) return [value, value, value];
  if (value.length === 3) return value;

  throw new Error(`cannot convert ${JSON.stringify(value)} to RGB ${property}`);
}

function autoConvert(material, toType) {
  const convert = {
    grayscale: convertToGrayscale,
    rgb: convertToRgb
  }[toType];

  const converted = {};
  Object.keys(material).forEach(key => {
    const newMat = {};
    const srcMat = material[key];
    Object.keys(srcMat).forEach(property => {
      newMat[property] = convert(property, srcMat[property]);
    });
    converted[key] = newMat;
  });
  return converted;
}

module.exports = {
  autoConvert
}
