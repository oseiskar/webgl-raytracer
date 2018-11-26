
# Simple WebGL raytracer framework

The idea is to create a framework for composing different WebGL raytracers from
shared pieces of GLSL fragment shader code. Different combination of rendering
methods, material models, cameras and data structures may be used.

Utilizes my `glsl-bench` library (included as a submodule) & TWGL for the WebGL
boilerplate, for example, everything not related to "worlds with two triangles".

### Installation

    npm install
    npm run build
    # npm run watch # for hot reloading

### Usage

    python -m SimpleHTTPServer # or similar
    # then go to http://localhost:8000/?tracer=test
