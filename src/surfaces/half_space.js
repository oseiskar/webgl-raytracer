const tracerData = require('../../glsl/index.js');
const autoName = require('../auto_tracer_name.js');

const tracerCode = tracerData.surfaces['half_space.glsl'];

/**
 * @param normal The outer normal vector, must be normalized
 */
function HalfSpace(normal) {
  this.tracer = {
    name: autoName(tracerCode),
    code: tracerCode
  };
  this.parameters = [`vec3(${normal.join(',')})`]; // also works with integers

  this.parametersAsList = () => [...normal];
  this.parametersFromVec4Code = 'parameters.xyz';
}

module.exports = HalfSpace;
