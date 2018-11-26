#!/usr/bin/python
import os, sys, argparse, fnmatch, json

def parse_args():
    args = argparse.ArgumentParser(description=\
        'recursively read folders structure to a single JS file with node-style requires')
    args.add_argument('target_dir')
    args.add_argument('--pattern')
    return args.parse_args()

args = parse_args()

def require_func(path):
    return "fs.readFileSync(__dirname + '/%s', 'utf-8')" % path

def dir_to_requires(path, root=None):
    if root is None: root = path
    r = []
    for f in os.listdir(path):
        full = os.path.join(path, f)
        if os.path.isdir(full):
            sub = dir_to_requires(full, root)
            if len(sub) > 0:
                r.append((f, sub))
        elif args.pattern is None or fnmatch.fnmatch(f, args.pattern):
            r.append((f, require_func(os.path.relpath(full, root))))
    if len(r) == 0: return ''
    return '{' + ','.join([json.dumps(k) + ":" + v for k, v in r ]) + '}'

print("""
const fs = require('fs');
module.exports = %s;
""" % dir_to_requires(args.target_dir))
