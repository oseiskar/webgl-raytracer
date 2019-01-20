#include "rand"

float tent_filter_transformation(float x) {
  x *= 2.0;
  if (x < 1.0) return sqrt(x) - 1.0;
  return 1.0 - sqrt(2.0 - x);
}

vec2 get_rec_filter_sample(rand_state rng) {
  return vec2(
    tent_filter_transformation(rand_next_uniform(rng)),
    tent_filter_transformation(rand_next_uniform(rng)));
}
