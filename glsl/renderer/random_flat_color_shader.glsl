#include "scene"
#include "rand"
#include "camera"

vec3 get_random_color(int which_object, vec3 normal) {
  float objCol = float(which_object - which_object / 5) / 5.0;
  if (normal.x == 0.0) {
    return vec3(objCol, (1.0 + sign(normal.y))*0.5, (1.0 + sign(normal.z))*0.5);
  } else if (normal.y == 0.0) {
    return vec3((1.0 + sign(normal.x))*0.5, objCol, (1.0 - sign(normal.z))*0.5);
  } else if (normal.z == 0.0) {
    return vec3((1.0 - sign(normal.x))*0.5, (1.0 - sign(normal.y))*0.5, objCol);
  }
  else {
    return vec3(objCol, 1.0 - objCol, objCol*objCol);
  }
}

vec3 render(vec2 xy, vec2 resolution) {
    rand_state rng;
    rand_init(rng);

    vec3 ray_pos;
    vec3 ray;
    get_camera_ray(xy, resolution, ray_pos, ray, rng);

    // find intersection
    vec4 intersection; // vec4(normal.xyz, distance)
    int which_object = find_intersection(ray_pos, ray, 0, 0, intersection);

    if (which_object == 0) {
        return vec3(0.0, 0.0, 0.0);
    } else {
        return get_random_color(which_object, intersection.xyz);
    }
}
