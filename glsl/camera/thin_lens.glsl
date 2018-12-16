#include "scene"
#include "util/camera_helpers.glsl"

void get_camera_ray(vec2 screen_pos, vec2 resolution, out vec3 ray_pos, out vec3 ray, inout rand_state rng) {
    vec3 cam_pos, cam_x, cam_y, cam_z;
    float fov_angle;

    get_pinhole_camera(cam_pos, cam_x, cam_y, cam_z, fov_angle);
    vec2 ccd_pos = get_ccd_pos(screen_pos, resolution, rng);
    ray = normalize(ccd_pos.x*cam_x + ccd_pos.y*cam_y + 1.0/tan(fov_angle*0.5)*cam_z);

    float focus = get_focus_distance();
    float aperture = get_aperture_size();
    vec3 focus_point = cam_pos + focus*ray;
    vec2 aperture_sample = normalize(rand_next_gauss3(rng).xy) * sqrt(rand_next_uniform(rng));
    ray_pos = cam_pos + (aperture_sample.x * cam_x + aperture_sample.y * cam_y) * aperture;
    ray = normalize(focus_point - ray_pos);
}
