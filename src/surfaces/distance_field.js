const Mustache = require('mustache');
const tracerData = require('../../glsl/index.js');

const tracerTemplate = tracerData.surfaces['distance_field.glsl.mustache'];

let distanceFieldId = 0;

function DistanceField(distanceFunction, options = {}) {
  distanceFieldId++;

  const finalOptions = Object.assign({
    distanceFieldId,
    distanceFunctionCode: distanceFunction
  }, {
    distanceThreshold: 1e-3,
    gradientDelta: 1e-5,
    escapeDistance: 1e5,
    maxStepSize: 1e5,
    maxSteps: 50,
    convex: false
  }, options);

  this.tracer = {
    name: `distance_field_intersection_${distanceFieldId}`,
    code: Mustache.render(tracerTemplate, finalOptions)
  };

  this.nonConvex = true;
}

module.exports = DistanceField;
