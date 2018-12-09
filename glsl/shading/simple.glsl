#include "rand"
#include "scene"
#include "util/math.glsl"
#include "util/random_helpers.glsl"

bool color_prob_choice(color_type color, out color_type out_color, inout float choice_sample) {
    float p = color2prob(color);
    if (random_choice(p, choice_sample)) {
        out_color = color / p;
        return true;
    }
    return false;
}

bool sample_specular(int material_id, bool going_out, vec3 normal, inout vec3 ray, out color_type weight, inout rand_state rng) {
    float choice_sample = rand_next_uniform(rng);
    float roughness = get_roughness(material_id);

    vec3 n = normal;

    // simple "roughness" handling
    if (roughness >= 0.0) {
        // sample microsurface normal
        n = normalize(n + rand_next_gauss3(rng)*roughness);
    }

    if (color_prob_choice(get_reflectivity(material_id), weight, choice_sample)) {
        // full reflection
        ray = ray - 2.0*dot(n, ray)*n;

        // check with original normal, needed to prevent light leak into
        // opaque objects
        if (dot(ray, normal) < 0.0) return false;
        return true;
    }
    if (color_prob_choice(get_transparency(material_id), weight, choice_sample)) {
        // refraction
        float eta = 1.0 / get_ior(material_id);

        if (going_out) {
          // simplification: "out" of any object is always vacuum
          // and no nested transparent objects are supported
          eta = 1.0 / eta;
        }

        // see https://www.khronos.org/registry/OpenGL-Refpages/gl4/html/refract.xhtml
        // Snell's law for refraction
        float d = dot(n, ray);
        float k = 1.0 - eta*eta * (1.0 - d*d);
        if (k < 0.0) {
            // total reflection
            ray = ray - 2.0*d*n;
        } else {
            ray = eta * ray - (eta * d + sqrt(k)) * n;
        }
        return true;
    }
    return false;
}

bool sample_diffuse(int material_id, bool going_out, vec3 normal, inout vec3 ray, out color_type weight, inout rand_state rng) {
    weight = get_diffuse(material_id);
    ray = get_random_cosine_weighted(normal, rng);
    return true;
}

float sampling_pdf(int material_id, bool going_out, vec3 normal, vec3 ray_in, vec3 ray_out) {
    return dot(normal, ray_out) / M_PI;
}

float sample_diffuse_and_prob(int material_id, bool going_out, vec3 normal, inout vec3 ray, out color_type weight, inout rand_state rng) {
    vec3 ray_in = ray;
    sample_diffuse(material_id, going_out, normal, ray, weight, rng);
    return sampling_pdf(material_id, going_out, normal, ray_in, ray);
}

color_type brdf_cos_weighted(int material_id, bool going_out, vec3 normal, vec3 ray_in, vec3 ray_out) {
    return get_diffuse(material_id) * sampling_pdf(material_id, going_out, normal, ray_in, ray_out);
}

float sample_ray_and_prob(int material_id, bool going_out, vec3 normal, inout vec3 ray, out color_type weight, inout rand_state rng) {
    if (sample_specular(material_id, going_out, normal, ray, weight, rng)) {
        return -1.0;
    } else {
        return sample_diffuse_and_prob(material_id, going_out, normal, ray, weight, rng);
    }
}

bool sample_ray(int material_id, bool going_out, vec3 normal, inout vec3 ray, out color_type weight, inout rand_state rng) {
    return sample_ray_and_prob(material_id, going_out, normal, ray, weight, rng) != 0.0;
}
