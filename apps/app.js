const dynamicTracers = {
  test: require('./fixed_specs/test.js'),
  moving_camera: require('./fixed_specs/moving_camera.js')
};

const params = new URLSearchParams(window.location.search);
const element = document.getElementById('shader-container');
const appName = params.get('tracer')
const spec = dynamicTracers[appName];
if (!spec) {
  throw new Error(`${appName} not found`);
}

const bench = new GLSLBench({ element, spec });
bench.onError((err) => {
  console.log(("\n"+bench.fragmentShaderSource).split("\n"));
  throw new Error(err);
});
