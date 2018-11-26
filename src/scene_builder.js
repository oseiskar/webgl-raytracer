const Mustache = require('mustache');
const tracerData = require('../glsl/index.js');

function SceneBuilder() {
  const objects = [];
  let cameraSource;

  const deg2rad = (x) => x / 180.0 * Math.PI;

  this.addObject = (surface, position, material) => {
    objects.push({
      tracer: surface.tracer,
      sampler: surface.sampler,
      parameters: surface.parameters,
      position,
      material
    });
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
        fovAngleRad: deg2rad(p.fov),
        phiRad: deg2rad(-p.pitch),
        thetaRad: deg2rad(p.yaw),
        // TODO: roll not supported
        distance: p.distance,
        targetList: p.target.join(',')
      };
    }

    cameraSource = Mustache.render(
      tracerData.templates['fixed_pinhole_camera.glsl.mustache'],
      transformParameters());
    return this;
  };

  const nextUniqueMaterialId = (() => {
    let counter = 0;
    return () => {
      counter++;
      return `__unique_material_${counter}`;
    }
  })();

  this.buildSceneGLSL = () => {
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
        parameterListLeadingComma: ([''].concat(obj.parameters)).join(', '),
        parameterList: obj.parameters.join(', ')
      };
      objectViews.push(objectView);

      const material = obj.material;
      let materialId = material.id || nextUniqueMaterialId();
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
    uniqueMaterials.forEach(material => {
      material.objects.forEach(objectView => {
        objectView.id = objectId;
        if (material.minObjectId === undefined) {
          material.minObjectId = objectId;
        }
        material.maxObjectId = objectId;
        objectsById[objectId] = objectView;
        objectId++;
      });
    });

    function toVec3(x) {
      if (x.length !== 3) throw new Error('expected list of length 3');
      return `vec3(${x.join(',')})`;
    }

    function addFirstFlag(list) {
      if (list.length > 0) { list[0].first = true; }
      return list;
    }

    function buildGenericVec3Property(name, defaultValue = 'vec3(0.0, 0.0, 0.0)') {
      return {
        name,
        type: 'vec3',
        default: defaultValue,
        materials: addFirstFlag(uniqueMaterials
          .filter(mat => mat.material[name])
          .map(mat => ({
            minObjectId: mat.minObjectId,
            maxObjectId: mat.maxObjectId,
            value: toVec3(mat.material[name])
          })))
      }
    }

    function buildGenericScalarProperty(name, defaultValue = '0.0') {
      return {
        name,
        type: 'float',
        default: defaultValue,
        materials: addFirstFlag(uniqueMaterials
          .filter(mat => mat.material.hasOwnProperty(name))
          .map(mat => ({
            minObjectId: mat.minObjectId,
            maxObjectId: mat.maxObjectId,
            // helps with integer values 1 != 1.0 == 1f == float(1)
            // which cause errors in GLSL
            value: `float(${mat.material[name]})`
          })))
      }
    }

    const emissionMaterials = buildGenericVec3Property('emission').materials;
    const lights = [];
    emissionMaterials.forEach(mat => {
      for (let i = mat.minObjectId; i <= mat.maxObjectId; ++i) {
        const obj = objectsById[i];
        lights.push(objectsById[i]);
      }
    });

    return [
      Mustache.render(tracerData.templates['geometry.glsl.mustache'], {
        tracers: uniqueTracers,
        objects: objectViews
      }),
      Mustache.render(tracerData.templates['if_else_materials.glsl.mustache'], {
        materialEmissions: emissionMaterials,
        genericProperties: [
          buildGenericVec3Property('diffuse'),
          buildGenericScalarProperty('reflectivity'),
          buildGenericScalarProperty('transparency'),
          buildGenericScalarProperty('ior', defaultValue='1.0')
        ]
      }),
      Mustache.render(tracerData.templates['select_light.glsl.mustache'], {
        lights,
        uniqueSamplers
      }),
      cameraSource
    ].join('\n');
  };
};

module.exports = SceneBuilder;
