vec4 half_space_intersection(vec3 pos, vec3 ray, bool is_inside, vec3 plane_normal) {
    const float plane_h = 0.0; // TODO
    float s = 1.0;
    if (is_inside) s = -1.0; // TODO: check
    float dist = (plane_h - s*dot(pos, plane_normal)) / (s*dot(ray,plane_normal));
    return vec4(plane_normal, dist);
}
