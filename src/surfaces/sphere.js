const tracerData = require('../../glsl/index.js');
const autoName = require('../auto_tracer_name.js');
const tracerCode = tracerData.surfaces['sphere.glsl'];

function Sphere(radius) {
  this.tracer = {
    name: autoName(tracerCode),
    code: tracerCode
  },
  this.sampler = {
    name: 'sphere',
    samplerFunctionName: 'sphere_sample',
    getAreaFunctionName: 'get_sphere_area',
    code: tracerData.surfaces.samplers['sphere.glsl']
  }
  this.parameters = [`float(${radius})`]; // also works with integers

  this.parametersAsList = () => {
    return [radius];
  };
  this.parametersFromVec4Code = 'parameters.x';
}

module.exports = Sphere;
