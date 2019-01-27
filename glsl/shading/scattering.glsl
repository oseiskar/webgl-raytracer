#include "rand"
#include "scene"
#include "util/math.glsl"
#include "util/random_helpers.glsl"

vec3 sample_scattered_ray(int material_id, vec3 ray_in, inout rand_state rng) {
    // Henyey-Greenstein phase function,
    // see https://www.astro.umd.edu/~jph/HG_note.pdf
    float g = get_scattering_anisotropy(material_id, vec3(0,0,0));
    if (g == 0.0) {
        // the sampling formula below breaks at g == 0.0, which corresponds to
        // fully isotropic scattering, which is easier to model like this
        return normalize(rand_next_gauss3(rng));
    }

    float a = (1.0 - g*g) / (1.0 - g + 2.0*g*rand_next_uniform(rng));
    float mu = 0.5 / g * (1.0 + g*g - a*a);

    vec3 perp = rand_next_gauss3(rng);
    perp = normalize(perp - ray_in*dot(ray_in, perp));
    return mu * ray_in +  sqrt(1.0 - mu*mu) * perp;
}

float sample_scattering_distance(int material_id, out color_type col, inout rand_state rng) {
    color_type distances = get_mean_scattering_distance(material_id, vec3(0,0,0));
    float dist = color2prob(distances);
    if (dist > 0.0) {
        col = distances / dist;
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
