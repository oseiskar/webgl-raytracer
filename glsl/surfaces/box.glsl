vec4 box_intersection(vec3 pos, vec3 ray, bool inside, vec3 box_size) {
    float s = 1.0;
    if (inside) s = -1.0;
    vec3 corner = pos + s*box_size*sign(ray); // - box_center; <-- assumed to be 0
    vec3 dists = -corner / ray;

    // handle corner cases (especially with orthogonal cameras)
    float no_isec_dist = -1.0;
    if (inside) no_isec_dist = 1e10;
    if (ray.x == 0.0) dists.x = no_isec_dist;
    if (ray.y == 0.0) dists.y = no_isec_dist;
    if (ray.z == 0.0) dists.z = no_isec_dist;

    float dist;
    if (inside) {
      dist = min(dists.x, min(dists.y, dists.z));
    } else {
      dist = max(dists.x, max(dists.y, dists.z));
    }

    vec3 normal = vec3(0.0, 0.0, 1.0);
    if (dist == dists.x) normal = vec3(1.0, 0.0, 0.0);
    else if (dist == dists.y) normal = vec3(0.0, 1.0, 0.0);

    if (!inside) {
      vec3 isec_pos = pos + ray*dist;
      vec3 bounds = (box_size - abs(isec_pos)) * (1.0 - normal);
      if (bounds.x < 0.0 || bounds.y < 0.0 || bounds.z < 0.0) return vec4(0,0,0,-1);
    }

    normal = normal * -s * sign(ray);
    return vec4(normal, dist);
}
