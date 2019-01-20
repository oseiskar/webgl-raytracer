#include "rand"
#include "util/math.glsl"
#include "rec_filter"

vec2 get_ccd_pos(vec2 screen_pos, vec2 resolution, inout rand_state rng) {
    float aspect = resolution.y / resolution.x;
    vec2 jittered_pos = screen_pos + get_rec_filter_sample(rng);
    return ((jittered_pos / resolution.xy) * 2.0 - 1.0) * vec2(1.0, aspect);
}
