// silly PRNG
uniform vec4 random_gauss_1, random_gauss_2, random_gauss_3,
             random_gauss_4, random_gauss_5, random_gauss_6,
             random_gauss_7, random_gauss_8;
uniform vec4 random_uniforms_1, random_uniforms_2, random_uniforms_3,
             random_uniforms_4, random_uniforms_5, random_uniforms_6,
             random_uniforms_7, random_uniforms_8;

struct rand_state {
    int index_uniform;
    int index_gauss4;
};

void rand_init(out rand_state state) {
    state.index_uniform = 0;
    state.index_gauss4 = 0;
}

vec4 rand_next_gauss4(inout rand_state state) {
    state.index_gauss4++;
    int c = state.index_gauss4;
    if (c == 1) return random_gauss_1;
    if (c == 2) return random_gauss_2;
    if (c == 3) return random_gauss_3;
    if (c == 4) return random_gauss_4;
    if (c == 5) return random_gauss_5;
    if (c == 6) return random_gauss_6;
    if (c == 7) return random_gauss_7;
    if (c == 8) return random_gauss_8;
    //abort(); // ???
    return vec4(0.0, 0.0, 0.0, 0.0);
}

vec3 rand_next_gauss3(inout rand_state state) {
    return rand_next_gauss4(state).xyz;
}

float rand_next_uniform(inout rand_state state) {
    int vec_number = state.index_uniform / 4;
    int component = state.index_uniform - vec_number * 4;
    state.index_uniform++;
    vec4 vec;
    if (vec_number == 0) vec = random_uniforms_1;
    else if (vec_number == 1) vec = random_uniforms_2;
    else if (vec_number == 2) vec = random_uniforms_3;
    else if (vec_number == 3) vec = random_uniforms_4;
    else if (vec_number == 4) vec = random_uniforms_5;
    else if (vec_number == 5) vec = random_uniforms_6;
    else if (vec_number == 6) vec = random_uniforms_7;
    else if (vec_number == 7) vec = random_uniforms_8;
    //else abort(); // ???

    if (component == 0) return vec.x;
    if (component == 1) return vec.y;
    if (component == 2) return vec.z;
    if (component == 3) return vec.w;
}
