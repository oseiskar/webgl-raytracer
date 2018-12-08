const Mustache = require('mustache');
const tracerData = require('../glsl/index.js');

// this file is also becoming quite terrible

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
          objects: mat.objects.map(obj => ({ id: obj.id })),
          value: formatType(mat.material[name])
        })))
    }
  }

  const colorType = shaderColorModel === 'rgb' ? 'vec3' : 'float';
  const colorToProb = colorType === 'vec3' ? '((c).x + (c).y + (c).z) / 3.0' : 'c';

  return Mustache.render(tracerData.templates['if_else_materials.glsl.mustache'], {
    colorType,
    colorToProb,
    materialEmissions: buildGenericProperty('emission', colorType).materials,
    properties: [
      buildGenericProperty('diffuse', colorType),
      buildGenericProperty('ior', 'float', defaultValue='1.0'),
      buildGenericProperty('roughness', 'float', defaultValue='1.0'), // for ggx
      buildGenericProperty('reflectivity', colorType),
      buildGenericProperty('transparency', colorType)
    ],
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
    ['roughness', 1] // for using ggx for diffuse
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
    const samplerNameSet = {};
    const objectViews = [];
    const uniqueMaterials = [];
    const objectsPerTracer = {};
    const objectsPerMaterial = {};
    const objectsById = {};

    objects.forEach(obj => {
      const tracer = obj.tracer;
      if (!objectsPerTracer[tracer.name]) {
        objectsPerTracer[tracer.name] = [];
        uniqueTracers.push({...tracer});
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
      objectsPerTracer[tracer.name].push(objectView);

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

    const geometryData = {
      position: [[]],
      rotation: [[],[],[]],
      parameter: [[]]
    };
    let objectId = 1;
    uniqueTracers.forEach(uniqTracer => {
      uniqTracer.objects = objectsPerTracer[uniqTracer.name];
      uniqTracer.minObjectId = objectId;
      uniqTracer.convex = uniqTracer.objects[0].convex;
      uniqTracer.noInside = uniqTracer.objects[0].noInside;
      uniqTracer.objects.forEach(objectView => {
        objectView.id = objectId;
        objectsById[objectId] = objectView;
        objectId++;
        uniqTracer.anyRotated = uniqTracer.anyRotated || objectView.hasRotation;
        if (enableGeometryTextures) {
          const obj = objectView.obj;

          geometryData.position[0].push(obj.position.concat([0]));
          const r = obj.rotation || [1,0,0,0,1,0,0,0,1];
          geometryData.rotation[0].push([r[0],r[1],r[2], 0]);
          geometryData.rotation[1].push([r[3],r[4],r[5], 0]);
          geometryData.rotation[2].push([r[6],r[7],r[8], 0]);

          if (obj.parameters) {
            uniqTracer.parameterListLeadingComma = ', ' + obj.parametersFromVec4Code;
          }
          const params = obj.parametersAsList();
          while (params.length < 4) params.push(0);
          geometryData.parameter[0].push(params);
        }
      });
      uniqTracer.maxObjectId = objectId-1;
      uniqTracer.nObjects = objectViews.length;
    });

    let materialId = 0;
    uniqueMaterials.forEach(material => {
      material.objects.forEach(objectView => {
        objectView.materialId = materialId;
      });
      materialId++;
    });

    const lights = [];
    uniqueMaterials.filter(mat => mat.material.emission).forEach(mat => {
      mat.objects.forEach(obj => {
        if (obj.samplerName) {
          lights.push(obj);
        }
      });
    });

    let materialCode;
    const materialData = {};
    if (enableMaterialTextures) {
      const { materialTextures, code } = buildTextureMaterials(uniqueMaterials, objectsById, shaderColorModel);
      materialCode = code;
      Object.keys(materialTextures).forEach(property => {
        materialData[property+'_texture'] = {
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
      Object.keys(geometryData).forEach(property => {
        geometryTextureData[property+'_texture'] = {
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
};

module.exports = SceneBuilder;
