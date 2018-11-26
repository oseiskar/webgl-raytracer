function parseTracerNameFromSource(source) {
  if (!source) throw new Error('missing source');
  const match = /^\s*vec4\s+(\w+_intersection)\(/m.exec(source);
  const r = match && match[1];
  if (!r) throw new Error('failed to infer tracer name from source');
  return r;
}

module.exports = parseTracerNameFromSource;
