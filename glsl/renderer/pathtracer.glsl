#include "parameters"
#include "scene"
#include "rand"
#include "camera"
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

            if (which_object == inside_object) {
                normal = -normal;
            }

            if (random_choice(get_reflectivity(material_id, color), choice_sample)) {
                // full reflection
                ray_color *= color;
                ray = ray - 2.0*dot(normal, ray)*normal;
            } else if (random_choice(get_transparency(material_id, color), choice_sample)) {
                ray_color *= color;

                // refraction
                float eta = 1.0 / get_ior(material_id);

                int next_object = which_object;

                // out
                if (inside_object == which_object) {
                    next_object = 0;
                    eta = 1.0 / eta;
                }

                // see https://www.khronos.org/registry/OpenGL-Refpages/gl4/html/refract.xhtml
                // Snell's law for refraction
                float d = dot(normal, ray);
                float k = 1.0 - eta*eta * (1.0 - d*d);
                if (k < 0.0) {
                    // total reflection
                    ray = ray - 2.0*d*normal;
                } else {
                    inside_object = next_object;
                    ray = eta * ray - (eta * d + sqrt(k)) * normal;
                    normal = -normal;
                }
            } else {
                // diffuse reflection
                // sample a new direction
                ray = get_random_cosine_weighted(normal, rng);
                ray_color *= get_diffuse(material_id);
            }
            prev_object = which_object;
        }
    }
    return result_color;
}
