const preprocessor = require('../../src/preprocess_helpers.js');
const SceneBuilder = require('../../src/scene_builder.js');
const Sphere = require('../../src/surfaces/sphere.js');
const BoxInterior = require('../../src/surfaces/box_interior.js');
const randHelpers = require('../../src/rand_helpers.js');

const ROOM_H = 2.0;
const ROOM_W = 5.0;
const LIGHT_R = 0.4;

function emissionPerSurfaceArea(color, sphereR, totalIntensity=1.0) {
  const mult = totalIntensity / (4*Math.PI*sphereR*sphereR);
  return color.map(x => mult*x);
}

const sceneSource = new SceneBuilder()
  .setFixedPinholeCamera({
    fov: 50,
    yaw: 300,
    pitch: -5,
    target: [-0.5, 0.0, 0.35],
    distance: 2.6
  })
  .addObject(new Sphere(0.5), [0.0, 0.0, 0.5], { diffuse: [.25, .4, .45] })
  .addObject(new Sphere(0.25), [-1.1, 0.3, 0.25], {
    reflectivity: 0.1,
    transparency: 1, // sampled after reflectivity
    ior: 1.5
  })
  .addObject(new Sphere(LIGHT_R), [-ROOM_W*0.5, 0.0, ROOM_H], {
    emission: emissionPerSurfaceArea([0.8, 0.8, 1.0], LIGHT_R, 100)
  })
  .addObject(new Sphere(LIGHT_R), [0.0, ROOM_W*0.5, ROOM_H], {
    emission: emissionPerSurfaceArea([1.0, 0.8, 0.6], LIGHT_R, 100)
  })
  .addObject(
    new BoxInterior(ROOM_W*0.5, ROOM_W*0.5, ROOM_H*0.5),
    [0.0, 0.0, ROOM_H*0.5],
    { diffuse: [0.35, 0.35, 0.35] }
  )
  .buildSceneGLSL();

//console.log(sceneSource.split('\n'));

module.exports = {
  resolution: [640, 480],
  source: preprocessor.preprocess('mains/monte_carlo.glsl', {
    renderer: {
      //file: 'renderer/flat_color_shader.glsl'
      //file: 'renderer/random_flat_color_shader.glsl'
      //file: 'renderer/direct_light_diffuse_shader.glsl'
      //file: 'renderer/pathtracer.glsl'
      file: 'renderer/bidirectional_tracer_1_light_vertex.glsl'
    },
    scene: { source: sceneSource },
    camera: { file: 'camera/pinhole.glsl' },
    rand: { file: 'rand/fixed_vecs.glsl' },
    parameters: { source: `
      //#define DISABLE_LIGHT_SAMPLING
    ` }
  }),
  monte_carlo: true,
  refresh_every: 20,
  uniforms: Object.assign({
    resolution: 'resolution',
    base_image: 'previous_frame',
    frame_number: 'frame_number',
  }, randHelpers.fixedVecsRandUniforms)
};
