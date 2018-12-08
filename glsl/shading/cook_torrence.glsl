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

color_type get_color(int material_id) {
    color_type reflection_color = get_reflectivity(material_id);
    float r = color2prob(reflection_color);

    const float mystery_multiplier = 2.0; // ????
    return (get_diffuse(material_id) * (1.0 - r) + reflection_color) * mystery_multiplier;
}

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

float sampling_pdf(int material_id, bool going_out, vec3 normal, vec3 ray_in, vec3 ray_out) {
    float alpha = get_roughness(material_id);
    vec3 m = normalize(-ray_in + ray_out);
    float D = ggx_D(normal, m, alpha);

    float ch_vars = 1.0 / (4.0 * dot(ray_out, m));
    return D * dot(m, normal) * ch_vars;
}

color_type brdf_cos_weighted(int material_id, bool going_out, vec3 normal, vec3 ray_in, vec3 ray_out) {
    vec3 m = normalize(-ray_in + ray_out);
    float alpha = get_roughness(material_id);

    color_type color = get_color(material_id);
    float cosT = max(min(dot(ray_out, m), 1.0), 0.0);

    //color_type weight = ggx_sample_weight(alpha, normal, -ray_in, ray_out, m) *
    //  fresnel_schlick_term(cosT, color);
    //return sampling_pdf(material_id, going_out, normal, ray_in, ray_out) * weight;

    color_type F = fresnel_schlick_term(cosT, color);
    float G = ggx_G1(-ray_in, m, normal, alpha) * ggx_G1(ray_out, m, normal, alpha);
    float D = ggx_D(normal, m, alpha);
    // ch_vars = 1 / (4 * |o.m|)
    // pdf = D * |m.n|* ch_vars
    // F * w * pdf
    // F * |o.n| * G / (|i.n| * |m.n|) * D * |m.n| * ch_vars
    // F * D * G * |o.n| / |i.n| * ch_vars
    // F * D * G * |o.n| / (4 * |i.n| * |o.n|)
    return F * D * G / (4.0 * dot(ray_out, m) * dot(-ray_in, normal)) * dot(ray_out, normal);
}

bool sample_ray(int material_id, bool going_out, vec3 normal, inout vec3 ray, out color_type weight, inout rand_state rng) {
    float alpha = get_roughness(material_id);

    // microfacet normal
    vec3 m = sample_ggx(normal, alpha, rng);
    vec3 o = ray - 2.0*dot(m, ray)*m;

    color_type color = get_color(material_id);
    float cosT = max(min(dot(o, m), 1.0), 0.0);
    color = fresnel_schlick_term(cosT, color);

    weight = color * ggx_sample_weight(alpha, normal, -ray, o, m);
    ray = o;
    return true;
}

float sample_ray_and_prob(int material_id, bool going_out, vec3 normal, inout vec3 ray, out color_type weight, inout rand_state rng) {
    vec3 ray_in = ray;
    sample_ray(material_id, going_out, normal, ray, weight, rng);
    return sampling_pdf(material_id, going_out, normal, ray_in, ray);
}
