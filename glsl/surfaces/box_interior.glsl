vec4 box_interior_intersection(vec3 pos, vec3 ray, bool inside, vec3 box_size) {
    vec3 corner = box_size*sign(ray);
    vec3 diff = pos - corner; // - box_center; <-- assumed to be 0
    vec3 dists = -diff / ray;

    const float MAX_DIST = 1e10;
    if (ray.x == 0.0) dists.x = MAX_DIST;
    if (ray.y == 0.0) dists.y = MAX_DIST;
    if (ray.z == 0.0) dists.z = MAX_DIST;

    vec3 normal = vec3(0.0, 0.0, 1.0);
    float dist = min(dists.x, min(dists.y, dists.z));

    if (dist == dists.x) normal = vec3(1.0, 0.0, 0.0);
    else if (dist == dists.y) normal = vec3(0.0, 1.0, 0.0);

    normal = normal * -sign(ray);
    return vec4(normal, dist);
}
