const SceneBuilder = require('../../src/scene_builder.js');
const Sphere = require('../../src/surfaces/sphere.js');
const Plane = require('../../src/surfaces/plane.js');
const Box = require('../../src/surfaces/box.js');
const Dome = require('../../src/surfaces/dome.js');
const DistanceField = require('../../src/surfaces/distance_field.js');
const MaterialHelpers = require('../../src/material_helpers.js');

const materials = {
  light: {
    emission: [1.0, 1.0, 0.9].map(x => x * 1000)
  },
  skyTop: {
    diffuse: [0, 0, 0],
    emission: [0.5, 0.5, 0.55].map(x => x * 1.7)
  },
  skyHorizon: {
    diffuse: [0.7, 0.7, 1.0].map(x => x * 0.2)
  },
  walls: {
    diffuse: 0.8
  },
  ground: {
    diffuse: [0.8, 0.7, 0.5]
  },
  floor: {
    diffuse: [0.8, 0.7, 0.5]
  },
  sculpture: {
    diffuse: 0.9
  }
};

function getBuilder(shaderColorType = 'rgb') {
  const m = MaterialHelpers.autoConvert(materials, shaderColorType);


  function buildRoom(builder) {
    const window = {
      height: 1.2,
      width: 0.8,
      z0: 1.0
    };

    const room = {
      xDim: 6.0,
      yDim: 7.0,
      zDim: 3.0
    };

    const thickness = 0.1;

    const sideWidth = (room.yDim - window.width) / 2.0;
    const sideY = (window.width + sideWidth) / 2.0;
    const windowTopHeight = room.zDim - window.height - window.z0;

    // window wall
    builder
      .addObject(
        new Box(thickness, sideWidth / 2.0, room.zDim / 2.0),
        [room.xDim / 2.0, sideY, room.zDim / 2.0], m.walls
      )
      .addObject(
        new Box(thickness, sideWidth / 2.0, room.zDim / 2.0),
        [room.xDim / 2.0, -sideY, room.zDim / 2.0], m.walls
      )
      .addObject(
        new Box(thickness, window.width / 2.0, window.z0 / 2.0),
        [room.xDim / 2.0, 0.0, window.z0 / 2.0], m.walls
      )
      .addObject(
        new Box(thickness, window.width / 2.0, windowTopHeight / 2.0),
        [room.xDim / 2.0, 0.0, room.zDim - windowTopHeight / 2.0], m.walls
      );

    // other walls
    builder
      .addObject(
        new Box(thickness, room.yDim / 2.0, room.zDim / 2.0),
        [-room.xDim / 2.0, 0.0, room.zDim / 2.0], m.walls
      )
      .addObject(
        new Box(room.yDim / 2.0, thickness, room.zDim / 2.0),
        [0.0, room.yDim / 2.0, room.zDim / 2.0], m.walls
      );

    /* builder
      .addObject(
        new Box(room.yDim / 2.0, thickness, room.zDim / 2.0),
        [0.0, -room.yDim / 2.0, room.zDim / 2.0], m.walls);

    // ceiling
    builder
      .addObject(
        new Box(room.xDim / 2.0, room.yDim / 2.0, thickness),
          [0.0, 0.0, room.zDim], m.walls);

    // floor
    builder
      .addObject(
        new Box(room.xDim / 2.0, room.yDim / 2.0, thickness),
          [0.0, 0.0, 0.0], m.floor); */

    return builder;
  }

  const builder = new SceneBuilder()
    .setColorModel(shaderColorType)
    .setFixedPinholeCamera({
      fov: 60,
      yaw: 60,
      pitch: -5,
      target: [1.2, 0.0, 1.2],
      distance: 3.4
    })
    .addObject(new Dome(100.0), [0, 0, 0], m.skyHorizon)
    .addObject(new Plane([0, 0, -1]), [0, 0, 60], m.skyTop)
    .addObject(new Sphere(1.0), [30, -8.0, 20], m.light)
    .addObject(new DistanceField(
      'return (length(vec3(p.x,p.y,p.z*0.3)) + (sin(p.x*30.0) + cos(p.y * 25.0) + sin(p.z * 25.0)) * 0.1 - 0.2) * 0.2;',
      { escapeDistance: 2, maxSteps: 100 }
    ), [0.8, 0.6, 0.0], m.sculpture)
    .addObject(new Plane([0, 0, 1]), [0, 0, 0], m.ground)
    .setComputationLoadEstimate(1.5);

  buildRoom(builder);

  return builder;
}

module.exports = getBuilder;
