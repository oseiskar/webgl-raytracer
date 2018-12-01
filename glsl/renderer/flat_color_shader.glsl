#include "scene"
#include "rand"
#include "camera"

#ifndef BRIGHTNESS
#define BRIGHTNESS 1.5
#endif

vec3 render(vec2 xy, vec2 resolution) {
    rand_state rng;
    rand_init(rng);

    vec3 ray_pos;
    vec3 ray;
    vec3 white = vec3(1,1,1);
    get_camera_ray(xy, resolution, ray_pos, ray, rng);

    // find intersection
    vec4 intersection; // vec4(normal.xyz, distance)
    int which_object = find_intersection(ray_pos, ray, 0, 0, intersection);

    if (which_object == 0) {
        return vec3(0.0, 0.0, 0.0);
    } else {
        int material_id = get_material_id(which_object);
        vec3 emission;
        if (get_emission(material_id, emission)) {
            return emission * white;
        }
        return get_diffuse(material_id) * white;
    }
}
