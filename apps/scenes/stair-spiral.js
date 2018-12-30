// https://github.com/oseiskar/raytracer/blob/master/scenes/scene-stairs.py

const SceneBuilder = require('../../src/scene_builder.js');
const HalfSpace = require('../../src/surfaces/half_space.js');
const Sphere = require('../../src/surfaces/sphere.js');
const Box = require('../../src/surfaces/box.js');
const Dome = require('../../src/surfaces/dome.js');
const m4 = require('twgl.js').m4;
const MaterialHelpers = require('../../src/material_helpers.js');

const SKY_EMISSION = 3.0;
const STAIR_EMISSION = 5.0;

const materials = {
  dome: {
    diffuse: [0,0,0]
  },
  sky: {
    diffuse: [0,0,0],
    emission: [0.5, 0.5, 0.7].map(x => x*SKY_EMISSION)
  },
  red: {
    reflectivity: 0.1,
    roughness: 0.05,
    diffuse: [0.6, 0.1, 0.1]
  },
  floor: {
    diffuse: [0.8, 0.8, 0.8]
  },
  glass: {
    reflectivity: 0.05,
    transparency: 1, // sampled after reflectivity
    ior: 1.5
  },
  light: {
    emission: [1.0, 0.8, 0.6].map(x => x*STAIR_EMISSION)
  }
};

const SKY_DISTANCE = 100.0;

function getBuilder(shaderColorType = 'rgb') {
  const m = MaterialHelpers.autoConvert(materials, shaderColorType);
  const sceneBuilder = new SceneBuilder()
    .setFixedPinholeCamera({
      fov: 52,
      yaw: -270,
      pitch: -5,
      target: [-0.5, 0, 1.5],
      distance: 7.5
    })
    .addObject(new Dome(SKY_DISTANCE), [0,0,0], m.dome)
    .addObject(new HalfSpace([0,0,-1]), [0,0,SKY_DISTANCE*0.7], m.sky)
    .addObject(new HalfSpace([0,0,1]), [0,0,0], m.floor)
    .setComputationLoadEstimate(5.0);

  function deg2rad(x) { return x / 180.0 * Math.PI; }

  let t1 = m4.translation([1,0,0]);
  let t2 = m4.translation([0,1.5,0]);
  const dt = m => m4.multiply(m4.translate(m4.axisRotation([-0.5,-1,3.1], deg2rad(10)), [0,0,0.07]), m);

  for (let j=0; j<65; ++j) {
    let material;
    if (j % 16 === 8)
      material = 'light';
    else if (j % 16 === 0)
      material = 'red';
    else
      material = 'glass';

    sceneBuilder.addObject(new Box(0.5, 0.2, 0.02), t1, m[material]);
    sceneBuilder.addObject(new Sphere(0.1), t2, m.red);

    t1 = dt(t1);
    t2 = dt(t2);
  }

  return sceneBuilder;
}

module.exports = getBuilder;
