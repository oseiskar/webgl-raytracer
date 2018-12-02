const tracerData = require('../../glsl/index.js');
const autoName = require('../auto_tracer_name.js');
const tracerCode = tracerData.surfaces['plane.glsl'];

/**
 * @param normal Plane normal vector (either side)
 */
function Plane(normal) {
  this.tracer = {
    name: autoName(tracerCode),
    code: tracerCode
  }
  this.parameters = [`vec3(${normal.join(',')})`]; // also works with integers
  this.noInside = true;

  this.parametersAsList = () => {
    return [...normal];
  };
  this.parametersFromVec4Code = 'parameters.xyz';
}

module.exports = Plane;
