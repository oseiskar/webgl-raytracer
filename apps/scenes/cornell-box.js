// scene from https://www.graphics.cornell.edu/online/box/data.html
// ... kind of, the objects are not exactly the corret size or in the correct
// positions. The lighting (here rgb-based) is not correct either

const SceneBuilder = require('../../src/scene_builder.js');
const HalfSpace = require('../../src/surfaces/half_space.js');
const Box = require('../../src/surfaces/box.js');
const m4 = require('twgl.js').m4;

const EMISSION = 25.0;

const materials = {
  leftWall: {
    diffuse: [0.9, 0.2, 0.2]
  },
  rightWall: {
    diffuse: [0.2, 0.9, 0.2]
  },
  others: {
    diffuse: [0.9, 0.9, 0.9]
  },
  light: {
    emission: [1,0.9,0.7].map(x => x*EMISSION)
  }
};

function deg2rad(x) { return x / 180.0 * Math.PI; }

const sceneSource = new SceneBuilder()
  .setFixedPinholeCamera({
    // "focal length = 0.035, width = height = 0.025"
    fov: Math.atan(25/35)/Math.PI*180.0 * Math.sqrt(2),
    yaw: 90,
    pitch: 0,
    target: [278, 0, 273], // assumed
    distance: 800
  })
  .addObject(new HalfSpace([1, 0, 0]), [0,0,0], materials.leftWall)
  .addObject(new HalfSpace([-1, 0, 0]), [548,0,0], materials.rightWall)
  .addObject(new HalfSpace([0, -1, 0]), [0,559,0], materials.others) // back wall
  .addObject(new HalfSpace([0, 0, 1]), [0,0,0], materials.others) // floor
  .addObject(new HalfSpace([0, 0, -1]), [0,0,548], materials.others) // ceiling
  .addObject(new Box(165/2, 165/2, 330/2),
      m4.rotateZ(m4.translation([168, 368, 330/2]), deg2rad(18)),
      materials.others) // "short block", about
  .addObject(new Box(165/2, 165/2, 165/2),
      m4.rotateZ(m4.translation([351, 186, 165/2]), deg2rad(-18)),
      materials.others) // "tall block", about
  .addObject(new Box(130/2, 130/2, 0.1 /* artificial thickness */), [278, 279, 548], materials.light)
  .buildSceneGLSL();

module.exports = sceneSource;
