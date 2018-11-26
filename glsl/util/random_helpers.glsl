#include "rand"

vec3 get_random_cosine_weighted(vec3 normal, inout rand_state rng) {
    // cosine weighted
    vec3 dir = rand_next_gauss3(rng);
    // project to surface
    dir = normalize(dir - dot(dir, normal)*normal);
    float r = rand_next_uniform(rng);
    return normal * sqrt(1.0 - r) + dir * sqrt(r);
}

// assuming x is random uniform in [0,1], return x < prob and make
// x a new random uniform in [0, 1] independent of this choice
bool random_choice(float prob, inout float x) {
    if (x < prob) {
      x /= prob;
      return true;
    } else {
      x = (x - prob) / (1.0 - prob);
      return false;
    }
}
