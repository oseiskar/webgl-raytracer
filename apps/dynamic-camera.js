/* global THREE */

function DynamicCamera(orbitEl, {
  phiRad = 0, thetaRad = 0, distance = 1, target = [0, 0, 0]
} = {}) {
  // parameters not used in practice
  const camera = new THREE.PerspectiveCamera(45, 640 / 480, 1, 10000);
  camera.up = new THREE.Vector3(0, 1, 0);
  camera.position.y = 1;

  const orbitControls = new THREE.OrbitControls(camera, orbitEl);
  orbitControls.update();

  const sp = new THREE.Spherical();
  sp.radius = orbitControls.getDistance();
  sp.phi = orbitControls.getPolarAngle();
  sp.theta = orbitControls.getAzimuthalAngle();

  sp.phi = Math.PI / 2 - phiRad;
  sp.theta = thetaRad - Math.PI / 2;
  sp.radius = distance;
  orbitControls.object.position.setFromSpherical(sp);
  orbitControls.update();

  let changed = true;

  orbitControls.addEventListener('change', () => {
    changed = true;
  });

  this.wasChanged = () => {
    const was = changed;
    changed = false;
    return was;
  };

  this.getValues = () => {
    const a1 = -orbitControls.getAzimuthalAngle();
    const a2 = Math.PI / 2 - orbitControls.getPolarAngle();
    const d = orbitControls.getDistance();

    const rotAzimuth = [[Math.cos(a1), Math.sin(a1)], [-Math.sin(a1), Math.cos(a1)]];

    function applyRotAzimuth(v) {
      const r = rotAzimuth;
      return [r[0][0] * v[0] + r[0][1] * v[1], r[1][0] * v[0] + r[1][1] * v[1], v[2]];
    };

    const dirFwd = [0, Math.cos(a2), -Math.sin(a2)];
    const dirRight = [1, 0, 0];
    const dirDown = [0, -Math.sin(a2), -Math.cos(a2)];
    const trg = [
      orbitControls.target.x + target[0],
      -orbitControls.target.z + target[1],
      orbitControls.target.y + target[2]];

    const camZ = applyRotAzimuth(dirFwd);
    const pos = [-camZ[0] * d + trg[0], -camZ[1] * d + trg[1], -camZ[2] * d + trg[2]];

    return {
      u_cam_pos: pos,
      u_cam_x: applyRotAzimuth(dirRight),
      u_cam_y: applyRotAzimuth(dirDown),
      u_cam_z: camZ
    };
  };
}

module.exports = DynamicCamera;
