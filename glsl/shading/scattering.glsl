#include "rand"
#include "scene"
#include "util/math.glsl"
#include "util/random_helpers.glsl"

vec3 sample_scattered_ray(int material_id, vec3 ray_in, inout rand_state rng) {
    float s = get_scattering_coefficient(material_id, vec3(0,0,0));
    if (s < 0.0) {
      ray_in = -ray_in;
    }
    return normalize(ray_in + s * rand_next_gauss3(rng));
}

float sample_scattering_distance(int material_id, out color_type col, inout rand_state rng) {
    color_type distances = get_mean_scattering_distance(material_id, vec3(0,0,0));
    float dist = color2prob(distances);
    col = distances / dist;
    if (dist > 0.0) {
        return -log(rand_next_uniform(rng)) * dist;
    } else {
        return 1e10;
    }
}

float get_scattering_prob(int material_id, float distance) {
    color_type distances = get_mean_scattering_distance(material_id, vec3(0,0,0));
    float dist = color2prob(distances);
    if (dist > 0.0) {
      return 1.0 - exp(-distance / dist);
    }
    return 0.0;
}
