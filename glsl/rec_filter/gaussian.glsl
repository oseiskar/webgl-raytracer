#include "rand"

#ifndef GAUSS_FILTER_RADIUS
#define GAUSS_FILTER_RADIUS 0.5
#endif

vec2 get_rec_filter_sample(rand_state rng) {
  return rand_next_gauss3(rng).xy * GAUSS_FILTER_RADIUS;
}
