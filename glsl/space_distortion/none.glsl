
int find_intersection_distorted(vec3 pos, vec3 ray, int prev_object, int inside_object, out vec3 intersection_pos, out vec3 intersection_normal) {
  // no space distortion
  vec4 intersection;
  int which_object = find_intersection(pos, ray, prev_object, inside_object, intersection);
  if (which_object != 0) {
    intersection_pos = pos + ray*intersection.w;
    intersection_normal = intersection.xyz;
  }
  return which_object;
}
