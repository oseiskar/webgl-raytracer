#include "parameters"
#include "scene"
#include "rand"
#include "camera"
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

#ifndef N_OBJECTS
#define N_OBJECTS 9999
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

    bool was_diffuse = false;
    float last_cosine_weight = 0.0;

    vec3 light_point, light_normal;
    float light_sample_area_probability;
    int light_object = select_light(light_point, light_normal, light_sample_area_probability, rng);
    color_type light_emission;

    get_emission(light_object, light_emission);
    color_type color;

    float choice_sample = rand_next_uniform(rng);

    for (int bounce = 0; bounce <= N_BOUNCES; ++bounce)  {
        vec4 intersection; // vec4(normal.xyz, distance)
        int which_object = find_intersection(ray_pos, ray, prev_object, inside_object, intersection);

        if (which_object == 0) {
            ray_color = zero_vec3;
        } else {
            vec3 normal = intersection.xyz;
            ray_pos += intersection.w * ray;
            int material_id = get_material_id(which_object);

            if (get_emission(material_id, color)) {
                float changeOfVarsTerm = -dot(normal, ray) / (intersection.w*intersection.w);
                float probThis, probOther;

                if (was_diffuse && has_sampler(which_object)) {
                  probThis = changeOfVarsTerm * last_cosine_weight /  M_PI;
                  probOther = light_sample_area_probability;
                } else {
                    probOther = 0.0;
                    probThis = 1.0;
                }
                result_color += ray_color * color * weight1(probThis, probOther);
            }

            // visibility test
            vec4 shadow_isec;
            vec3 shadow_ray = light_point - ray_pos;
            float shadow_dist = length(shadow_ray);
            shadow_ray = normalize(shadow_ray);

            int shadow_object = which_object;
            if (which_object != light_object &&
                inside_object == 0 && // no lights inside transparent objects supported
                dot(shadow_ray, normal) > 0.0 &&
                dot(shadow_ray, light_normal) < 0.0) {
                shadow_object = find_intersection(ray_pos, shadow_ray, which_object, inside_object, shadow_isec);
            }
            else {
              shadow_isec.w = -1.0;
              shadow_object = N_OBJECTS;
            }

            if (which_object == inside_object) {
                normal = -normal;
            }

            if (random_choice(get_reflectivity(material_id, color), choice_sample)) {
                // full reflection
                ray = ray - 2.0*dot(normal, ray)*normal;
                ray_color *= color;
                was_diffuse = false;
            } else if (random_choice(get_transparency(material_id, color), choice_sample)) {
                ray_color *= color;

                // refraction
                float eta = 1.0 / get_ior(material_id);

                was_diffuse = false;
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
                last_cosine_weight = dot(normal, ray);

                ray_color *= get_diffuse(material_id) / M_PI;
                was_diffuse = true;
            }

            if (bounce < N_BOUNCES && was_diffuse && (
                  shadow_object == 0 ||
                  shadow_object == light_object)) {

                // not obstructed

                float changeOfVarsTerm = -dot(shadow_isec.xyz, shadow_ray) / (shadow_dist*shadow_dist);
                float probOther = changeOfVarsTerm * dot(normal, shadow_ray) / M_PI;

                // multiple importance sampling probabilities of different strategies
                float probThis = light_sample_area_probability;
                float intensity = dot(normal, shadow_ray) * changeOfVarsTerm / probThis;

                result_color += ray_color * light_emission * intensity * weight2(probThis, probOther);
            }

            if (was_diffuse) {
                // PI comes from the contribution
                // f(x) / p(x) = cos(w) / (cos(w) / PI) = PI
                ray_color *= M_PI;
            }
            prev_object = which_object;
        }
    }
    return result_color;
}
