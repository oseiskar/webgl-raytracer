vec4 half_space_intersection(vec3 pos, vec3 ray, bool is_inside, vec3 plane_normal) {
    float s = -dot(ray, plane_normal);
    if ((dot(pos, ray) > 0.0) != is_inside) return vec4(0,0,0,-1);
    float dist = -dot(pos, plane_normal) / dot(ray,plane_normal);
    return vec4(plane_normal, dist);
}
