const Mustache = require('mustache');

const preprocessor = require('../src/preprocess_helpers.js');
const Sphere = require('../src/surfaces/sphere.js');
const BoxInterior = require('../src/surfaces/box_interior.js');
const randHelpers = require('../src/rand_helpers.js');
const GUI = require('./my-gui.js');

const sceneBuilders = {
  'Example': require('./scenes/example.js'),
  'Cornell Box': require('./scenes/cornell-box.js')
};

let bench;

function render(options) {
  const element = document.getElementById('shader-container');
  const isFullScreen = options.resolution === 'fullscreen';
  element.classList.toggle('fullscreen', isFullScreen);

  let resolution;
  if (!isFullScreen) resolution = options.resolution.split('x').map(x => parseInt(x));
  options.lightSampling = options.renderer.match(/bidirectional/);

  const nRands = parseInt(options.lightBounces) + 5;

  const sceneSource = sceneBuilders[options.scene]();

  const spec = {
    resolution,
    source: preprocessor.preprocess('mains/monte_carlo.glsl', {
      renderer: {
        file: `renderer/${options.renderer}.glsl`
      },
      scene: { source: sceneSource },
      camera: { file: 'camera/pinhole.glsl' },
      rand: { file: 'rand/textures.glsl' },
      parameters: { source: Mustache.render(`
        #define N_BOUNCES {{lightBounces}}
        {{^tentFilter}}
        #define ENABLE_TENT_FILTER 0
        {{/tentFilter}}
        {{^lightSampling}}
        #define DISABLE_LIGHT_SAMPLING
        {{/lightSampling}}
        `, options).split('\n').map(x => x.trim()).join('\n')
      }
    }),
    monte_carlo: true,
    refresh_every: 10,
    uniforms: {
      resolution: 'resolution',
      base_image: 'previous_frame',
      frame_number: 'frame_number',
      ...randHelpers.texturesRandUniforms(nRands, nRands)
    }
  };

  if (bench) bench.destroy();

  const srcCodeElement = document.getElementById('shader-source');
  if (options.showSource) {
    srcCodeElement.innerHTML = spec.source;
  }
  srcCodeElement.classList.toggle('hidden', !options.showSource);

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
  gui.add('scene', 'Cornell Box', Object.keys(sceneBuilders));
  gui.add('renderer', 'bidirectional', {
    'flat': 'random_flat_color_shader',
    'lambert': 'direct_light_diffuse_shader',
    'path tracer': 'pathtracer',
    'bidirectional': 'bidirectional_tracer_1_light_vertex'
  });
  gui.add('lightBounces', 4, [1,2,3,4,5]);
  gui.add('tentFilter', true);
  gui.add('showSource', false);
  gui.onChange(render);
}

module.exports = { start };
