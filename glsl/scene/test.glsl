#include "surfaces/sphere.glsl"
#include "surfaces/box_interior.glsl"
#include "util/math.glsl"
#include "rand"

// secene geometry
#define OBJ_NONE 0
#define OBJ_SPHERE_1 1
#define OBJ_SPHERE_2 2
#define OBJ_BOX 3
#define OBJ_LIGHT_1 4
#define OBJ_LIGHT_2 5
#define N_OBJECTS 6

#define N_LIGHTS 2

#define ROOM_H 2.0
#define ROOM_W 5.0

#define sphere_1_pos vec3(0.0, 0.0, 0.5)
#define sphere_1_r 0.5
#define sphere_2_pos vec3(-1.1, 0.3, 0.25)
#define sphere_2_r 0.25

#define BOX_SIZE (vec3(ROOM_W, ROOM_W, ROOM_H)*0.5)
#define BOX_CENTER vec3(0.0, 0.0, ROOM_H*0.5)

#define light_r 0.4

#define light_1_pos vec3(-ROOM_W*0.5, 0.0, ROOM_H)
#define light_2_pos vec3(0.0, ROOM_W*0.5, ROOM_H)

// materials
#define light_1_emission vec3(0.8, 0.8, 1.0)*100.0;
#define light_2_emission vec3(1.0, 0.8, 0.6)*100.0;

#define sphere_1_diffuse vec3(.5, .8, .9) * 0.5
#define box_diffuse vec3(1., 1., 1.)*.7 * 0.5

// helpers
#define UNIT_SPHERE_AREA (4.0*M_PI)
#define ZERO_VEC3 vec3(0.0, 0.0, 0.0)

int find_intersection(vec3 ray_pos, vec3 ray, int prev_object, int inside_object, out vec4 intersection) {
    int which_object = OBJ_NONE;
    vec4 cur_isec;
    vec3 rel_pos;
    bool inside;

    inside = inside_object == OBJ_SPHERE_1;
    if (inside || prev_object != OBJ_SPHERE_1) {
        rel_pos = ray_pos - sphere_1_pos;
        cur_isec = sphere_intersection(rel_pos, ray, inside, sphere_1_r);
        if (cur_isec.w > 0.0) {
            intersection = cur_isec;
            which_object = OBJ_SPHERE_1;
        }
    }

    inside = inside_object == OBJ_SPHERE_2;
    if (inside || prev_object != OBJ_SPHERE_2) {
        rel_pos = ray_pos - sphere_2_pos;
        cur_isec = sphere_intersection(rel_pos, ray, inside, sphere_2_r);
        if (cur_isec.w > 0.0 && (cur_isec.w < intersection.w || which_object == OBJ_NONE)) {
            intersection = cur_isec;
            which_object = OBJ_SPHERE_2;
        }
    }

    // The box interior is non-convex and can handle that.
    // "Inside" not supported here
    rel_pos = ray_pos - BOX_CENTER;
    cur_isec = box_interior_intersection(rel_pos, ray, false, BOX_SIZE);
    if (cur_isec.w > 0.0 && (cur_isec.w < intersection.w || which_object == OBJ_NONE)) {
        intersection = cur_isec;
        which_object = OBJ_BOX;
    }

    inside = inside_object == OBJ_LIGHT_1;
    if (inside || prev_object != OBJ_LIGHT_1) {
        rel_pos = ray_pos - light_1_pos;
        cur_isec = sphere_intersection(rel_pos, ray, inside, light_r);
        if (cur_isec.w > 0.0 && (cur_isec.w < intersection.w || which_object == OBJ_NONE)) {
            intersection = cur_isec;
            which_object = OBJ_LIGHT_1;
        }
    }

    inside = inside_object == OBJ_LIGHT_2;
    if (inside || prev_object != OBJ_LIGHT_2) {
        rel_pos = ray_pos - light_2_pos;
        cur_isec = sphere_intersection(rel_pos, ray, inside, light_r);
        if (cur_isec.w > 0.0 && (cur_isec.w < intersection.w || which_object == OBJ_NONE)) {
            intersection = cur_isec;
            which_object = OBJ_LIGHT_2;
        }
    }

    return which_object;
}

bool get_emission(int which_obj, out vec3 emission) {
  if (which_obj == OBJ_LIGHT_1) {
    emission = light_1_emission;
  } else if (which_obj == OBJ_LIGHT_2) {
    emission = light_2_emission;
  } else {
    emission = ZERO_VEC3;
    return false;
  }
  emission *= 1.0 / (UNIT_SPHERE_AREA * light_r * light_r);
  return true;
}

vec3 get_diffuse(int which_object) {
  if (which_object == OBJ_SPHERE_1 || which_object == OBJ_SPHERE_2) {
    return sphere_1_diffuse;
  } else if (which_object == OBJ_BOX) {
    return box_diffuse;
  } else {
    return ZERO_VEC3;
  }
}

float get_reflectivity(int which_object) {
  if (which_object == OBJ_SPHERE_2) {
    return 0.1;
  } else {
    return 0.0;
  }
}

float get_transparency(int which_object) {
  if (which_object == OBJ_SPHERE_2) {
    return 1.0; // sampled after reflectivity
  }
  return 0.0;
}

// index of refraction
float get_ior(int which_object) {
  if (which_object == OBJ_SPHERE_2) {
    return 1.5;
  }
  return 1.0;
}

#ifndef PINHOLE_CAMERA_INCLUDED
#define PINHOLE_CAMERA_INCLUDED

void get_pinhole_camera(out vec3 cam_pos, out vec3 cam_x, out vec3 cam_y, out vec3 cam_z, out float fov_angle) {
  // define camera
  fov_angle = DEG2RAD(50.0);
  const float cam_theta = DEG2RAD(300.0);
  const float cam_phi = DEG2RAD(5.0);
  const float cam_dist = 2.6;
  vec3 camera_target = vec3(-0.5, 0.0, 0.35);

  cam_z = vec3(cos(cam_theta), sin(cam_theta), 0.0);
  cam_x = vec3(cam_z.y, -cam_z.x, 0.0);
  cam_z = cos(cam_phi)*cam_z + vec3(0,0,-sin(cam_phi));
  cam_y = cross(cam_x, cam_z);
  cam_pos = -cam_z * cam_dist + camera_target;
}

#endif

// for bidirectional tracing
int select_light(out vec3 light_point, out vec3 light_normal, out float sample_prob_density_per_area, inout rand_state rng) {
      light_normal = normalize(rand_next_gauss3(rng));
      light_point = light_normal * light_r;
      sample_prob_density_per_area = 1.0 / (UNIT_SPHERE_AREA*light_r*light_r * float(N_LIGHTS));

      int light_object = OBJ_NONE;
      if (rand_next_uniform(rng) > 0.5) {
        light_point += light_1_pos;
        light_object = OBJ_LIGHT_1;
      } else {
        light_point += light_2_pos;
        light_object = OBJ_LIGHT_2;
      }

      return light_object;
}
