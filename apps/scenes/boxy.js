const seedrandom = require('seedrandom');
const m4 = require('twgl.js').m4;

const SceneBuilder = require('../../src/scene_builder.js');
const Plane = require('../../src/surfaces/plane.js');
const Sphere = require('../../src/surfaces/sphere.js');
const Box = require('../../src/surfaces/box.js');
const MaterialHelpers = require('../../src/material_helpers.js');

const materials = {
  light: {
    emission: [1.0, 1.0, 0.9].map(x => x*40),
  },
  walls: {
    diffuse: 0.8
  },
  ceiling: {
    diffuse: 0.8
  },
  mineral: {
    diffuse: [0.3, 0.3, 0.5],
    reflectivity: [0.1, 0.1, 0.2],
    roughness: 0.02
  },
  floor: {
    diffuse: 0.1,
    reflectivity: 0.15,
    roughness: 0.05
  }
};

function makeBox(builder, mat, dims) {
  return builder
    .addObject(new Plane([1, 0, 0]), [-dims[0],0,0], mat.walls)
    .addObject(new Plane([-1, 0, 0]), [dims[0],0,0], mat.walls)
    .addObject(new Plane([0, 1, 0]), [0,-dims[1],0], mat.walls)
    .addObject(new Plane([0, -1, 0]), [0,dims[1],0], mat.walls)
    .addObject(new Plane([0, 0, 1]), [0,0,0], mat.floor)
    .addObject(new Plane([0, 0, -1]), [0,0,dims[2]*2], mat.ceiling);
}

function randnBoxMuller(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng(); // Converting [0,1) to (0,1)
  while (v === 0) v = rng();
  return Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
}

function getBuilder(shaderColorType = 'rgb') {
  const m = MaterialHelpers.autoConvert(materials, shaderColorType);

  const builder = new SceneBuilder()
    .setColorModel(shaderColorType)
    .setFixedPinholeCamera({
      fov: 45,
      target: [-0.3, 0, 0.55],
      position: [1, -4.95, 2]
    })
    .addObject(new Sphere(0.5), [-3, -1, 2], m.light)
    .setComputationLoadEstimate(2.0);

  makeBox(builder, m, [4, 5, 2.5]);

  const seed = Math.round(Math.random() * 1e12);
  //const seed = 518261260800;
  console.log(`scene generation seed: ${seed}`);

  const rng = seedrandom(seed); //seedrandom(5);

  [false, true].forEach(small => {
    for (let i = 0; i < 12; ++i) {
      let pos;
      if (small) {
        pos = [1,1,1].map(i => { return rng(); }).map(x => x*2.0 - 1.0);
        const j = i % 3;
        pos[j] = Math.sign(pos[j]) * (1.0 + Math.abs(pos[j])*0.1);
        pos = pos.map(x => x*0.5);
      } else {
        pos = [1,1,1].map(i => { return randnBoxMuller(rng); }).map(x => x*0.2);
      }

      pos[2] += 0.85;

      let side = 0.5;
      if (small) side = rng()*0.3+0.05;

      let rotAx = [1,1,1+randnBoxMuller(rng)*0.1];
      if (i % 2 === 0) rotAx[1] = 0.5;

      builder.addObject(
        new Box(side, side, side),
        m4.axisRotate(m4.translation(pos), rotAx, 60 / 180.0 * Math.PI),
        m.mineral
      );
    }
  });

  return builder;
}

module.exports = getBuilder;
