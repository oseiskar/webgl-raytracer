const seedrandom = require('seedrandom');

const SceneBuilder = require('../../src/scene_builder.js');
const HalfSpace = require('../../src/surfaces/half_space.js');
const Sphere = require('../../src/surfaces/sphere.js');
const Box = require('../../src/surfaces/box.js');
const MaterialHelpers = require('../../src/material_helpers.js');

const COLOR = [97, 212, 207].map(x => x / 255);

const materials = {
  air: {
    mean_scattering_distance: 20.0,
    scattering_coefficient: 0.2
  },
  light: {
    emission: [1, 1, 1].map(x => x * 2.0)
  },
  warmLight: {
    emission: [1, 0.9, 0.8].map(x => x * 1.0)
  },
  things: {
    reflectivity: 0.3,
    roughness: 0.02,
    diffuse: COLOR
  },
  glass: {
    reflectivity: 0.1,
    roughness: 0.0,
    transparency: 1, // sampled after reflectivity
    ior: 1.5
  },
  matte: {
    diffuse: [0.9, 0.9, 0.9]
  },
  red: {
    diffuse: [0.9, 0.4, 0.4]
  },
  plastic: {
    reflectivity: 0.03,
    roughness: 0.15,
    diffuse: [0.4, 0.4, 0.1]
  },
  floor: {
    diffuse: [0.5, 0.5, 0.5],
    emission: {
      texture: {
        procedural: `
          vec3 uv = pos * 4.0;
          if (sin(uv.x) + sin(uv.y) + sin(uv.z) > 0.5) {
            return vec4(sin(pos.y)*0.5 + 0.5,0,cos(pos.x*0.4)*0.2 + 0.5,0) / (1.0 + length(pos) * 0.3)*5.0;
          } else {
            return vec4(0,0,0,0);
          }
        `
      }
    }
  }
};

function randnBoxMuller(rng) {
  let u = 0; let
    v = 0;
  while (u === 0) u = rng(); // Converting [0,1) to (0,1)
  while (v === 0) v = rng();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function getBuilder(shaderColorType = 'rgb') {
  const m = MaterialHelpers.autoConvert(materials, shaderColorType);
  const builder = new SceneBuilder()
    .setFixedPinholeCamera({
      fov: 55,
      yaw: 70,
      pitch: -17,
      target: [0, 0, 0.0],
      distance: 25,
      apertureSize: 0.07
    })
    .setAirMaterial(m.air)
    .addObject(new Box(6, 6, 3), [10, -10, 15], m.light)
    .addObject(new HalfSpace([0, 0, 1]), [0, 0, 0], m.floor)
    .setComputationLoadEstimate(6.0);

  const matOptions = [m.glass, m.warmLight, m.things, m.glass];

  const rng = seedrandom(3);
  for (let i = 0; i < 30; ++i) {
    const r = rng() * 2.0 + 0.2;
    const x = randnBoxMuller(rng) * 8.0;
    const y = randnBoxMuller(rng) * 10.0;
    const z = r;
    const material = matOptions[i % matOptions.length];
    builder.addObject(new Sphere(r), [x, y, z], material);
  }

  return builder;
}

module.exports = getBuilder;
