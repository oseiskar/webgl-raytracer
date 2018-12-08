#include "rand"
#include "scene"
#include "util/math.glsl"
#include "util/random_helpers.glsl"

float ggx_D(vec3 n, vec3 m, float alpha) {
    float mn = dot(m, n);
    if (mn < 0.0) return 0.0;
    float mn2 = mn*mn;
    float a2 = alpha * alpha;
    float den = 1.0 + mn2 * (a2 - 1.0); // = cos^2(theta)*(a2 + tan^2(theta))
    if (den <= 0.0) return 0.0; // avoid numerical issues
    return a2 / (M_PI * den * den);
}

float ggx_G1(vec3 v, vec3 m, vec3 n, float alpha) {
    const float eps = 1e-4;
    float vm = dot(v, m);
    float vn = dot(v, n); // note: sign only depends on refraction vs reflection
    if (sign(vm) * sign(vn) < 0.0) return 0.0; // vm/vn < 0.0
    float vn2 = vn*vn;
    float a2 = alpha*alpha;
    // = 2 / (1 + sqrt(1 + alpha^2 tan^2(theta)))
    //return 2.0 / (1.0 + sqrt(max(1.0 + alpha * alpha * (1.0 - vm2) / vm2, 0.0)));
    return 2.0 / (1.0 + sqrt(max(a2 / vn2 + 1.0 - a2, 0.0)));
}

color_type fresnel_schlick_term(float cos_theta, color_type f0) {
    return f0 + (1.0 - f0) * pow(1.0 - cos_theta, 5.0);
}

vec3 sample_ggx(vec3 normal, float alpha, inout rand_state rng) {
    vec3 dir = rand_next_gauss3(rng);
    // project to surface
    dir = normalize(dir - dot(dir, normal)*normal);
    float eta = rand_next_uniform(rng);
    float theta = atan(alpha * sqrt(eta) / sqrt(1.0 - eta));
    return normal * cos(theta) + dir * sin(theta);
}

/*bool sample_fresnel(int material_id, bool going_out, vec3 normal, inout vec3 ray, out color_type color, inout rand_state rng) {
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
}*/

bool ggx_sample_specular(float alpha, bool going_out, vec3 normal, inout vec3 ray, out color_type color, inout rand_state rng) {
    // microfacet normal
    vec3 m = sample_ggx(normal, alpha, rng);
    vec3 i = -ray;
    vec3 o = ray - 2.0*dot(m, ray)*m;

    // f / p
    float weight = dot(i, m) * ggx_G1(i, m, normal, alpha) * ggx_G1(o, m, normal, alpha) / (dot(i, normal) * dot(m, normal));
    color = vec3(1.0, 1.0, 1.0);
    //color = fresnel_schlick_term(-dot(ray, m), color);
    color *= weight;

    ray = o;
    return true;
}

bool sample_specular(int material_id, bool going_out, vec3 normal, inout vec3 ray, out color_type color, inout rand_state rng) {
    return false;
}

float ggx_sampling_pdf(float alpha, bool going_out, vec3 normal, vec3 ray_in, vec3 ray_out) {
    vec3 m = normalize(-ray_in + ray_out);
    float d = ggx_D(normal, m, alpha);

    float ch_vars = 1.0 / (4.0 * dot(ray_out, m));
    return d * dot(m, normal) * ch_vars;
}

color_type ggx_specular_brdf(float alpha, bool going_out, vec3 normal, vec3 ray_in, vec3 ray_out) {
    vec3 m = normalize(-ray_in + ray_out);
      color_type color = vec3(1.0, 1.0, 1.0);

    float d = ggx_D(normal, m, alpha);
    float ch_vars = 1.0 / (4.0 * dot(ray_out, m));
    float weight = dot(-ray_in, m) * ggx_G1(-ray_in, m, normal, alpha) * ggx_G1(ray_out, m, normal, alpha) / (dot(-ray_in, normal) * dot(m, normal));

    return color * d * dot(m, normal) * ch_vars * weight;
}

float lambert_sampling_pdf(vec3 normal, vec3 ray_out) {
    return dot(normal, ray_out) / M_PI;
}

color_type lambert_brdf(int material_id, bool going_out, vec3 normal, vec3 ray_in, vec3 ray_out) {
    return get_diffuse(material_id) * lambert_sampling_pdf(normal, ray_out);
}

// "diffuse"

float diffuse_sampling_pdf(int material_id, bool going_out, vec3 normal, vec3 ray_in, vec3 ray_out) {
    color_type dummy;
    float alpha = get_roughness(material_id);
    float refl = get_reflectivity(material_id, dummy);
    return refl * ggx_sampling_pdf(alpha, going_out, normal, ray_in, ray_out)
     + (1.0 - refl) * lambert_sampling_pdf(normal, ray_out);
    // + (1.0 - refl) * ggx_sampling_pdf(1.0, going_out, normal, ray_in, ray_out);
}

color_type diffuse_brdf(int material_id, bool going_out, vec3 normal, vec3 ray_in, vec3 ray_out) {
    color_type col;
    float alpha = get_roughness(material_id);
    float refl = get_reflectivity(material_id, col);
    if (refl <= 0.0) {
        col = vec3(0,0,0); // TODO: why required?
    }
    return refl * ggx_specular_brdf(alpha, going_out, normal, ray_in, ray_out) * col +
      (1.0 - refl) * lambert_brdf(material_id, going_out, normal, ray_in, ray_out);
      //(1.0 - refl) * ggx_specular_brdf(1.0, going_out, normal, ray_in, ray_out) * get_diffuse(material_id);
}


bool sample_diffuse_lambert(int material_id, bool going_out, vec3 normal, inout vec3 ray, out color_type color, inout rand_state rng) {
    color = get_diffuse(material_id);
    ray = get_random_cosine_weighted(normal, rng);
    return true;
}

bool sample_ray(int material_id, bool going_out, vec3 normal, inout vec3 ray, out color_type color, inout rand_state rng) {

    color_type col;
    float choice_sample = rand_next_uniform(rng);
    float refl = get_reflectivity(material_id, col);
    float alpha = get_roughness(material_id);
    if (refl <= 0.0) col = vec3(0,0,0); // TODO
    if (random_choice(refl, choice_sample)) {
        color_type col2;
        ggx_sample_specular(alpha, going_out, normal, ray, col2, rng);

        //vec3 ray_in = ray;
        //ggx_sample_specular(material_id, going_out, normal, ray, col2, rng);
        //float samp = ggx_sampling_pdf(material_id, going_out, normal, ray_in, ray);
        //color_type brdf = ggx_specular_brdf(material_id, going_out, normal, ray_in, ray);
        //float weight = min(1.0 / samp, MAX_WEIGHT);
        //if (samp <= 0.0) weight = 0.0;
        //color = brdf * weight * col;
        color = col * col2;

        return true;
    }
    else {
      /*color_type col2;
      ggx_sample_specular(1.0, going_out, normal, ray, col2, rng);
      color = col2 * get_diffuse(material_id);
      return true;*/

      return sample_diffuse_lambert(material_id, going_out, normal, ray, color, rng);
    }
}

bool sample_diffuse(int material_id, bool going_out, vec3 normal, inout vec3 ray, out color_type color, inout rand_state rng) {
    //return sample_diffuse_lambert(material_id, going_out, normal, ray, color, rng);
    return sample_ray(material_id, going_out, normal, ray, color, rng);
}
