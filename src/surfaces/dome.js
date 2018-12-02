const tracerData = require('../../glsl/index.js');
const autoName = require('../auto_tracer_name.js');
const tracerCode = tracerData.surfaces['dome.glsl'];

function Dome(radius) {
  this.tracer = {
    name: autoName(tracerCode),
    code: tracerCode
  },
  // no sampler since it makes usually no sense to sample a light dome
  this.parameters = [`float(${radius})`]; // also works with integers
  this.noInside = true;

  this.parametersAsList = () => {
    return [radius];
  };
  this.parametersFromVec4Code = 'parameters.x';
}

module.exports = Dome;
