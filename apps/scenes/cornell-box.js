// scene from https://www.graphics.cornell.edu/online/box/data.html
// ... kind of, the objects are not exactly the corret size or in the correct
// positions. The lighting (here rgb-based) is not correct either

const { m4 } = require('twgl.js');

const SceneBuilder = require('../../src/scene_builder.js');
const Plane = require('../../src/surfaces/plane.js');
const Box = require('../../src/surfaces/box.js');
const MaterialHelpers = require('../../src/material_helpers.js');

const EMISSION = 30.0;

const materials = {
  leftWall: {
    diffuse: [0.6, 0.05, 0.05]
  },
  rightWall: {
    diffuse: [0.05, 0.6, 0.05]
  },
  others: {
    diffuse: 0.7
  },
  light: {
    emission: [1, 0.9, 0.6].map(x => x * EMISSION)
  }
};

function deg2rad(x) { return x / 180.0 * Math.PI; }

function getBuilder(shaderColorType = 'rgb') {
  const m = MaterialHelpers.autoConvert(materials, shaderColorType);

  return new SceneBuilder()
    .setColorModel(shaderColorType)
    .setFixedPinholeCamera({
      // "focal length = 0.035, width = height = 0.025"
      fov: Math.atan(25 / 35) / Math.PI * 180.0 * Math.sqrt(2),
      yaw: 90,
      pitch: 0,
      apertureSize: 10,
      target: [278, 0, 273], // assumed
      distance: 800,
      focusDistance: 1000
    })
    .addObject(new Plane([1, 0, 0]), [0, 0, 0], m.leftWall)
    .addObject(new Plane([-1, 0, 0]), [548, 0, 0], m.rightWall)
    .addObject(new Plane([0, -1, 0]), [0, 559, 0], m.others) // back wall
    .addObject(new Plane([0, 0, 1]), [0, 0, 0], m.others) // floor
    .addObject(new Plane([0, 0, -1]), [0, 0, 548], m.others) // ceiling
    .addObject(new Box(165 / 2, 165 / 2, 330 / 2),
      m4.rotateZ(m4.translation([168, 368, 330 / 2]), deg2rad(18)),
      m.others) // "short block", about
    .addObject(new Box(165 / 2, 165 / 2, 165 / 2),
      m4.rotateZ(m4.translation([351, 186, 165 / 2]), deg2rad(-18)),
      m.others) // "tall block", about
    .addObject(new Box(130 / 2, 130 / 2, 0.1 /* artificial thickness */), [278, 279, 548], m.light);
}

module.exports = getBuilder;
