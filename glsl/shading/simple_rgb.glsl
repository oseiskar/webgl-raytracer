#include "rand"
#include "scene"
#include "util/math.glsl"
#include "util/random_helpers.glsl"

bool sample_specular(int material_id, bool going_out, vec3 normal, inout vec3 ray, out color_type color, inout rand_state rng) {
    float choice_sample = rand_next_uniform(rng);
    if (random_choice(get_reflectivity(material_id, color), choice_sample)) {
        // full reflection
        ray = ray - 2.0*dot(normal, ray)*normal;
        return true;
    }
    if (random_choice(get_transparency(material_id, color), choice_sample)) {
        // refraction
        float eta = 1.0 / get_ior(material_id);

        if (going_out) {
          // simplification: "out" of any object is always vacuum
          // and no nested transparent objects are supported
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
            ray = eta * ray - (eta * d + sqrt(k)) * normal;
        }
        return true;
    }
    return false;
}

bool sample_diffuse(int material_id, bool going_out, vec3 normal, inout vec3 ray, out color_type color, inout rand_state rng) {
    color = get_diffuse(material_id);
    ray = get_random_cosine_weighted(normal, rng);
    return true;
}

float diffuse_sampling_pdf(int material_id, bool going_out, vec3 normal, vec3 ray_in, vec3 ray_out) {
    return dot(normal, ray_out) / M_PI;
}

color_type diffuse_brdf(int material_id, bool going_out, vec3 normal, vec3 ray_in, vec3 ray_out) {
    return get_diffuse(material_id) * diffuse_sampling_pdf(material_id, going_out, normal, ray_in, ray_out);
}

bool sample_ray(int material_id, bool going_out, vec3 normal, inout vec3 ray, out color_type color, inout rand_state rng) {
    return sample_specular(material_id, going_out, normal, ray, color, rng)
        || sample_diffuse(material_id, going_out, normal, ray, color, rng);
}
