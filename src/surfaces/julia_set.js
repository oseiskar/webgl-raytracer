const Mustache = require('mustache');
const tracerData = require('../../glsl/index.js');
const DistanceField = require('./distance_field.js');

function JuliaSet(center, iterations, options = {}) {
  const distanceFunctionCode = Mustache.render(
    tracerData.surfaces['julia_set_distance_field.glsl.mustache'],
    {
      iterations,
      cx: center[0] || 0.0,
      cy: center[1] || 0.0,
      cz: center[2] || 0.0,
      cw: center[3] || 0.0
    }
  );

  const distanceField = new DistanceField(distanceFunctionCode,
    Object.assign({
      escapeDistance: 10,
      boundingRadius: 4,
      maxStepSize: 0.1,
      maxSteps: 200
    }, options));

  this.tracer = distanceField.tracer;
  this.nonConvex = true;
}

module.exports = JuliaSet;
