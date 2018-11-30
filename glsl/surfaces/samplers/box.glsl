#include "rand"
#include "util/math.glsl"

void box_sample(inout rand_state rng, out vec3 pos, out vec3 normal, vec3 sz) {

    vec3 sides = vec3(sz.y*sz.z, sz.x*sz.z, sz.x*sz.y);
    sides *= 1.0 / (sides.x + sides.y + sides.z);

    float u = rand_next_uniform(rng)*2.0 - 1.0;
    float v = rand_next_uniform(rng)*2.0 - 1.0;

    float p = rand_next_uniform(rng);

    bool side;

    if (p < sides.x) {
        side = p < sides.x * 0.5;
        normal = vec3(1,0,0);
        pos = vec3(1, u, v);
    }
    else {
      p -= sides.x;
      if (p < sides.y) {
          side = p < sides.y * 0.5;
          normal = vec3(0,1,0);
          pos = vec3(u, 1, v);
      }
      else {
          p -= sides.y;
          side = p < sides.z * 0.5;
          normal = vec3(0,0,1);
          pos = vec3(u, v, 1);
      }
    }

    pos *= sz;
    if (side) {
        normal = -normal;
        pos = -pos;
    }
}

float get_box_area(vec3 sz) {
  return (sz.x*sz.y + sz.x*sz.z + sz.y*sz.z) * 8.0; // 8 = 2*2*2 
}
