#include "parameters"
#include "renderer"

uniform vec2 resolution;

void main() {
    gl_FragColor = vec4(render(gl_FragCoord.xy, resolution), 1.0);
}
