const SceneBuilder = require('../../src/scene_builder.js');
const Sphere = require('../../src/surfaces/sphere.js');
const BoxInterior = require('../../src/surfaces/box_interior.js');
const Plane = require('../../src/surfaces/plane.js');
const MaterialHelpers = require('../../src/material_helpers.js');

const ROOM_H = 2.0;
const ROOM_W = 5.0;
const LIGHT_R = 0.4;
const BRIGHTNESS = 75;

function emissionPerSurfaceArea(color, sphereR, totalIntensity = 1.0) {
  const mult = totalIntensity / (4 * Math.PI * sphereR * sphereR);
  return color.map(x => mult * x);
}

const materials = {
  glass: {
    reflectivity: 0.1,
    roughness: 0.0,
    transparency: 1, // sampled after reflectivity
    ior: 1.5
  },
  teal: {
    reflectivity: [0.25, 0.4, 0.45],
    roughness: 0.33,
    diffuse: [0.25, 0.4, 0.45]
  },
  plastic: {
    reflectivity: 0.03,
    roughness: 0.15,
    diffuse: [0.4, 0.4, 0.1]
  },
  light1: {
    emission: emissionPerSurfaceArea([0.8, 0.8, 1.0], LIGHT_R, BRIGHTNESS)
  },
  light2: {
    emission: emissionPerSurfaceArea([1.0, 0.8, 0.6], LIGHT_R, BRIGHTNESS)
  },
  walls: {
    diffuse: 0.6
  },
  floor: {
    reflectivity: 0.3,
    roughness: 0.05,
    diffuse: 0.1
  }
};

function getBuilder(shaderColorType = 'rgb') {
  const m = MaterialHelpers.autoConvert(materials, shaderColorType);

  return new SceneBuilder()
    .setColorModel(shaderColorType)
    .setFixedPinholeCamera({
      fov: 40,
      yaw: 200,
      pitch: -5,
      target: [-0.9, 0.1, 0.15],
      distance: 2.6,
      apertureSize: 0.02,
      focusDistance: 1.6
    })
    .addObject(new Sphere(0.3), [0.0, 0.0, 0.3], m.teal)
    .addObject(new Sphere(0.25), [-1.1, 0.25, 0.25], m.glass)
    .addObject(new Sphere(0.1), [-0.1, 0.8, 0.1], m.plastic)
    .addObject(new Sphere(LIGHT_R), [-ROOM_W * 0.5, 0.0, ROOM_H], m.light1)
    .addObject(new Sphere(LIGHT_R), [0.0, ROOM_W * 0.5, ROOM_H], m.light2)
    .addObject(new Plane([0, 0, 1]), [0, 0, 0], m.floor)
    .addObject(
      new BoxInterior(ROOM_W * 0.5, ROOM_W * 0.5, ROOM_H * 0.5),
      [0.0, 0.0, ROOM_H * 0.5 - 0.01],
      m.walls
    );
}

module.exports = getBuilder;
