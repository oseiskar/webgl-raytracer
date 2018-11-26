#!/bin/bash
set -eux
python folder_tree_to_js_requires.py --pattern '*.glsl*' glsl/ > glsl/index.js
