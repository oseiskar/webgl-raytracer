#include "parameters"
#include "scene"
#include "rand"
#include "camera"
#include "shading"
#include "util/random_helpers.glsl"

// tracer parameters
#ifndef N_BOUNCES
#define N_BOUNCES 4
#endif

#define HEURISTIC_BALANCE 1
#define HEURISTIC_POWER 2
#define HEURISTIC_MAX 3
#define HEURISTIC_EQUAL 4
#define HEURISTIC_PATH_TRACER 5
#define HEURISTIC_DIRECT_ONLY 6

#ifndef WEIGHTING_HEURISTIC
#define WEIGHTING_HEURISTIC HEURISTIC_POWER
#endif

#if WEIGHTING_HEURISTIC == HEURISTIC_PATH_TRACER
#define weight1(a,b) 1.0
#define weight2(a,b) 0.0
#elif WEIGHTING_HEURISTIC == HEURISTIC_DIRECT_ONLY
#define weight1(a,b) 0.0
#define weight2(a,b) 1.0
#else
float weight1(float p1, float p2) {
#if WEIGHTING_HEURISTIC == HEURISTIC_EQUAL
    return 0.5;
#elif WEIGHTING_HEURISTIC == HEURISTIC_BALANCE
    return p1 / (p1 + p2); // balance heuristic
#elif WEIGHTING_HEURISTIC == HEURISTIC_POWER
    return p1*p1 / (p1*p1 + p2*p2); // power heuristic (2)
#elif WEIGHTING_HEURISTIC == HEURISTIC_MAX
    return p1 > p2 ? 1.0 : 0.0; // maximum heuristic
#endif
}
#define weight2 weight1
#endif

bool check_visibility(vec3 pos, vec3 shadow_ray, vec3 normal, vec3 light_normal, int which_object, int light_object) {
    vec4 shadow_isec;
    if (dot(shadow_ray, normal) > 0.0 &&
        dot(shadow_ray, light_normal) < 0.0 &&
        which_object != light_object)
    {
        vec4 shadow_isec;
        int shadow_object = find_intersection(pos, shadow_ray, which_object, 0, shadow_isec);
        return shadow_object == 0 || shadow_object == light_object;
    }
    return false;
}

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
    int inside_object_material_id = get_material_id(inside_object);

    float last_surface_p = 0.0;

    vec3 light_point, light_normal;
    float light_sample_area_probability;
    int light_object = select_light(light_point, light_normal, light_sample_area_probability, rng);
    color_type light_emission;

    get_emission(get_material_id(light_object), light_point, light_emission);
    color_type color;

    float choice_sample = rand_next_uniform(rng);

    for (int bounce = 0; bounce <= N_BOUNCES; ++bounce)  {
        vec4 intersection; // vec4(normal.xyz, distance)
        float scattering_distance = sample_scattering_distance(inside_object_material_id, color, rng);
        int which_object = find_intersection(ray_pos, ray, prev_object, inside_object, intersection);

        if (which_object == 0 || intersection.w > scattering_distance) {
            // did not hit anything
            if (scattering_distance < 1e10) {
                // due to scattering
                ray_color *= color;
                ray_pos += scattering_distance * ray;
                ray = sample_scattered_ray(inside_object_material_id, ray, rng);
                last_surface_p = 0.0;
                prev_object = 0;
            } else {
                break;
            }
        } else {
            vec3 normal = intersection.xyz;
            ray_pos += intersection.w * ray;
            int material_id = get_material_id(which_object);

            if (get_emission(material_id, ray_pos, color)) {
                float probThis, probOther;

                bool has_samp = has_sampler(which_object);
                if (last_surface_p > 0.0 && has_sampler(which_object)) {
                    float no_scatter_prob = 1.0 - get_scattering_prob(inside_object_material_id, intersection.w);
                    float change_of_variables = -dot(normal, ray) / (intersection.w*intersection.w);
                    // surface scattering
                    probThis = change_of_variables * last_surface_p * no_scatter_prob;
                    probOther = light_sample_area_probability;
                } else {
                    probOther = 0.0;
                    probThis = 1.0;
                }
                result_color += ray_color * color * weight1(probThis, probOther);
            }

            bool going_out = which_object == inside_object;
            if (going_out) {
                normal = -normal;
            }

            vec3 ray_in = ray;
            last_surface_p = sample_ray_and_prob(material_id, going_out, ray_pos, normal, ray, color, rng);
            float cur_sample_weight = color2prob(color)*(ray_color.x + ray_color.y + ray_color.z) / 3.0;
            if (last_surface_p == 0.0 || cur_sample_weight > MAX_SAMPLE_WEIGHT) break;

            if (last_surface_p > 0.0 && bounce < N_BOUNCES && inside_object == 0) {
                // no lights inside transparent objects supported
                vec3 shadow_ray = light_point - ray_pos;
                float shadow_dist = length(shadow_ray);
                shadow_ray *= 1.0 / shadow_dist;

                if (check_visibility(ray_pos, shadow_ray, normal, light_normal, which_object, light_object)) {
                    float change_of_variables = -dot(light_normal, shadow_ray) / (shadow_dist*shadow_dist);

                    // = dot(normal, shadow_ray) / M_PI
                    float prob_sampling = sampling_pdf(material_id, going_out, ray_pos, normal, ray_in, shadow_ray);

                    // multiple importance sampling probabilities of different strategies
                    float probThis = light_sample_area_probability;
                    float probOther = change_of_variables * prob_sampling;

                    float no_scatter_prob = 1.0 - get_scattering_prob(inside_object_material_id, shadow_dist);
                    probOther *= no_scatter_prob;

                    color_type contribution = no_scatter_prob * brdf_cos_weighted(material_id, going_out, ray_pos, normal, ray_in, shadow_ray);
                    color_type f_over_p = contribution * change_of_variables / probThis;
                    color_type total_weight = f_over_p * weight2(probThis, probOther);
                    if (color2prob(total_weight) > 0.0) { // handle some numerical issues
                        result_color += ray_color * light_emission * total_weight;
                    }
                }
            } else {
                last_surface_p = 0.0;
            }
            ray_color *= color;

            if (dot(ray, normal) < 0.0) {
                if (going_out) {
                    // normal = -normal (not used)
                    inside_object = 0;
                }
                else inside_object = which_object;
                inside_object_material_id = get_material_id(inside_object);
            }

            prev_object = which_object;
        }
    }
    return result_color;
}
