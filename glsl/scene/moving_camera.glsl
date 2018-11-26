uniform vec2 mouse;

#include "util/math.glsl"
#define PINHOLE_CAMERA_INCLUDED

void get_pinhole_camera(out vec3 cam_pos, out vec3 cam_x, out vec3 cam_y, out vec3 cam_z, out float fov_angle) {
  // define camera
  fov_angle = DEG2RAD(50.0);
  float cam_theta = DEG2RAD(300.0 + (mouse.x-0.5)*360.0);
  float cam_phi = DEG2RAD(20.0 + (mouse.y-0.5)*50.0);
  const float cam_dist = 2.6;
  vec3 camera_target = vec3(-0.5, 0.0, 0.35);

  cam_z = vec3(cos(cam_theta), sin(cam_theta), 0.0);
  cam_x = vec3(cam_z.y, -cam_z.x, 0.0);
  cam_z = cos(cam_phi)*cam_z + vec3(0,0,-sin(cam_phi));
  cam_y = cross(cam_x, cam_z);
  cam_pos = -cam_z * cam_dist + camera_target;
}

#include "scene/test.glsl"
