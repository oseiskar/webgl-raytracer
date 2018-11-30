vec4 plane_intersection(vec3 pos, vec3 ray, vec3 plane_normal) {
    float d = dot(ray, plane_normal);
    float dist = -dot(pos, plane_normal) / d;
    vec3 normal = plane_normal * -sign(d);
    return vec4(plane_normal, dist);
}
