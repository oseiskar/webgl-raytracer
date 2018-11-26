const preprocessor = require('../../src/preprocess_helpers.js');

module.exports = {
  resolution: [640, 480],
  source: preprocessor.preprocess('mains/single_pass.glsl', {
    renderer: {
      //file: 'renderer/flat_color_shader.glsl'
      //file: 'renderer/random_flat_color_shader.glsl'
      file: 'renderer/direct_light_diffuse_shader.glsl'
    },
    scene: { file: 'scene/moving_camera.glsl' },
    camera: { file: 'camera/pinhole.glsl' },
    rand: { file: 'rand/none.glsl' },
    parameters: { source: `
      #define ENABLE_TENT_FILTER 0
    `}
  }),
  uniforms: {
    resolution: 'resolution',
    mouse: 'relative_mouse',
  }
};
