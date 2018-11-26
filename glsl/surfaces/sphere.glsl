/**
 * @param ray_pos: ray origin
 * @param ray: ray direction (normalized)
 * @param is_inside: true if ray is inside this object
 * @rerturn vec4(outer_unit_normal, intersection_distance)
 */
vec4 sphere_intersection(vec3 pos, vec3 ray, bool is_inside, float sphere_r) {
    // ray-sphere intersection
    vec3 d = pos; // - sphere_pos; // <-- assumed to be origin

    float dotp = dot(d,ray);
    float c_coeff = dot(d,d) - sphere_r*sphere_r;
    float ray2 = dot(ray, ray);
    float discr = dotp*dotp - ray2*c_coeff;

    const vec4 NO_INTERSECTION = vec4(0.0, 0.0, 0.0, -1.0);
    if (discr < 0.0) return NO_INTERSECTION;

    float sqrt_discr = sqrt(discr);
    float dist = -dotp - sqrt_discr;
    if (is_inside) {
      dist += sqrt_discr*2.0;
    }
    dist /= ray2;
    vec3 normal = (d + ray*dist) / sphere_r;

    return vec4(normal, dist);
}
