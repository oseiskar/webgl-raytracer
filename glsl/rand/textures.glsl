// sampler 1D not supported by WebGL
uniform sampler2D random_gauss;
uniform sampler2D random_uniform;
uniform int n_random_gauss;
uniform int n_random_uniform;

struct rand_state {
    int index_uniform;
    int index_gauss;
};

void rand_init(out rand_state state) {
    state.index_uniform = 0;
    state.index_gauss = 0;
}

vec4 rand_next_gauss4(inout rand_state state) {
    state.index_gauss++;
    return texture2D(random_gauss,
      vec2(float(state.index_gauss-1)/float(n_random_gauss), 0.0));
}

vec3 rand_next_gauss3(inout rand_state state) {
    return rand_next_gauss4(state).xyz;
}

float rand_next_uniform(inout rand_state state) {
    state.index_uniform++;
    return texture2D(random_uniform,
      vec2(float(state.index_uniform-1)/float(n_random_uniform), 0.0)).x;
}
