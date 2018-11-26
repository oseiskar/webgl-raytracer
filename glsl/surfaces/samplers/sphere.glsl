#include "rand"
#include "util/math.glsl"

void sphere_sample(inout rand_state rng, out vec3 pos, out vec3 normal, float radius) {
    vec3 n = normalize(rand_next_gauss3(rng));
    normal = n;
    pos = n*radius;
}

#define get_sphere_area(radius) (4.0*M_PI*(radius)*(radius))
