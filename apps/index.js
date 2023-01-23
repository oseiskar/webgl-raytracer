/* global document, window, GLSLBench, isMobileBrowser  */
/* eslint-disable global-require */

const Mustache = require('mustache');

const preprocessor = require('../src/preprocess_helpers.js');
const randHelpers = require('../src/rand_helpers.js');
const GUI = require('./my-gui.js');
const DynamicCamera = require('./dynamic-camera.js');

const sceneBuilders = {
  Example: require('./scenes/example.js'),
  'Cornell Box': require('./scenes/cornell-box.js'),
  Window: require('./scenes/window.js'),
  Boxy: require('./scenes/boxy.js'),
  Disco: require('./scenes/disco.js'),
  'Julia Set': require('./scenes/julia-set.js'),
  'Stair Spiral': require('./scenes/stair-spiral.js'),
  'Github Avatar': require('./scenes/avatar.js')
};

let bench;
let loadEstimate;

function getLoadProfile(mode) {
  const targetLoad = {
    light: 0.1,
    medium: 0.9,
    heavy: 2.0
  }[mode] * 2.0;

  const slowdownFactor = loadEstimate / targetLoad;
  // console.log({loadEstimate, slowdownFactor});

  if (slowdownFactor <= 1) {
    if (slowdownFactor < 0.5) return 1.0;
    return 1.0 - (slowdownFactor - 0.5) * 2;
  }

  return Math.floor(-slowdownFactor);
}

let dynamicCamera;

function render(options) {
  const element = document.getElementById('shader-container');
  const isFullScreen = options.resolution === 'fullscreen';
  [element, ...document.getElementsByClassName('catch-fullscreen')].forEach((el) => {
    el.classList.toggle('fullscreen', isFullScreen);
  });

  let resolution;
  let nPixels;
  if (!isFullScreen) {
    resolution = options.resolution.split('x').map(x => parseInt(x, 10));
    nPixels = resolution[0] * resolution[1];
  } else {
    nPixels = window.innerWidth * window.innerHeight;
  }
  const lightSampling = options.renderer.match(/bidirectional/);
  // workaround... should not be fixed in ggx
  const maxSampleWeight = options.specular === 'ggx' ? 10.0 : 1e6;

  const sceneBuilder = sceneBuilders[options.scene](options.colors);
  loadEstimate = sceneBuilder.getComputationLoadEstimate() * nPixels / (640 * 480);
  dynamicCamera = new DynamicCamera(element, sceneBuilder.getCameraParameters());

  const { source, data } = sceneBuilder
    .toggleDataTextures(options.dataTextures)
    .setDynamicCamera(true)
    .buildScene();

  const nRands = parseInt(options.lightBounces, 10) * 2 + 5;
  const randSpec = options.dataTextures
    ? randHelpers.texturesRandUniforms(nRands, nRands)
    : randHelpers.fixedVecsRandUniforms;

  const spec = {
    resolution,
    gamma: options.gamma,
    source: preprocessor.preprocess('mains/monte_carlo.glsl', {
      renderer: {
        file: `renderer/${options.renderer}.glsl`
      },
      scene: { source },
      camera: { file: `camera/${options.cameraLens}.glsl` },
      rand: {
        file: options.dataTextures
          ? 'rand/textures.glsl'
          : 'rand/fixed_vecs.glsl'
      },
      shading: {
        file: `shading/${options.specular}.glsl`
      },
      rec_filter: {
        file: `rec_filter/${options.recFilter}.glsl`
      },
      space_distortion: {
        file: 'space_distortion/none.glsl'
      },
      parameters: {
        source: Mustache.render(`
        #define N_BOUNCES {{lightBounces}}
        {{^lightSampling}}
        #define DISABLE_LIGHT_SAMPLING
        {{/lightSampling}}
        #define MAX_SAMPLE_WEIGHT float({{maxSampleWeight}})
        `, { ...options, lightSampling, maxSampleWeight })
          .split('\n').map(x => x.trim()).join('\n')
      }
    }),
    flip_y: true,
    monte_carlo: true,
    uniforms: {
      resolution: 'resolution',
      base_image: 'previous_frame',
      frame_number: 'frame_number',
      ...data,
      ...randSpec
    }
  };

  if (dynamicCamera) {
    Object.entries(dynamicCamera.getValues()).forEach(([key, value]) => {
      spec.uniforms[key] = {
        dynamic() { return dynamicCamera.getValues()[key]; },
        default: value
      };
    });
    spec.dynamic_reset = () => dynamicCamera.wasChanged();
  }

  if (bench) bench.destroy();

  document.getElementById('shader-source').innerText = spec.source;
  document.getElementById('glsl-uniforms').innerText = JSON.stringify(spec.uniforms, null, 2)
    .replace(/\n {10}/g, '')
    .replace(/\n {8}\]/g, ']');

  document.getElementById('copy-to-clipboard-button').onclick = () => {
    const textarea = document.getElementById('copy-to-clipboard-area');

    const specWithoutDynamics = { ...spec };
    if (dynamicCamera) {
      delete specWithoutDynamics.dynamic_reset;
      specWithoutDynamics.uniforms = {
        ...specWithoutDynamics.uniforms,
        ...dynamicCamera.getValues()
      };
    }

    textarea.value = JSON.stringify(specWithoutDynamics);
    textarea.select();
    document.execCommand('copy');
  };

  bench = new GLSLBench({ element, spec });
  bench.onError((err) => {
    // eslint-disable-next-line no-console
    console.log((`\n${bench.fragmentShaderSource}`).split('\n'));
    throw new Error(err);
  });
  bench.setLoadProfile(getLoadProfile(options.renderLoad));

  // avoid unnecessary size changes
  if (!isFullScreen) {
    const canvas = element.getElementsByTagName('canvas')[0];
    [canvas.width, canvas.height] = resolution;
  }
}

function start() {
  const gui = new GUI(document.getElementById('gui'));
  gui.add('scene', 'Example', Object.keys(sceneBuilders));
  gui.add('resolution', '640x480', [
    '640x480',
    '800x600',
    '1024x786',
    'fullscreen'
  ]);
  gui.add('renderer', 'bidirectional', {
    flat: 'random_flat_color_shader',
    lambert: 'direct_light_diffuse_shader',
    'path tracer': 'pathtracer',
    bidirectional: 'bidirectional_tracer_1_light_vertex'
  });
  gui.add('colors', 'rgb', ['grayscale', 'rgb']);
  gui.add('specular', 'ggx', ['simple', 'ggx']);
  gui.add('cameraLens', 'thin_lens', ['pinhole', 'thin_lens', 'orthographic', 'fisheye']);
  gui.add('dataTextures', true);
  gui.add('lightBounces', 4, [1, 2, 3, 4, 5]);
  gui.add('gamma', 'sRGB', ['1.0', '1.8', '2.2', 'sRGB']);
  gui.add('recFilter', 'tent', ['none', 'tent', 'gaussian']);
  gui.addIsolated('showSource', false, undefined, (options) => {
    document.getElementById('shader-source-container').classList.toggle('hidden', !options.showSource);
  });
  gui.addIsolated('renderLoad',
    isMobileBrowser ? 'light' : 'medium',
    ['light', 'medium', 'heavy'],
    (options) => {
      if (!bench) return;
      bench.setLoadProfile(getLoadProfile(options.renderLoad));
    });

  gui.addButton('save image', () => {
    if (!bench) return;
    bench.captureImage((data) => {
      const a = document.getElementById('save-image-as');
      a.href = data;
      a.download = 'raytracer-output.png';
      a.click();
    });
  });

  /* eslint-disable no-use-before-define */
  const stopResume = gui.addButton('stop', () => {
    if (!bench) return;
    if (bench.running) {
      stopResume.innerText = 'resume';
      stopResume.classList.remove('btn-warning');
      bench.stop();
    } else {
      showStopButton();
      bench.resume();
    }
  });

  function showStopButton() {
    stopResume.innerText = 'stop';
    stopResume.classList.add('btn-warning');
  }

  gui.onChange((options) => {
    showStopButton();
    render(options);
  });
}

module.exports = { start };
