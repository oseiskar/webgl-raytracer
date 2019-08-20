
# WebGL raytracer app

https://oseiskar.github.io/webgl-raytracer/

The idea is to create a framework for composing different WebGL raytracers from
shared pieces of GLSL fragment shader code. Different combination of rendering
methods, material models, cameras and data structures may be used.

Utilizes my [glsl-bench](https://github.com/oseiskar/glsl-bench) library
(included as a submodule) & TWGL for the WebGL boilerplate, for example,
everything not related to "worlds with two triangles".

![img](https://oseiskar.github.io/img/webgl-raytracer.png)

## Local development

### Installation

    npm install
    npm run build
    # npm run watch # for hot reloading

### Usage

    python -m SimpleHTTPServer # or similar
    # then go to http://localhost:8000/

## Features

### Implemented

 - [x] reflection, refraction, fresnel... the usual stuff
 - [x] some basic surface types: box, sphere, plane
 - [x] distance fields
 - [x] 1-light-vertex [bidirectional path tracer](https://graphics.stanford.edu/courses/cs348b-03/papers/veach-chapter10.pdf)
 - [x] [GGX microfacet model](https://www.cs.cornell.edu/~srm/publications/EGSR07-btdf.pdf)
   for specular highlights
 - [x] [thin-lens](http://www.pbr-book.org/3ed-2018/Camera_Models/Projective_Camera_Models.html#TheThinLensModelandDepthofField),
   pinhole and orthographic camera models
 - [x] tent [reconstruction filter](https://imgur.com/a/jksVw)
 - [x] image-based and procedural textures
 - [x] fog
 - [x] tone mapping / gamma correction (sRGB)

### To-do list

 - [ ] faster subsurface scattering
 - [ ] cylinders and cones
 - [ ] constructive solid geometry
 - [ ] triangle meshes & octrees
 - [ ] interval arithmetic implicit surfaces
 - [ ] spectral color model (enables dispersion)
 - [ ] reconstruction filter for blurring highlights

## References

Miscellaneous interesting free online material on raytracing

 * [Physically Based Rendering](http://www.pbr-book.org/). A book that won an Oscar ([really](https://www.youtube.com/watch?v=7d9juPsv1QU))
 * [Eric Veach's PhD thesis from 1997](http://graphics.stanford.edu/papers/veach_thesis/) introduces _bidirectional path tracing_
 * SIGGRAPH material, e.g., [2012](https://blog.selfshadow.com/publications/s2012-shading-course/), [2013](https://blog.selfshadow.com/publications/s2013-shading-course/)
 * https://agraphicsguy.wordpress.com/
 * http://www.codinglabs.net/article_physically_based_rendering_cook_torrance.aspx
