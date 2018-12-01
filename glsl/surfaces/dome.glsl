// dome is just the interior of a sphere
vec4 dome_intersection(vec3 pos, vec3 ray, float sphere_r) {
    // ray-sphere-interior intersection
    vec3 d = pos; // - sphere_pos; // <-- assumed to be origin

    float dotp = dot(d,ray);
    float c_coeff = dot(d,d) - sphere_r*sphere_r;
    float ray2 = dot(ray, ray);
    float discr = dotp*dotp - ray2*c_coeff;

    float sqrt_discr = sqrt(discr);
    float dist = -dotp + sqrt_discr;
    dist /= ray2;
    vec3 normal = (d + ray*dist) / sphere_r;

    return vec4(normal, dist);
}
