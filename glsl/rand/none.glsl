// dummy / none rand
#define rand_state int

void rand_init(out rand_state state) {}

vec4 rand_next_gauss4(inout rand_state state) {
    return vec4(0.0, 0.0, 0.0, 1.0);
}

vec3 rand_next_gauss3(inout rand_state state) {
    return rand_next_gauss4(state).xyz;
}

float rand_next_uniform(inout rand_state state) {
    return 0.0;
}
