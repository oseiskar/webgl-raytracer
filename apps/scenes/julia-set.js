const SceneBuilder = require('../../src/scene_builder.js');
const HalfSpace = require('../../src/surfaces/half_space.js');
const JuliaSet = require('../../src/surfaces/julia_set.js');
const Dome = require('../../src/surfaces/dome.js');
const MaterialHelpers = require('../../src/material_helpers.js');

const SKY_EMISSION = 1.5;
const COLOR = [97, 212, 207].map(x => x / 255);

const materials = {
  dome: {
    diffuse: [0, 0, 0]
  },
  sky: {
    diffuse: [0, 0, 0],
    emission: [1, 1, 1].map(x => x * SKY_EMISSION)
  },
  things: {
    reflectivity: 0.3,
    roughness: 0.01,
    diffuse: COLOR
  },
  floor: {
    diffuse: {
      texture: {
        procedural: `
          vec3 uv = pos * 4.0;
          if (sin(uv.x) + sin(uv.y) + sin(uv.z) > 0.5) {
            return vec4(1,1,1,0) * 0.65;
          } else {
            return vec4(1,1,1,0) * 0.9;
          }
        `
      }
    }
  }
};

const SKY_DISTANCE = 100.0;

function getBuilder(shaderColorType = 'rgb') {
  const m = MaterialHelpers.autoConvert(materials, shaderColorType);
  return new SceneBuilder()
    .setFixedPinholeCamera({
      fov: 55,
      yaw: 70,
      pitch: -30,
      target: [0, 0, 1.8],
      distance: 4,
      apertureSize: 0.01
    })
    .addObject(new Dome(SKY_DISTANCE), [0, 0, 0], m.dome)
    .addObject(new HalfSpace([0, 0, -1]), [0, 0, SKY_DISTANCE * 0.7], m.sky)
    .addObject(new HalfSpace([0, 0, 1]), [0, 0, 0], m.floor)
    .addObject(new JuliaSet([0.0, -0.45, -0.7, 0.0], 6), [0, 0, 2.0], m.things)
    .setComputationLoadEstimate(6.0);
}

module.exports = getBuilder;
