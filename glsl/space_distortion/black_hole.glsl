
#ifndef BLACK_HOLE_MAX_REVOLUTIONS
#define BLACK_HOLE_MAX_REVOLUTIONS 2
#endif

#ifndef BLACK_HOLE_NSTEPS
#define BLACK_HOLE_NSTEPS 50
#endif

#ifndef BLACK_HOLE_RADIUS
#define BLACK_HOLE_RADIUS 1.0
#endif

#ifndef BLACK_HOLE_POSITION
#define BLACK_HOLE_POSITION vec3(0,0, 0.1) //vec3(0,0,0)
#endif

int find_intersection_and_normal(vec3 pos, vec3 ray, int prev_object, int inside_object, float max_distance, out vec3 intersection_pos, out vec3 intersection_normal) {
  // black hole

  vec3 old_pos = pos;
  const vec3 black_hole_pos = BLACK_HOLE_POSITION;

  // initial conditions
  pos = (pos - black_hole_pos) / BLACK_HOLE_RADIUS;

  float u = 1.0 / length(pos), old_u;
  float u0 = u;

  vec3 normal_vec = normalize(pos);
  vec3 tangent_vec = normalize(cross(cross(normal_vec, ray), normal_vec));

  float du = -dot(ray,normal_vec) / dot(ray,tangent_vec) * u;
  float du0 = du;

  float phi = 0.0;
  float total_distance = 0.0;

  for (int j=0; j < BLACK_HOLE_NSTEPS; j++) {
    float step = float(BLACK_HOLE_MAX_REVOLUTIONS) * 2.0*M_PI / float(BLACK_HOLE_NSTEPS);

    // adaptive step size, some ad hoc formulas
    float max_rel_u_change = (1.0-log(u))*10.0 / float(BLACK_HOLE_NSTEPS);
    if ((du > 0.0 || (du0 < 0.0 && u0/u < 5.0)) && abs(du) > abs(max_rel_u_change*u) / step)
      step = max_rel_u_change*u/abs(du);

    old_u = u;

    // Leapfrog scheme
    u += du*step;
    float ddu = -u*(1.0 - 1.5*u*u);
    du += ddu*step;

    float ray_l = 100.0;

    if (u > 0.0) {
        phi += step;

        pos = (cos(phi)*normal_vec + sin(phi)*tangent_vec) / u * BLACK_HOLE_RADIUS + black_hole_pos;

        ray = pos-old_pos;
        ray_l = length(ray);
        ray = ray / ray_l;
    }
    // else ray "escapes"

    vec4 intersection;
    int which_object = find_intersection(old_pos, ray, prev_object, inside_object, intersection);
    if (which_object != 0 && intersection.w < ray_l) {
      intersection_normal = intersection.xyz;
      intersection_pos = old_pos + ray*intersection.w;
      total_distance += intersection.w;
      if (total_distance > max_distance) return 0;
      return which_object;
    }

    total_distance += ray_l;
    if (total_distace > max_distance) return 0;

    // nonpositive y means ray escaping, u > 1 means event horizon
    if (u <= 0.0 || u > 1.0) return 0;

    // when the rays bend, even non-convex objects can self-shadow
    prev_object = 0;
    old_pos = pos;
  }
  return 0;
}
