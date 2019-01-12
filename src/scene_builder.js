const Mustache = require('mustache');
const tracerData = require('../glsl/index.js');

// this file is also becoming quite terrible

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

function buildIfElseMaterials(uniqueMaterials, objectsById, shaderColorModel) {
  function addFirstFlag(list) {
    const newList = [...list];
    if (newList.length > 0) newList[0].first = true;
    return newList;
  }

  function buildGenericProperty(name, type, defaultValue) {
    let defaultVal = defaultValue;
    let formatType;
    if (type === 'vec3') {
      formatType = toVec3;
      defaultVal = defaultVal || 'vec3(0, 0, 0)';
    } else {
      formatType = x => `float(${x})`;
      defaultVal = defaultVal || '0.0';
    }
    return {
      name,
      type,
      default: defaultVal,
      materials: addFirstFlag(uniqueMaterials
        .filter(mat => mat.material[name])
        .map(mat => ({
          objects: mat.objects.map(obj => ({ id: obj.id })),
          value: formatType(mat.material[name])
        })))
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
      buildGenericProperty('transparency', colorType)
    ]
  });
}

function buildTextureMaterials(uniqueMaterials, objectsById, shaderColorModel) {
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
    ['roughness', 0]
  ].forEach(([property, defaultValue]) => {
    materialTextures[property] = [uniqueMaterials.map((material) => {
      if (material.material.hasOwnProperty(property)) {
        return valueToVec(material.material[property]);
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

  const code = Mustache.render(tracerData.templates['texture_materials.glsl.mustache'], {
    colorType,
    maxObjectId,
    nMaterials,
    vectorMember,
    colorToProb,
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
      }
    ]
  });

  return { materialTextures, code };
}

function SceneBuilder() {
  const objects = [];
  let cameraSource;
  let shaderColorModel = 'rgb';
  let enableMaterialTextures = true;
  let enableGeometryTextures = true;

  const deg2rad = x => x / 180.0 * Math.PI;
  const toFloat = x => `float(${x})`;

  // estimate of the relative expensiveness of rendering the scene
  this.computationLoadEstimate = 1.0;
  this.setComputationLoadEstimate = (estimate) => {
    this.computationLoadEstimate = estimate;
    return this;
  };

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

  this.toggleDataTextures = (enabled) => {
    enableMaterialTextures = !!enabled;
    enableGeometryTextures = !!enabled;
    return this;
  };

  this.setFixedPinholeCamera = (parameters) => {
    function transformParameters() {
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

      return {
        fovAngleRad: toFloat(deg2rad(p.fov)),
        phiRad: toFloat(p.phiRad),
        thetaRad: toFloat(p.thetaRad),
        // TODO: roll not supported
        distance: toFloat(p.distance),
        targetList: p.target.join(','),
        apertureSize: toFloat(p.apertureSize),
        focusDistance: toFloat(p.focusDistance || p.distance)
      };
    }

    cameraSource = Mustache.render(
      tracerData.templates['fixed_camera.glsl.mustache'],
      transformParameters(),
    );
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
      /* eslint-disable no-param-reassign */
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
      /* eslint-enable no-param-reassign */
    });

    let materialId = 0;
    uniqueMaterials.forEach((material) => {
      material.objects.forEach((objectView) => {
        // eslint-disable-next-line no-param-reassign
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
    const materialData = {};
    if (enableMaterialTextures) {
      const { materialTextures, code } = buildTextureMaterials(
        uniqueMaterials, objectsById, shaderColorModel
      );
      materialCode = code;
      Object.keys(materialTextures).forEach((property) => {
        materialData[`${property}_texture`] = {
          data: materialTextures[property]
        };
      });
    } else {
      materialCode = buildIfElseMaterials(uniqueMaterials, objectsById, shaderColorModel);
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
      materialCode,
      Mustache.render(tracerData.templates['select_light.glsl.mustache'], {
        lights,
        uniqueSamplers
      }),
      cameraSource
    ].join('\n');

    return {
      source,
      data: {
        ...materialData,
        ...geometryTextureData
      }
    };
  };
}

module.exports = SceneBuilder;
