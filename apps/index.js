const Mustache = require('mustache');

const preprocessor = require('../src/preprocess_helpers.js');
const Sphere = require('../src/surfaces/sphere.js');
const BoxInterior = require('../src/surfaces/box_interior.js');
const randHelpers = require('../src/rand_helpers.js');
const GUI = require('./my-gui.js');

const sceneBuilders = {
  'Example': require('./scenes/example.js'),
  'Cornell Box': require('./scenes/cornell-box.js'),
  'Stair Spiral': require('./scenes/stair-spiral.js')
};

let bench;

function render(options) {
  const element = document.getElementById('shader-container');
  const isFullScreen = options.resolution === 'fullscreen';
  element.classList.toggle('fullscreen', isFullScreen);

  let resolution;
  if (!isFullScreen) resolution = options.resolution.split('x').map(x => parseInt(x));
  options.lightSampling = options.renderer.match(/bidirectional/);
  // workaround... should not be fixed in ggx
  options.maxSampleWeight = options.specular === 'ggx' ? 10.0 : 1e6;

  const { source, data } = sceneBuilders[options.scene](options.colors)
    .toggleDataTextures(options.dataTextures)
    .buildScene();

  const nRands = parseInt(options.lightBounces)*2 + 5;
  const randSpec = options.dataTextures ?
    randHelpers.texturesRandUniforms(nRands, nRands) :
    randHelpers.fixedVecsRandUniforms;

  const spec = {
    resolution,
    source: preprocessor.preprocess('mains/monte_carlo.glsl', {
      renderer: {
        file: `renderer/${options.renderer}.glsl`
      },
      scene: { source },
      camera: { file: 'camera/pinhole.glsl' },
      rand: { file: options.dataTextures ?
        'rand/textures.glsl' :
        'rand/fixed_vecs.glsl'
      },
      shading: {
        file: `shading/${options.specular}.glsl`
      },
      parameters: { source: Mustache.render(`
        #define N_BOUNCES {{lightBounces}}
        {{^tentFilter}}
        #define ENABLE_TENT_FILTER 0
        {{/tentFilter}}
        {{^lightSampling}}
        #define DISABLE_LIGHT_SAMPLING
        {{/lightSampling}}
        #define MAX_SAMPLE_WEIGHT float({{maxSampleWeight}})
        `, options).split('\n').map(x => x.trim()).join('\n')
      }
    }),
    monte_carlo: true,
    uniforms: {
      resolution: 'resolution',
      base_image: 'previous_frame',
      frame_number: 'frame_number',
      ...data,
      ...randSpec
    }
  };

  if (bench) bench.destroy();

  if (options.showSource) {
    document.getElementById('shader-source').innerHTML = spec.source;
  }
  document.getElementById('shader-source-container').classList.toggle('hidden', !options.showSource);

  document.getElementById('copy-to-clipboard-button').onclick = () => {
    const textarea = document.getElementById('copy-to-clipboard-area');
    textarea.value = JSON.stringify(spec);
    textarea.select();
    document.execCommand('copy');
  };

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
  gui.add('scene', 'Example', Object.keys(sceneBuilders));
  gui.add('renderer', 'bidirectional', {
    'flat': 'random_flat_color_shader',
    'lambert': 'direct_light_diffuse_shader',
    'path tracer': 'pathtracer',
    'bidirectional': 'bidirectional_tracer_1_light_vertex'
  });
  gui.add('colors', 'rgb', ['grayscale', 'rgb']);
  gui.add('specular', 'ggx', ['simple', 'ggx']);
  gui.add('dataTextures', true);
  gui.add('lightBounces', 4, [1,2,3,4,5]);
  gui.add('tentFilter', true);
  gui.add('showSource', false);
  gui.addButton('stop', () => {
    if (bench) bench.stop();
  });
  gui.onChange(render);
}

module.exports = { start };
