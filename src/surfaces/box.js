const tracerData = require('../../glsl/index.js');
const autoName = require('../auto_tracer_name.js');
const tracerCode = tracerData.surfaces['box.glsl'];

function Box(width, height, depth) {
  this.tracer = {
    name: autoName(tracerCode),
    code: tracerCode
  },
  this.sampler = {
    name: 'box',
    samplerFunctionName: 'box_sample',
    getAreaFunctionName: 'get_box_area',
    code: tracerData.surfaces.samplers['box.glsl']
  }
  this.parameters = [`vec3(${width}, ${height}, ${depth})`];
}

module.exports = Box;
