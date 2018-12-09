#include "parameters"
#include "scene"
#include "rand"
#include "camera"
#include "shading"
#include "util/random_helpers.glsl"

#ifndef N_BOUNCES
#define N_BOUNCES 4
#endif

vec3 render(vec2 xy, vec2 resolution) {

    rand_state rng;
    rand_init(rng);

    vec3 ray_pos;
    vec3 ray;
    get_camera_ray(xy, resolution, ray_pos, ray, rng);
    vec3 ray_color = vec3(1.0, 1.0, 1.0);

    const vec3 zero_vec3 = vec3(0.0, 0.0, 0.0);
    int prev_object = 0; // assumed to be OBJ_NONE
    int inside_object = 0;
    vec3 result_color = zero_vec3;
    color_type color;

    float choice_sample = rand_next_uniform(rng);

    for (int bounce = 0; bounce <= N_BOUNCES; ++bounce) {
        // find intersection
        vec4 intersection; // vec4(normal.xyz, distance)
        int which_object = find_intersection(ray_pos, ray, prev_object, inside_object, intersection);

        if (which_object == 0) {
            ray_color = zero_vec3;
        } else {
            vec3 normal = intersection.xyz;
            ray_pos += intersection.w * ray;
            int material_id = get_material_id(which_object);

            if (get_emission(material_id, color)) {
                result_color += ray_color * color;
            }

            bool going_out = which_object == inside_object;
            if (going_out) {
                normal = -normal;
            }

            if (sample_ray(material_id, going_out, normal, ray, color, rng)) {
                ray_color *= color;
            } else {
                break;
            }

            // workaround for nasty samples
            if (color2prob(ray_color) > MAX_SAMPLE_WEIGHT) break;

            if (dot(ray, normal) < 0.0) {
                if (going_out) {
                    // normal = -normal (not used)
                    inside_object = 0;
                }
                else inside_object = which_object;
            }
            prev_object = which_object;
        }
    }
    return result_color;
}
