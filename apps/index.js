const Mustache = require('mustache');

const preprocessor = require('../src/preprocess_helpers.js');
const SceneBuilder = require('../src/scene_builder.js');
const Sphere = require('../src/surfaces/sphere.js');
const BoxInterior = require('../src/surfaces/box_interior.js');
const randHelpers = require('../src/rand_helpers.js');
const GUI = require('./my-gui.js');

let bench;

function render(options) {
  const element = document.getElementById('shader-container');
  const isFullScreen = options.resolution === 'fullscreen';
  element.classList.toggle('fullscreen', isFullScreen);

  let resolution;
  if (!isFullScreen) resolution = options.resolution.split('x');
  options.lightSampling = options.renderer.match(/bidirectional/);

  const spec = {
    resolution,
    source: preprocessor.preprocess('mains/monte_carlo.glsl', {
      renderer: {
        file: `renderer/${options.renderer}.glsl`
      },
      scene: { source: options.scene },
      camera: { file: 'camera/pinhole.glsl' },
      rand: { file: 'rand/fixed_vecs.glsl' },
      parameters: { source: Mustache.render(`
        #define N_BOUNCES {{lightBounces}}
        {{^tentFilter}}
        #define ENABLE_TENT_FILTER 0
        {{/tentFilter}}
        {{^lightSampling}}
        #define DISABLE_LIGHT_SAMPLING
        {{/lightSampling}}
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

function start() {
  const gui = new GUI();
  gui.add('resolution', '640x480', [
    '640x480',
    '800x600',
    '1024x786',
    'fullscreen'
  ]);
  gui.add('scene', 'Cornell Box', {
    'Example': require('./scenes/example.js'),
    'Cornell Box': require('./scenes/cornell-box.js'),
  });
  gui.add('renderer', 'bidirectional', {
    'flat': 'random_flat_color_shader',
    'lambert': 'direct_light_diffuse_shader',
    'path tracer': 'pathtracer',
    'bidirectional': 'bidirectional_tracer_1_light_vertex'
  });
  gui.add('lightBounces', 4, [1,2,3,4,5]);
  gui.add('tentFilter', true);
  gui.onChange(render);
}

module.exports = { start };
