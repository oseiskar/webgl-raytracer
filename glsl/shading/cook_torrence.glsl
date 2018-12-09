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

// sample weight for GGX specular samples if used in unidirectional tracing
float ggx_sample_weight(float alpha, vec3 normal, vec3 i, vec3 o, vec3 m) {
    float G = ggx_G1(i, m, normal, alpha) * ggx_G1(o, m, normal, alpha);

    // cos(theta) * bdrf / Fresnel / sampling_pdf
    // cos(theta) * D * G  / (4.0 * |i.n| * |o.n|) / (D * |m.n| / (4.0 * |o.m|))
    // cos(theta) * G * |o.m| / (|i.n| * |o.n| * |m.n|) // cos(theta) = |o.n|
    // G * |o.m| / (|i.n| * |m.n|)   // |o.m| = |i.m| (half vector)
    // G * |i.m| / (|i.n| * |i.n|)
    return dot(i, m) * G  / (dot(i, normal) * dot(m, normal));
    // f / p without Fresnel term
}

float sampling_pdf_ggx(int material_id, bool going_out, vec3 normal, vec3 ray_in, vec3 ray_out) {
    float alpha = get_roughness(material_id);
    vec3 m = normalize(-ray_in + ray_out);
    float D = ggx_D(normal, m, alpha);

    float ch_vars = 1.0 / (4.0 * dot(ray_out, m));
    return D * dot(m, normal) * ch_vars;
}

color_type brdf_cos_weighted(int material_id, bool going_out, vec3 normal, vec3 ray_in, vec3 ray_out) {
    color_type specular;
    color_type reflection_color = get_reflectivity(material_id);
    color_type diffuse = get_diffuse(material_id) / M_PI;
    if (color2prob(reflection_color) > 0.0) {
        vec3 m = normalize(-ray_in + ray_out);
        float alpha = get_roughness(material_id);

        float cosT = max(min(dot(ray_out, m), 1.0), 0.0);
        color_type F = fresnel_schlick_term(cosT, reflection_color);
        float G = ggx_G1(-ray_in, m, normal, alpha) * ggx_G1(ray_out, m, normal, alpha);
        float D = ggx_D(normal, m, alpha);

        specular = F * D * G / (4.0 * dot(ray_out, m) * dot(-ray_in, normal));
        // note: this is not mathematically exact for the microfacet model:
        // should be something like \int (1.0 - F(m)) p(m) dm over all
        // microfacet normals m, but seems to look fine
        diffuse *= (1.0 - F);
    } else {
        specular = reflection_color; // = 0
    }
    return (specular + diffuse) * dot(ray_out, normal);
}

float get_specular(int material_id) {
    float r = color2prob(get_reflectivity(material_id));
    float t = color2prob(get_transparency(material_id));
    float d = color2prob(get_diffuse(material_id));
    float shininess = 1.0 - (1.0 - r) * (1.0 - t);
    float diffuse = d * (1.0 - shininess);
    float den = shininess + diffuse;
    if (den <= 0.0) return 0.0;
    return shininess / (shininess +  diffuse);
}

float sampling_pdf(int material_id, bool going_out, vec3 normal, vec3 ray_in, vec3 ray_out) {
    float specular = get_specular(material_id);
    return specular * sampling_pdf_ggx(material_id, going_out, normal, ray_in, ray_out) +
      (1.0 - specular) * dot(normal, ray_out) / M_PI; // lambert
}

float sample_ray_and_prob(int material_id, bool going_out, vec3 normal, inout vec3 ray, out color_type weight, inout rand_state rng) {
    float specular = get_specular(material_id);
    vec3 ray_in = ray;

    if (rand_next_uniform(rng) < specular) {
      float alpha = get_roughness(material_id);

      // microfacet normal
      vec3 m = sample_ggx(normal, alpha, rng);

      color_type F = fresnel_schlick_term(
        max(min(dot(-ray_in, m), 1.0), 0.0), // cos(theta)
        get_reflectivity(material_id));

      color_type transparency = (1.0 - F)*get_transparency(material_id);
      float transmission_prob = color2prob(transparency);

      bool selected_transmission = rand_next_uniform(rng) < transmission_prob;
      if (selected_transmission) {
          F = transparency / transmission_prob;

          // refraction
          float eta = 1.0 / get_ior(material_id);

          if (going_out) {
            // simplification: "out" of any object is always vacuum
            // and no nested transparent objects are supported
            eta = 1.0 / eta;
          }

          // see https://www.khronos.org/registry/OpenGL-Refpages/gl4/html/refract.xhtml
          // Snell's law for refraction
          float d = dot(m, ray);
          float k = 1.0 - eta*eta * (1.0 - d*d);
          if (k < 0.0) {
              // total reflection
              ray = ray - 2.0*d*m;
          } else {
              ray = eta * ray - (eta * d + sqrt(k)) * m;
          }
      } else {
          F *= 1.0 / (1.0 - transmission_prob);

          // reflection
          ray = ray - 2.0*dot(m, ray)*m;
      }

      // perfectly shiny surface cannot use bidirectional tracing
      // also using unidirectional shading for refraction (for simplicity)
      if (alpha <= 0.0 || selected_transmission) {
          float w = ggx_sample_weight(alpha, normal, -ray_in, ray, m);
          if (w <= 0.0) return 0.0;
          weight = w * F;
          return -1.0;
      }
    } else {
      ray = get_random_cosine_weighted(normal, rng);
    }

    float pdf = sampling_pdf(material_id, going_out, normal, ray_in, ray);
    if (pdf <= 0.0) return 0.0;
    weight = brdf_cos_weighted(material_id, going_out, normal, ray_in, ray) / pdf;
    return pdf;
}

bool sample_ray(int material_id, bool going_out, vec3 normal, inout vec3 ray, out color_type weight, inout rand_state rng) {
    return sample_ray_and_prob(material_id, going_out, normal, ray, weight, rng) != 0.0;
}
