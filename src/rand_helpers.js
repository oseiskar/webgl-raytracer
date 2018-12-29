module.exports = {
  fixedVecsRandUniforms: {
    random_gauss_1: 'random_normal_4',
    random_gauss_2: 'random_normal_4',
    random_gauss_3: 'random_normal_4',
    random_gauss_4: 'random_normal_4',
    random_gauss_5: 'random_normal_4',
    random_gauss_6: 'random_normal_4',
    random_gauss_7: 'random_normal_4',
    random_gauss_8: 'random_normal_4',
    random_uniforms_1: 'random_uniform_4',
    random_uniforms_2: 'random_uniform_4',
    random_uniforms_3: 'random_uniform_4',
    random_uniforms_4: 'random_uniform_4',
    random_uniforms_5: 'random_uniform_4',
    random_uniforms_6: 'random_uniform_4',
    random_uniforms_7: 'random_uniform_4',
    random_uniforms_8: 'random_uniform_4'
  },
  texturesRandUniforms(nGauss4, nUniform4) {
    return {
      random_gauss: {
        random: {
          distribution: 'normal',
          size: nGauss4 * 4
        }
      },
      n_random_gauss: nGauss4,
      random_uniform: {
        random: {
          distribution: 'uniform',
          size: nUniform4 * 4
        }
      },
      n_random_uniform: nUniform4
    };
  }
};
