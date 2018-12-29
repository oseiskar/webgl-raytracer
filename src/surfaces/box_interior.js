const tracerData = require('../../glsl/index.js');
const autoName = require('../auto_tracer_name.js');

const tracerCode = tracerData.surfaces['box_interior.glsl'];

function BoxInterior(width, height, depth) {
  this.tracer = {
    name: autoName(tracerCode),
    code: tracerCode
  };
  this.parameters = [`vec3(${width}, ${height}, ${depth})`];

  this.parametersAsList = () => [width, height, depth];
  this.parametersFromVec4Code = 'parameters.xyz';
}

module.exports = BoxInterior;
