const SceneBuilder = require('../../src/scene_builder.js');
const Sphere = require('../../src/surfaces/sphere.js');
const BoxInterior = require('../../src/surfaces/box_interior.js');

const ROOM_H = 2.0;
const ROOM_W = 5.0;
const LIGHT_R = 0.4;

function emissionPerSurfaceArea(color, sphereR, totalIntensity=1.0) {
  const mult = totalIntensity / (4*Math.PI*sphereR*sphereR);
  return color.map(x => mult*x);
}

const materials = {
  glass: {
    reflectivity: 0.1,
    transparency: 1, // sampled after reflectivity
    ior: 1.5
  },
  teal: {
    diffuse: [.25, .4, .45]
  },
  light1: {
    emission: emissionPerSurfaceArea([0.8, 0.8, 1.0], LIGHT_R, 100)
  },
  light2: {
    emission: emissionPerSurfaceArea([1.0, 0.8, 0.6], LIGHT_R, 100)
  },
  walls: {
    diffuse: [0.35, 0.35, 0.35]
  }
}

const sceneSource = new SceneBuilder()
  .setFixedPinholeCamera({
    fov: 50,
    yaw: 300,
    pitch: -5,
    target: [-0.5, 0.0, 0.35],
    distance: 2.6
  })
  .addObject(new Sphere(0.5), [0.0, 0.0, 0.5], materials.teal)
  .addObject(new Sphere(0.25), [-1.1, 0.3, 0.25], materials.glass)
  .addObject(new Sphere(LIGHT_R), [-ROOM_W*0.5, 0.0, ROOM_H], materials.light1)
  .addObject(new Sphere(LIGHT_R), [0.0, ROOM_W*0.5, ROOM_H], materials.light2)
  .addObject(
    new BoxInterior(ROOM_W*0.5, ROOM_W*0.5, ROOM_H*0.5),
    [0.0, 0.0, ROOM_H*0.5],
    materials.walls
  )
  .buildSceneGLSL();

module.exports = sceneSource;
