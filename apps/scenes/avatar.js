const SceneBuilder = require('../../src/scene_builder.js');
const HalfSpace = require('../../src/surfaces/half_space.js');
const Box = require('../../src/surfaces/box.js');
const Dome = require('../../src/surfaces/dome.js');
const MaterialHelpers = require('../../src/material_helpers.js');

const SKY_EMISSION = 2.0;
const COLOR = [97,212,207].map(x => x/255);

const materials = {
  dome: {
    diffuse: [0, 0, 0]
  },
  sky: {
    diffuse: [0, 0, 0],
    emission: [1, 1, 1].map(x => x * SKY_EMISSION)
  },
  things: {
    reflectivity: 0.1,
    roughness: 0.05,
    diffuse: COLOR
  },
  glass: {
    reflectivity: 0.05,
    transparency: COLOR,
    ior: 1.5
  },
  floor: {
    diffuse: [0.8, 0.8, 0.8]
  }
};

const SKY_DISTANCE = 100.0;

function getBuilder(shaderColorType = 'rgb') {
  const m = MaterialHelpers.autoConvert(materials, shaderColorType);
  const sceneBuilder = new SceneBuilder()
    .setFixedPinholeCamera({
      fov: 60,
      yaw: -20,
      pitch: -50,
      target: [-0.6, 0.2, 0.5],
      distance: 6,
      apertureSize: 0.2,
    })
    .addObject(new Dome(SKY_DISTANCE), [0, 0, 0], m.dome)
    .addObject(new HalfSpace([0, 0, -1]), [0, 0, SKY_DISTANCE * 0.7], m.sky)
    .addObject(new HalfSpace([0, 0, 1]), [0, 0, 0], m.floor);

  function buildAvatar(builder, mat) {
    [
      [0,0],
      [-2,-1],
      [-1,-2],
      [2,-1],
      [1,-2],
      [-2,2],
      [-1,2],
      [1,2],
      [2,2]
    ].forEach(([x,y]) => {
      builder.addObject(new Box(0.5,0.5,0.5), [y,-x,0.5], mat);
    });
    return builder;
  }

  return buildAvatar(sceneBuilder, m.things);
}

module.exports = getBuilder;
