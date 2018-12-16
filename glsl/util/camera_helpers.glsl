#include "rand"
#include "util/math.glsl"

#ifndef ENABLE_TENT_FILTER
#define ENABLE_TENT_FILTER 1
#endif

float tent_filter_transformation(float x) {
    x *= 2.0;
    if (x < 1.0) return sqrt(x) - 1.0;
    return 1.0 - sqrt(2.0 - x);
}

vec2 get_ccd_pos(vec2 screen_pos, vec2 resolution, inout rand_state rng) {
    float aspect = resolution.y / resolution.x;
#if ENABLE_TENT_FILTER
    vec2 jittered_pos = screen_pos + vec2(
            tent_filter_transformation(rand_next_uniform(rng)),
            tent_filter_transformation(rand_next_uniform(rng)));
#else
    vec2 jittered_pos = screen_pos;
#endif
    return ((jittered_pos / resolution.xy) * 2.0 - 1.0) * vec2(1.0, aspect);
}
