#include "rand"
#include "scene"
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

void get_camera_ray(vec2 screen_pos, vec2 resolution, out vec3 ray_pos, out vec3 ray, inout rand_state rng) {
    vec3 cam_pos, cam_x, cam_y, cam_z;
    float fov_angle;

    get_pinhole_camera(cam_pos, cam_x, cam_y, cam_z, fov_angle);

    vec2 ccd_pos = get_ccd_pos(screen_pos, resolution, rng);
    ray = normalize(ccd_pos.x*cam_x + ccd_pos.y*cam_y + 1.0/tan(fov_angle*0.5)*cam_z);
    ray_pos = cam_pos;
}
