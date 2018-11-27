const Mustache = require('mustache');

const preprocessor = require('../src/preprocess_helpers.js');
const SceneBuilder = require('../src/scene_builder.js');
const Sphere = require('../src/surfaces/sphere.js');
const BoxInterior = require('../src/surfaces/box_interior.js');
const randHelpers = require('../src/rand_helpers.js');
const GUI = require('./my-gui.js');

const ROOM_H = 2.0;
const ROOM_W = 5.0;
const LIGHT_R = 0.4;

function emissionPerSurfaceArea(color, sphereR, totalIntensity=1.0) {
  const mult = totalIntensity / (4*Math.PI*sphereR*sphereR);
  return color.map(x => mult*x);
}

let bench;

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

function render(options) {
  const element = document.getElementById('shader-container');
  const isFullScreen = options.resolution === 'fullscreen';
  element.classList.toggle('fullscreen', isFullScreen);

  let resolution;
  if (!isFullScreen) resolution = options.resolution.split('x');

  const spec = {
    resolution,
    source: preprocessor.preprocess('mains/monte_carlo.glsl', {
      renderer: {
        file: `renderer/${options.renderer}.glsl`
      },
      scene: { source: sceneSource },
      camera: { file: 'camera/pinhole.glsl' },
      rand: { file: 'rand/fixed_vecs.glsl' },
      parameters: { source: Mustache.render(`
        #define N_BOUNCES {{lightBounces}}
        {{^tentFilter}}
        #define ENABLE_TENT_FILTER 0
        {{/tentFilter}}
      `, options)}
    }),
    monte_carlo: true,
    refresh_every: 10,
    uniforms: Object.assign({
      resolution: 'resolution',
      base_image: 'previous_frame',
      frame_number: 'frame_number',
    }, randHelpers.fixedVecsRandUniforms)
  };

  if (bench) bench.destroy();
  bench = new GLSLBench({ element, spec });
  bench.onError((err) => {
    console.log(("\n"+bench.fragmentShaderSource).split("\n"));
    throw new Error(err);
  });
}

const gui = new GUI();
gui.add('resolution', '640x480', [
  '640x480',
  '800x600',
  '1024x786',
  'fullscreen'
]);
gui.add('renderer', 'bidirectional', {
  'flat': 'random_flat_color_shader',
  'lambert': 'direct_light_diffuse_shader',
  'path tracer': 'pathtracer',
  'bidirectional': 'bidirectional_tracer_1_light_vertex'
});
gui.add('lightBounces', 4, [1,2,3,4,5]);
gui.add('tentFilter', true);
gui.onChange(render);
