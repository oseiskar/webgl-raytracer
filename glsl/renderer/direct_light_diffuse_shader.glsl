#include "scene"
#include "rand"
#include "camera"

#ifndef BRIGHTNESS
#define BRIGHTNESS 1.5
#endif

vec3 render(vec2 xy, vec2 resolution) {
    rand_state rng;
    rand_init(rng);

    const vec3 light_dir = normalize(vec3(1.0, 2.0, 3.0));

    vec3 ray_pos;
    vec3 ray;
    get_camera_ray(xy, resolution, ray_pos, ray, rng);

    // find intersection
    vec4 intersection; // vec4(normal.xyz, distance)
    int which_object = find_intersection(ray_pos, ray, 0, 0, intersection);

    if (which_object == 0) {
        return vec3(0.0, 0.0, 0.0);
    } else {
        return get_diffuse(which_object) * max(0.0, dot(intersection.xyz, light_dir)) * BRIGHTNESS;
    }
}
