/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */


import * as THREE from 'three';
import TileVS from './Shader/TileVS.glsl';
import TileFS from './Shader/TileFS.glsl';
import ShaderUtils from './Shader/ShaderUtils';
import Capabilities from '../Core/System/Capabilities';
import { l_ELEVATION, EMPTY_TEXTURE_ZOOM } from './LayeredMaterialConstants';
import precision_qualifier from './Shader/Chunk/PrecisionQualifier.glsl';
import project_pars_vertex from './Shader/Chunk/project_pars_vertex.glsl';
import elevation_pars_vertex from './Shader/Chunk/elevation_pars_vertex.glsl';
import elevation_vertex from './Shader/Chunk/elevation_vertex.glsl';
import pitUV from './Shader/Chunk/pitUV.glsl';

THREE.ShaderChunk['itowns.precision_qualifier'] = precision_qualifier;
THREE.ShaderChunk['itowns.project_pars_vertex'] = project_pars_vertex;
THREE.ShaderChunk['itowns.elevation_pars_vertex'] = elevation_pars_vertex;
THREE.ShaderChunk['itowns.elevation_vertex'] = elevation_vertex;
THREE.ShaderChunk['itowns.pitUV'] = pitUV;

var emptyTexture = new THREE.Texture();
emptyTexture.coords = { zoom: EMPTY_TEXTURE_ZOOM };

var vector4 = new THREE.Vector4(0.0, 0.0, 0.0, 0.0);

// from three.js packDepthToRGBA
const UnpackDownscale = 255 / 256; // 0..1 -> fraction (excluding 1)
export function unpack1K(color, factor) {
    var bitSh = new THREE.Vector4(
        UnpackDownscale / (256.0 * 256.0 * 256.0),
        UnpackDownscale / (256.0 * 256.0),
        UnpackDownscale / 256.0,
        UnpackDownscale);
    return factor ? bitSh.dot(color) * factor : bitSh.dot(color);
}

// Array not suported in IE
var fillArray = function fillArray(array, remp) {
    for (var i = 0; i < array.length; i++)
        { array[i] = remp; }
};

const LayeredMaterial = function LayeredMaterial(options = {}) {
    THREE.RawShaderMaterial.call(this);
    this.defines = {};

    const maxTexturesUnits = Capabilities.getMaxTextureUnitsCount();
    const nbSamplers = Math.min(maxTexturesUnits, 16) - 1;

    this.defines.NUM_TEXTURES = nbSamplers;

    if (__DEBUG__) {
        this.defines.DEBUG = 1;
        this.showOutline = false;
        this.uniforms.showOutline = new THREE.Uniform(this.showOutline);
    }

    if (options.useRgbaTextureElevation) {
        throw new Error('Restore this feature');
    } else if (options.useColorTextureElevation) {
        this.defines.COLOR_TEXTURE_ELEVATION = 1;
        this.defines._minElevation = options.colorTextureElevationMinZ.toFixed(1);
        this.defines._maxElevation = options.colorTextureElevationMaxZ.toFixed(1);
    } else {
        this.defines.DATA_TEXTURE_ELEVATION = 1;
    }

    this.vertexShader = TileVS;
    this.fragmentShader = ShaderUtils.unrollLoops(TileFS, this.defines);


    this.paramLayers = [];

    // Elevation properties
    this.elevationOffsetScales = [vector4];
    this.elevationTextures = [null];

    // Color properties
    this.noTextureColor = new THREE.Color(0.04, 0.23, 0.35);
    this.colorLayers = Array(nbSamplers);
    this.colorOffsetScales = Array(nbSamplers);
    this.colorTextures = Array(nbSamplers);
    fillArray(this.colorOffsetScales, vector4);
    fillArray(this.colorLayers, {});

    // Lighting properties
    this.lightPosition = new THREE.Vector3(-0.5, 0.0, 1.0);
    this.lightingEnabled = false;

    // Misc properties
    this.distanceFog = 1000000000.0;
    this.selected = false;
    this.uuid = 0;

    // Elevation uniforms
    this.uniforms.elevationTextures = new THREE.Uniform(this.elevationTextures);
    this.uniforms.elevationOffsetScales = new THREE.Uniform(this.elevationOffsetScales);
    this.uniforms.elevationTextureCount = new THREE.Uniform(0);

    // Color uniforms
    this.uniforms.opacity = new THREE.Uniform(this.opacity);
    this.uniforms.noTextureColor = new THREE.Uniform(this.noTextureColor);
    this.uniforms.colorLayers = new THREE.Uniform(this.colorLayers);
    this.uniforms.colorTextures = new THREE.Uniform(this.colorTextures);
    this.uniforms.colorOffsetScales = new THREE.Uniform(this.colorOffsetScales);
    this.uniforms.colorTextureCount = new THREE.Uniform(0);

    // Lighting uniforms
    this.uniforms.lightingEnabled = new THREE.Uniform(this.lightingEnabled);
    this.uniforms.lightPosition = new THREE.Uniform(this.lightPosition);

    // Misc properties
    this.uniforms.distanceFog = new THREE.Uniform(this.distanceFog);
    this.uniforms.selected = new THREE.Uniform(this.selected);
    this.uniforms.uuid = new THREE.Uniform(this.uuid);

    this.elevationLayersId = [];

    if (Capabilities.isLogDepthBufferSupported()) {
        this.defines.USE_LOGDEPTHBUF = 1;
        this.defines.USE_LOGDEPTHBUF_EXT = 1;
    }
};

LayeredMaterial.prototype = Object.create(THREE.RawShaderMaterial.prototype);
LayeredMaterial.prototype.constructor = LayeredMaterial;

LayeredMaterial.prototype.updateUniforms = function updateUniforms() {
    let count = 0;
    for (const layer of this.paramLayers) {
        if (layer.visible && layer.opacity > 0) {
            layer.textureOffset = count;
            for (let i = 0, il = layer.textures && layer.textures.length; i < il; ++i) {
                this.uniforms.colorOffsetScales.value[count] = layer.offsetScales[i];
                this.uniforms.colorTextures.value[count] = layer.textures[i];
                this.uniforms.colorLayers.value[count] = layer;
                i++;
                count++;
                // if (count > ) warn/break
            }
        }
    }
    this.uniforms.colorTextureCount.value = count;
    this.uniforms.elevationTextureCount.value = this.elevationTextures[0] ? 0 : 1;

    this.uniforms.opacity.value = this.opacity;
    this.uniforms.showOutline.value = this.showOutline;
    this.uniforms.lightingEnabled.value = this.lightingEnabled;
    this.uniforms.selected.value = this.selected;
    this.uniforms.uuid.value = this.uuid;
    this.uniforms.distanceFog.value = this.distanceFog;
    this.uniforms.noTextureColor.value.copy(this.noTextureColor);
    this.uniforms.lightPosition.value.copy(this.lightPosition);
    this.uniformsNeedUpdate = true;
};

LayeredMaterial.prototype.dispose = function dispose() {
    // TODO: WARNING  verify if textures to dispose aren't attached with ancestor

    this.dispatchEvent({
        type: 'dispose',
    });
    for (const layer of this.paramLayers) {
        for (const texture of layer.textures) {
            if (texture instanceof THREE.Texture) {
                texture.dispose();
            }
            layer.textures = [];
            layer.offsetScales = [];
        }
    }
};

LayeredMaterial.prototype.setSequence = function setSequence(sequenceLayer) {
    // console.log('sequenceLayer', sequenceLayer, this.paramLayers);
    const paramLayers = [];
    for (let l = 0; l < sequenceLayer.length; l++) {
        const layer = this.getColorLayer(sequenceLayer[l]);
        if (layer) {
            paramLayers.push(layer);
        }
    }
    this.paramLayers = paramLayers;
    this.updateUniforms();
    // console.log('sequenceLayer', sequenceLayer, this.paramLayers);
};

LayeredMaterial.prototype.removeColorLayer = function removeColorLayer(layerId) {
    const layerIndex = this.indexOfColorLayer(layerId);
    if (layerIndex === -1) {
        return;
    }
    // Remove Layers Parameters
    var layer = this.paramLayers.splice(layerIndex, 1)[0];

    // Dispose Layers textures
    for (const texture of layer.textures) {
        if (texture instanceof THREE.Texture) {
            texture.dispose();
        }
        layer.textures = [];
        layer.offsetScales = [];
    }
    this.updateUniforms();
    // console.log('removeColorLayer', layer, this.paramLayers);
};

LayeredMaterial.prototype.setColorTextures = function setColorTextures(textures, layerId) {
    const layer = this.getColorLayer(layerId);
    for (let i = 0, max = textures.length; i < max; i++) {
        if (textures[i]) {
            this.setColorTexture(textures[i].texture, textures[i].pitch, i, layer);
        }
    }
    // console.log('setColorTexturesLayer', layer);
};

LayeredMaterial.prototype.setElevationTexture = function setElevationTexture(texture, offsetScale, index = 0) {
    this.elevationTextures[index] = texture || null;
    this.elevationOffsetScales[index] = offsetScale || new THREE.Vector4(0.0, 0.0, 1.0, 1.0);
    // console.log('setElevationTexture', layer.id, this.paramLayers);
};

LayeredMaterial.prototype.setColorTexture = function setTexture(texture, offsetScale, index, layer) {
    layer.textures[index] = texture || null;
    layer.offsetScales[index] = offsetScale || new THREE.Vector4(0.0, 0.0, 1.0, 1.0);
    // console.log('setColorTexture', layer.id, this.paramLayers);
};

LayeredMaterial.prototype.pushLayer = function pushLayer(param) {
    this.paramLayers.push({
        id: param.idLayer,
        textureCount: param.texturesCount,
        effect: param.fx,
        opacity: param.opacity,
        visible: param.visible,
        textures: [],
        offsetScales: [],
    });
    // console.log('pushLayer', param.idLayer, this.paramLayers);
};

LayeredMaterial.prototype.indexOfColorLayer = function indexOfColorLayer(layerId) {
    return this.paramLayers.findIndex(layer => layer.id === layerId);
};

LayeredMaterial.prototype.getColorLayer = function getColorLayer(layerId) {
    return this.paramLayers.find(layer => layer.id === layerId);
};

LayeredMaterial.prototype.isColorLayerDownscaled = function isColorLayerDownscaled(layerId, zoom) {
    const layer = this.getColorLayer(layerId);
    return layer && layer.textures[0] ? layer.textures[0].coords.zoom < zoom : true;
};

LayeredMaterial.prototype.getColorLayerLevelById = function getColorLayerLevelById(layerId) {
    const layer = this.getColorLayer(layerId);
    return layer && layer.textures[0] ? layer.textures[0].coords.zoom : EMPTY_TEXTURE_ZOOM;
};

LayeredMaterial.prototype.getElevationLayerLevel = function getElevationLayerLevel() {
    return this.elevationTextures[0] ? this.elevationTextures[0].coords.zoom : EMPTY_TEXTURE_ZOOM;
};

LayeredMaterial.prototype.getElevationTexture = function getElevationTexture() {
    return this.elevationTextures[0];
};

LayeredMaterial.prototype.getLayerTextures = function getLayerTextures(layerType, layerId) {
    if (layerType === l_ELEVATION) {
        return this.elevationTextures;
    }
    const layer = this.getColorLayer(layerId);
    if (layer) {
        return layer.textures;
    } else {
        throw new Error(`Invalid layer id "${layerId}"`);
    }
};

export default LayeredMaterial;
