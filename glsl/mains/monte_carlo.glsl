#include "parameters"
#include "renderer"

uniform vec2 resolution;
uniform float frame_number;
uniform sampler2D base_image;

void main() {
    vec3 cur_color = render(gl_FragCoord.xy, resolution);
    vec3 base_color = texture2D(base_image, gl_FragCoord.xy / resolution.xy).xyz;
    gl_FragColor = vec4(base_color + (cur_color - base_color)/(frame_number+1.0), 1.0);
}
