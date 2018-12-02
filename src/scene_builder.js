const Mustache = require('mustache');
const tracerData = require('../glsl/index.js');

function positionAndRotation(m) {
  if (m.length == 3)
    return { position: m };

  if (m.length != 16)
    throw new Error('invalid transformation, expected 3-vector or 16 entries of a 4x4 row-major matrix');

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
    if (list.length > 0) { list[0].first = true; }
    return list;
  }

  function buildGenericProperty(name, type, defaultValue) {
    let formatType;
    if (type === 'vec3') {
      formatType = toVec3;
      defaultValue = defaultValue || 'vec3(0, 0, 0)';
    } else {
      formatType = x => `float(${x})`;
      defaultValue = defaultValue || '0.0';
    }
    return {
      name,
      type,
      default: defaultValue,
      materials: addFirstFlag(uniqueMaterials
        .filter(mat => mat.material[name])
        .map(mat => ({
          minObjectId: mat.minObjectId,
          maxObjectId: mat.maxObjectId,
          value: formatType(mat.material[name])
        })))
    }
  }

  function buildProbabilisticProperty(name) {
    function toProbAndValue(value) {
      if (shaderColorModel === 'rgb') {
        const prob = (value[0]+value[1]+value[2])/3;
        const col = value.map(x => x/prob);

        return {
          probability: `float(${prob})`,
          value: toVec3(col)
        };
      } else if (shaderColorModel === 'grayscale') {
        return {
          probability: `float(${value})`,
          value: '1.0'
        };
      } else throw new Error(`invalid color model ${shaderColorModel}`);
    }

    return {
      name,
      type: 'float',
      materials: addFirstFlag(uniqueMaterials
        .filter(mat => mat.material.hasOwnProperty(name))
        .map(mat => ({
          minObjectId: mat.minObjectId,
          maxObjectId: mat.maxObjectId,
          // helps with integer values 1 != 1.0 == 1f == float(1)
          // which cause errors in GLSL
          ...toProbAndValue(mat.material[name])
        })))
    }
  }

  const colorType = shaderColorModel === 'rgb' ? 'vec3' : 'float';

  return Mustache.render(tracerData.templates['if_else_materials.glsl.mustache'], {
    colorType,
    materialEmissions: buildGenericProperty('emission', colorType).materials,
    getterProperties: [
      buildGenericProperty('diffuse', colorType),
      buildGenericProperty('ior', 'float', defaultValue='1.0')
    ],
    probabilisticProperties: [
      buildProbabilisticProperty('reflectivity'),
      buildProbabilisticProperty('transparency')
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
    ['ior', 1]
  ].forEach(([property, defaultValue]) => {
    materialTextures[property] = [uniqueMaterials.map(material => {
      if (material.material.hasOwnProperty(property)) {
        return valueToVec(material.material[property]);
      } else {
        return valueToVec(defaultValue);
      }
    })];
  });

  const nMaterials = uniqueMaterials.length;
  const objectIds = Object.keys(objectsById).map(x => parseInt(x));
  const maxObjectId = objectIds.reduce((x,y) => Math.max(x,y));
  const materialIds = [];
  for (let i=0; i <= maxObjectId; ++i) {
    const obj = objectsById[i];
    let matId = 0;
    if (obj) matId = obj.materialId;
    materialIds.push(valueToVec(matId));
  }

  materialTextures['material_id'] = [materialIds];

  const colorType = shaderColorModel === 'rgb' ? 'vec3' : 'float';
  const vectorMember = colorType === 'vec3' ? 'xyz' : 'x';

  const code = Mustache.render(tracerData.templates['texture_materials.glsl.mustache'], {
    colorType,
    maxObjectId,
    nMaterials,
    vectorMember,
    probabilisticProperties: [
      'reflectivity',
      'transparency'
    ].map(name => ({
      name,
      type: colorType,
      vectorMember
    })),
    getterProperties: [
      {
        name: 'ior',
        type: 'float',
        vectorMember: 'x'
      },
      {
        name: 'diffuse',
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
  let ifElseMaterials = false;

  const deg2rad = (x) => x / 180.0 * Math.PI;
  const toFloat = (x) => `float(${x})`;

  this.addObject = (surface, positionOrMatrix, material) => {
    objects.push({
      material,
      ...surface,
      ...positionAndRotation(positionOrMatrix),
    });
    return this;
  };

  this.setColorModel = (colorModel) => {
    shaderColorModel = colorModel;
    return this;
  };

  this.setFixedPinholeCamera = (parameters) => {
    function transformParameters() {
      const defaults = {
        fov: 50.0,
        pitch: 0.0,
        yaw: 0.0,
        target: [0,0,0],
        distance: 1
      };
      const p = Object.assign(defaults, parameters);
      return {
        fovAngleRad: toFloat(deg2rad(p.fov)),
        phiRad: toFloat(deg2rad(-p.pitch)),
        thetaRad: toFloat(deg2rad(p.yaw)),
        // TODO: roll not supported
        distance: toFloat(p.distance),
        targetList: p.target.join(',')
      };
    }

    cameraSource = Mustache.render(
      tracerData.templates['fixed_pinhole_camera.glsl.mustache'],
      transformParameters());
    return this;
  };

  this.buildScene = () => {
    const uniqueTracers = [];
    const uniqueSamplers = [];
    const tracerNameSet = {};
    const samplerNameSet = {};
    const objectViews = [];
    const uniqueMaterials = [];
    const objectsPerMaterial = {};
    const objectsById = {};

    objects.forEach(obj => {
      const tracer = obj.tracer;
      if (!tracerNameSet[tracer.name]) {
        tracerNameSet[tracer.name] = true;
        uniqueTracers.push(tracer);
      }
      const sampler = obj.sampler;
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
        parameterListLeadingComma: ([''].concat(obj.parameters)).join(', '),
        parameterList: obj.parameters.join(', ')
      };
      objectViews.push(objectView);

      const material = obj.material;
      let materialId = material.id || JSON.stringify(material);
      if (!objectsPerMaterial[materialId]) {
        objectsPerMaterial[materialId] = [];
        uniqueMaterials.push({
          material,
          objects: objectsPerMaterial[materialId]
        });
      }
      objectsPerMaterial[materialId].push(objectView);
    });

    let objectId = 1;
    let materialId = 0;
    uniqueMaterials.forEach(material => {
      material.objects.forEach(objectView => {
        objectView.materialId = materialId;
        objectView.id = objectId;
        if (material.minObjectId === undefined) {
          material.minObjectId = objectId;
        }
        material.maxObjectId = objectId;
        objectsById[objectId] = objectView;
        objectId++;
      });
      materialId++;
    });

    const lights = [];
    uniqueMaterials.filter(mat => mat.material.emission).forEach(mat => {
      for (let i = mat.minObjectId; i <= mat.maxObjectId; ++i) {
        const obj = objectsById[i];
        if (obj.samplerName) {
          lights.push(obj);
        }
      }
    });

    let materialCode;
    const materialData = {};
    if (ifElseMaterials) {
      materialCode = buildIfElseMaterials(uniqueMaterials, objectsById, shaderColorModel);
    } else {
      const { materialTextures, code } = buildTextureMaterials(uniqueMaterials, objectsById, shaderColorModel);
      materialCode = code;
      Object.keys(materialTextures).forEach(property => {
        materialData[property+'_texture'] = {
          data: materialTextures[property]
        };
      });
    }

    const source = [
      Mustache.render(tracerData.templates['geometry.glsl.mustache'], {
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
      data: materialData
    };
  };
};

module.exports = SceneBuilder;
