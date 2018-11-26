const preprocessor = require('../../src/preprocess_helpers.js');
const randHelpers = require('../../src/rand_helpers.js');

module.exports = {
  resolution: [640, 480],
  source: preprocessor.preprocess('mains/monte_carlo.glsl', {
    renderer: { file: 'renderer/bidirectional_tracer_1_light_vertex.glsl' },
    scene: { file: 'scene/test.glsl' },
    camera: { file: 'camera/pinhole.glsl' },
    rand: { file: 'rand/fixed_vecs.glsl' },
    parameters: { source: `
      #define N_BOUNCES 4

      //#define N_BOUNCES 1
      //#define WEIGHTING_HEURISTIC HEURISTIC_DIRECT_ONLY
    `}
  }),
  "monte_carlo": true,
  "refresh_every": 20,
  "uniforms": Object.assign({
      "resolution": "resolution",
      "base_image": "previous_frame",
      "frame_number": "frame_number"
  }, randHelpers.fixedVecsRandUniforms)
};
