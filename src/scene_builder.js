const Mustache = require('mustache');
const tracerData = require('../glsl/index.js');

// this file is also becoming quite terrible. structuring this stuff better
// would be an interesting problem... but so far not as interesting as
// raytracing methods :)
/* eslint-disable no-param-reassign */

function positionAndRotation(m) {
  if (m.length === 3) return { position: m };

  if (m.length !== 16) throw new Error('invalid transformation, expected 3-vector or 16 entries of a 4x4 row-major matrix');

  return {
    position: [m[12], m[13], m[14]],
    rotation: [
      m[0], m[1], m[2],
      m[4], m[5], m[6],
      m[8], m[9], m[10]
    ]
  };
}

function toVec3(x) {
  if (x.length !== 3) throw new Error('expected list of length 3');
  return `vec3(${x.join(',')})`;
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; ++i) s += a[i]*b[i];
  return s;
}

function rmat2quat(mat) {
  // from https://eigen.tuxfamily.org/dox/Quaternion_8h_source.html
  let t = mat[0][0] + mat[1][1] + mat[2][2]; // = matrix trace
  let qx, qy, qz;
  if (t > 0.0) {
    t = Math.sqrt(t + 1.0);
    qw = 0.5*t;
    t = 0.5/t;
    qx = (mat[2][1] - mat[1][2]) * t;
    qy = (mat[0][2] - mat[2][0]) * t;
    qz = (mat[1][0] - mat[0][1]) * t;
    
  } else {
      let i = 0;
      if (mat[1][1] > mat[0][0])
          i = 1;
      if (mat[2][2] > mat[i][i])
          i = 2;
      let j = (i+1)%3;
      let k = (j+1)%3;

      t = Math.sqrt(mat[i][i]-mat[j][j]-mat[k][k] + 1.0);
      let qxyz = [0, 0, 0];
      qxyz[i] = 0.5 * t;
      t = 0.5/t;
      qw = (mat[k][j]-mat[j][k])*t;
      qxyz[j] = (mat[j][i]+mat[i][j])*t;
      qxyz[k] = (mat[k][i]+mat[i][k])*t;
      [qx,qy,qz] = qxyz;
  }
  const l = Math.sqrt(qw*qw + qx*qx + qy*qy + qz*qz);

  return [qx/l, qy/l, qz/l, qw/l]; // GLSL ordering
}


function buildTextureProperties(uniqueMaterials) {
  const uniqueTextures = {};
  const textures = [];
  const uniforms = {};

  uniqueMaterials
    .map(material => material.material)
    .forEach((material) => {
      Object.keys(material)
        .filter(prop => material[prop].texture)
        .forEach((property) => {
          const { texture } = material[property];
          const key = JSON.stringify(texture);
          let textureId = uniqueTextures[key];
          if (!textureId) {
            textureId = Object.keys(uniqueTextures).length + 1;
            uniqueTextures[key] = textureId;
            const textureView = { id: textureId };
            if (texture.procedural) {
              textureView.procedural = texture.procedural;
            } else {
              textureView.mapping = texture.mapping;
              uniforms[`texture_${textureId}`] = texture.source;
            }
            textures.push(textureView);
          }
          material[property].textureId = textureId;
        });
    });

  return {
    textureCode: Mustache.render(
      tracerData.templates['image_and_procedural_textures.glsl.mustache'],
      { textures }
    ),
    textureUniforms: uniforms
  };
}

function buildIfElseMaterials(uniqueMaterials, objectsById, shaderColorModel) {
  function buildGenericProperty(name, type, defaultValue) {
    let defaultVal = defaultValue;
    let formatType;
    let vectorMember;
    if (type === 'vec3') {
      formatType = toVec3;
      defaultVal = defaultVal || 'vec3(0, 0, 0)';
      vectorMember = 'xyz';
    } else {
      formatType = x => `float(${x})`;
      defaultVal = defaultVal || '0.0';
      vectorMember = 'x';
    }
    return {
      name,
      type,
      default: defaultVal,
      materials: uniqueMaterials
        .filter(mat => mat.material[name])
        .map((mat) => {
          const prop = mat.material[name];
          const r = {
            objects: mat.objects.map(obj => ({ id: obj.id }))
          };
          if (prop.textureId) {
            r.textureId = prop.textureId;
            r.vectorMember = vectorMember;
          } else {
            r.value = formatType(prop);
          }
          return r;
        })
    };
  }

  const colorType = shaderColorModel === 'rgb' ? 'vec3' : 'float';
  const colorToProb = colorType === 'vec3' ? '((c).x + (c).y + (c).z) / 3.0' : 'c';

  return Mustache.render(tracerData.templates['if_else_materials.glsl.mustache'], {
    colorType,
    colorToProb,
    materialEmissions: buildGenericProperty('emission', colorType).materials,
    properties: [
      buildGenericProperty('diffuse', colorType),
      buildGenericProperty('ior', 'float', '1.0'),
      buildGenericProperty('roughness', 'float', '0.0'),
      buildGenericProperty('reflectivity', colorType),
      buildGenericProperty('transparency', colorType),
      buildGenericProperty('mean_scattering_distance', colorType),
      buildGenericProperty('scattering_anisotropy', 'float', '0.0')
    ]
  });
}

function buildDataTextureMaterials(uniqueMaterials, objectsById, shaderColorModel) {
  function valueToVec(val) {
    if (Number.isFinite(val)) return [val, val, val, 1.0];
    if (val.length === 4) return val;
    if (val.length === 3) return val.concat([1.0]);
    throw new Error(`cannot convert ${val} to a 4-vector`);
  }

  const materialTextures = {};

  [
    ['emission', 0],
    ['diffuse', 0],
    ['reflectivity', 0],
    ['transparency', 0],
    ['ior', 1],
    ['roughness', 0],
    ['mean_scattering_distance', 0],
    ['scattering_anisotropy', 0]
  ].forEach(([property, defaultValue]) => {
    materialTextures[property] = [uniqueMaterials.map((material) => {
      if (material.material.hasOwnProperty(property)) {
        const value = material.material[property];
        if (value.texture) {
          return valueToVec(defaultValue);
        }
        return valueToVec(value);
      }
      return valueToVec(defaultValue);
    })];
  });

  const nMaterials = uniqueMaterials.length;
  const objectIds = Object.keys(objectsById).map(x => parseInt(x, 10));
  const maxObjectId = objectIds.reduce((x, y) => Math.max(x, y));
  const materialIds = [];
  for (let i = 0; i <= maxObjectId; ++i) {
    const obj = objectsById[i];
    let matId = 0;
    if (obj) matId = obj.materialId;
    materialIds.push(valueToVec(matId));
  }

  materialTextures.material_id = [materialIds];

  const colorType = shaderColorModel === 'rgb' ? 'vec3' : 'float';
  const vectorMember = colorType === 'vec3' ? 'xyz' : 'x';
  const colorToProb = colorType === 'vec3' ? '((c).x + (c).y + (c).z) / 3.0' : 'c';

  function addTextures(propertyDescription) {
    const prop = propertyDescription.name;
    return {
      textures: uniqueMaterials
        .map(material => material.material)
        .filter(x => x[prop] && x[prop].texture)
        .map(material => ({
          id: material.id,
          textureId: material[prop].textureId,
          vectorMember: propertyDescription.vectorMember
        })),
      ...propertyDescription
    };
  }

  const code = Mustache.render(tracerData.templates['texture_materials.glsl.mustache'], {
    colorType,
    maxObjectId,
    nMaterials,
    vectorMember,
    colorToProb,
    emissionTextures: addTextures({ name: 'emission', vectorMember }).textures,
    properties: [
      {
        name: 'ior',
        type: 'float',
        vectorMember: 'x'
      },
      {
        name: 'roughness',
        type: 'float',
        vectorMember: 'x'
      },
      {
        name: 'diffuse',
        type: colorType,
        vectorMember
      },
      {
        name: 'reflectivity',
        type: colorType,
        vectorMember
      },
      {
        name: 'transparency',
        type: colorType,
        vectorMember
      },
      {
        name: 'mean_scattering_distance',
        type: colorType,
        vectorMember
      },
      {
        name: 'scattering_anisotropy',
        type: 'float',
        vectorMember: 'x'
      }
    ].map(addTextures)
  });

  return { materialTextures, code };
}

function SceneBuilder() {
  const objects = [];
  let cameraParameters;
  let shaderColorModel = 'rgb';
  let enableMaterialTextures = true;
  let enableGeometryTextures = true;
  let airMaterial;
  // estimate of the relative expensiveness of rendering the scene
  let computationLoadEstimate = 1.0;
  let cameraUniforms = {};

  const deg2rad = x => x / 180.0 * Math.PI;
  const toFloat = x => `float(${x})`;

  this.setComputationLoadEstimate = (estimate) => {
    computationLoadEstimate = estimate;
    return this;
  };

  this.getComputationLoadEstimate = () => computationLoadEstimate;

  this.addObject = (surface, positionOrMatrix, material) => {
    objects.push({
      material,
      ...surface,
      ...positionAndRotation(positionOrMatrix)
    });
    return this;
  };

  this.setColorModel = (colorModel) => {
    shaderColorModel = colorModel;
    return this;
  };

  this.setAirMaterial = (material) => {
    airMaterial = { ...material };
    return this;
  };

  this.toggleDataTextures = (enabled) => {
    enableMaterialTextures = !!enabled;
    enableGeometryTextures = !!enabled;
    return this;
  };

  this.setFixedPinholeCamera = (parameters) => {
    const defaults = {
      fov: 50.0,
      pitch: 0.0,
      yaw: 0.0,
      target: [0, 0, 0],
      distance: 1,
      apertureSize: 0.01
    };
    const p = Object.assign(defaults, parameters);

    if (p.position) {
      // position-target format
      const delta = [0, 1, 2].map(i => p.target[i] - p.position[i]);
      p.distance = Math.sqrt(delta.map(x => x * x).reduce((a, b) => a + b));
      p.phiRad = -Math.atan2(delta[2], Math.sqrt(delta[0] * delta[0] + delta[1] * delta[1]));
      p.thetaRad = Math.atan2(delta[1], delta[0]);
    } else {
      // target + angles & distance format
      p.phiRad = deg2rad(-p.pitch);
      p.thetaRad = deg2rad(p.yaw);
    }

    cameraParameters = {
      type: 'fixed_camera',
      fovAngleRad: deg2rad(p.fov),
      phiRad: p.phiRad,
      thetaRad: p.thetaRad,
      // TODO: roll not supported
      distance: p.distance,
      target: p.target,
      apertureSize: p.apertureSize,
      focusDistance: p.focusDistance || p.distance
    };

    cameraParameters.transform = () => ({
      fixed: true,
      fovAngleRad: toFloat(cameraParameters.fovAngleRad),
      phiRad: toFloat(cameraParameters.phiRad),
      thetaRad: toFloat(cameraParameters.thetaRad),
      distance: toFloat(cameraParameters.distance),
      targetList: cameraParameters.target.join(','),
      apertureSize: toFloat(cameraParameters.apertureSize),
      focusDistance: toFloat(cameraParameters.focusDistance)
    });

    return this;
  };

  this.getCameraParameters = () => cameraParameters;

  this.setDynamicCamera = () => {
    cameraParameters.type = 'uniform_camera';
    return this;
  };

  this.setMotionBlurCamera = () => {
    cameraParameters.type = 'motion_blur_camera';

    function transpose(m) {
      const r = [];
      for (let i = 0; i < m[0].length; ++i) {
        r.push([]);
        for (let j = 0; j < m.length; ++j) {
          r[r.length - 1].push(m[j][i]);
        }
      }
      return r;
    }

    function getCamToWorldRot(theta, phi) {
      const a1 = Math.PI/2 - theta;
      const a2 = phi;
      const rotAzimuth = [[Math.cos(a1), Math.sin(a1)], [-Math.sin(a1), Math.cos(a1)]];
      function applyRotAzimuth(v) {
        const r = rotAzimuth;
        return [r[0][0] * v[0] + r[0][1] * v[1], r[1][0] * v[0] + r[1][1] * v[1], v[2]];
      };
  
      const dirFwd = [0, Math.cos(a2), -Math.sin(a2)];
      const dirRight = [1, 0, 0];
      const dirDown = [0, -Math.sin(a2), -Math.cos(a2)];
      const camZ = applyRotAzimuth(dirFwd);
      const camX = applyRotAzimuth(dirRight);
      const camY = applyRotAzimuth(dirDown);

      return transpose([camX, camY, camZ]);
    }

    function getPos(theta, phi) {
      const d = cameraParameters.distance;
      const trg = cameraParameters.target;
      const rot = getCamToWorldRot(theta, phi);
      const camZ = [rot[0][2], rot[1][2], rot[2][2]];
      return [-camZ[0] * d + trg[0], -camZ[1] * d + trg[1], -camZ[2] * d + trg[2]];
    }

    const theta1 = cameraParameters.thetaRad;
    const DUMMY_DELTA_DEG = 2;
    const theta2 = DUMMY_DELTA_DEG / 180.0 * Math.PI + theta1;
    const phi = cameraParameters.phiRad;

    const q0 = rmat2quat(getCamToWorldRot(theta1, phi));
    let q1 = rmat2quat(getCamToWorldRot(theta2, phi));

    if (dot(q0, q1) < 0) q1 = q1.map(c => -c);
    const slerp_theta = Math.acos(Math.max(0, Math.min(1, dot(q0, q1))));
    let slerp_inv_sin = 1;
    if (slerp_theta > 1e-8) slerp_inv_sin = 1.0 / Math.sin(slerp_theta);

    cameraParameters.type = 'motion_blur_camera';
    cameraUniforms = {
      u_cam_pos0: getPos(theta1, phi),
      u_cam_pos1: getPos(theta2, phi),
      u_cam_orientation0: q0,
      u_cam_orientation1: q1,
      u_cam_orientation_slerp_theta: slerp_theta,
      u_cam_orientation_slerp_inv_sin: slerp_inv_sin
    };

    return this;
  };

  this.buildScene = () => {
    const uniqueTracers = [];
    const uniqueSamplers = [];
    const samplerNameSet = {};
    const objectViews = [];
    const uniqueMaterials = [];
    const objectsPerTracer = {};
    const objectsPerMaterial = {};
    const objectsById = {};

    if (airMaterial) {
      uniqueMaterials.push({
        material: airMaterial,
        objects: [{ id: 0 }]
      });
    }

    objects.forEach((obj) => {
      const tracer = { ...obj.tracer };
      if (!objectsPerTracer[tracer.name]) {
        objectsPerTracer[tracer.name] = [];
        uniqueTracers.push({ ...tracer });
      }
      const sampler = { ...obj.sampler };
      if (sampler && !samplerNameSet[sampler.name]) {
        samplerNameSet[sampler.name] = true;
        uniqueSamplers.push(sampler.code);
      }
      const objectView = {
        obj,
        tracerName: tracer.name,
        samplerName: sampler && sampler.samplerFunctionName,
        getAreaName: sampler && sampler.getAreaFunctionName,
        posList: obj.position.join(','),
        hasRotation: !!obj.rotation,
        rotationList: obj.rotation && obj.rotation.join(','),
        convex: !obj.nonConvex,
        noInside: !!obj.noInside,
        parameterListLeadingComma: ([''].concat(obj.parameters || [])).join(', '),
        parameterList: (obj.parameters || []).join(', ')
      };
      objectViews.push(objectView);
      objectsPerTracer[tracer.name].push(objectView);

      const material = { ...obj.material };
      const materialId = material.id || JSON.stringify(material);
      if (!objectsPerMaterial[materialId]) {
        objectsPerMaterial[materialId] = [];
        uniqueMaterials.push({
          material,
          objects: objectsPerMaterial[materialId]
        });
      }
      objectsPerMaterial[materialId].push(objectView);
    });

    const geometryData = {
      position: [[]],
      rotation: [[], [], []],
      parameter: [[]]
    };
    let objectId = 1;
    uniqueTracers.forEach((uniqTracer) => {
      uniqTracer.objects = objectsPerTracer[uniqTracer.name];
      uniqTracer.minObjectId = objectId;
      uniqTracer.convex = uniqTracer.objects[0].convex;
      uniqTracer.noInside = uniqTracer.objects[0].noInside;
      uniqTracer.objects.forEach((objectView) => {
        objectView.id = objectId;
        objectsById[objectId] = objectView;
        objectId++;
        uniqTracer.anyRotated = uniqTracer.anyRotated || objectView.hasRotation;
        if (enableGeometryTextures) {
          const obj = { ...objectView.obj };

          geometryData.position[0].push(obj.position.concat([0]));
          const r = obj.rotation || [1, 0, 0, 0, 1, 0, 0, 0, 1];
          geometryData.rotation[0].push([r[0], r[1], r[2], 0]);
          geometryData.rotation[1].push([r[3], r[4], r[5], 0]);
          geometryData.rotation[2].push([r[6], r[7], r[8], 0]);

          let params = [];
          if (obj.parameters) {
            uniqTracer.parameterListLeadingComma = `, ${obj.parametersFromVec4Code}`;
            params = obj.parametersAsList();
          }
          while (params.length < 4) params.push(0);
          geometryData.parameter[0].push(params);
        }
      });
      uniqTracer.maxObjectId = objectId - 1;
      uniqTracer.nObjects = objectViews.length;
    });

    let materialId = 0;
    uniqueMaterials.forEach((material) => {
      material.material.id = materialId;
      material.objects.forEach((objectView) => {
        objectView.materialId = materialId;
      });
      materialId++;
    });

    const lights = [];
    uniqueMaterials.filter(mat => mat.material.emission).forEach((mat) => {
      mat.objects.forEach((obj) => {
        if (obj.samplerName) {
          lights.push(obj);
        }
      });
    });

    let materialCode;
    const { textureCode, textureUniforms } = buildTextureProperties(uniqueMaterials);
    const materialData = { ...textureUniforms };

    if (enableMaterialTextures) {
      const { materialTextures, code } = buildDataTextureMaterials(
        uniqueMaterials, objectsById, shaderColorModel
      );
      materialCode = code;
      Object.keys(materialTextures).forEach((property) => {
        materialData[`${property}_texture`] = {
          data: materialTextures[property]
        };
      });
    } else {
      materialCode = buildIfElseMaterials(
        uniqueMaterials, objectsById, shaderColorModel
      );
    }

    const geometryTextureData = {};
    let geometryTemplate = 'geometry.glsl.mustache';
    if (enableGeometryTextures) {
      geometryTemplate = 'texture_geometry.glsl.mustache';
      Object.keys(geometryData).forEach((property) => {
        geometryTextureData[`${property}_texture`] = {
          data: geometryData[property]
        };
      });
    }

    const source = [
      Mustache.render(tracerData.templates[geometryTemplate], {
        tracers: uniqueTracers,
        objects: objectViews
      }),
      textureCode,
      materialCode,
      Mustache.render(tracerData.templates['select_light.glsl.mustache'], {
        lights,
        uniqueSamplers
      }),
      Mustache.render(
        tracerData.templates[cameraParameters.type + '.glsl.mustache'],
        cameraParameters.transform()
      )
    ].join('\n');

    return {
      source,
      data: {
        ...materialData,
        ...geometryTextureData,
        ...cameraUniforms
      }
    };
  };
}

/* eslint-enable no-param-reassign */

module.exports = SceneBuilder;
