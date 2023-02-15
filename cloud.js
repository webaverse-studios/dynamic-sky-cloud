import {cloudData} from './cloud-data.js';
import {
  PlaneGeometry,
  BufferGeometry,
	ShaderMaterial,
	UniformsUtils,
	Vector3,
  InstancedMesh,
  DoubleSide,
  InstancedBufferAttribute
} from 'three';

import * as THREE from 'three';



const CLOUD_RADIUS = 4900;
const TOTAL_RADIUS_CHUNK = 100; // divide the cloudRadius into 100 parts
const PARTICLE_COUNT = cloudData.length;

const _getGeometry = (geometry, attributeSpecs, particleCount) => {
  const geometry2 = new BufferGeometry();
  ['position', 'normal', 'uv'].forEach(k => {
  geometry2.setAttribute(k, geometry.attributes[k]);
  });
  geometry2.setIndex(geometry.index);

  const positions = new Float32Array(particleCount * 3);
  const positionsAttribute = new InstancedBufferAttribute(positions, 3);
  geometry2.setAttribute('positions', positionsAttribute);

  for(const attributeSpec of attributeSpecs){
      const {
          name,
          itemSize,
      } = attributeSpec;
      const array = new Float32Array(particleCount * itemSize);
      geometry2.setAttribute(name, new InstancedBufferAttribute(array, itemSize));
  }

  return geometry2;
};

class Cloud extends InstancedMesh {

	constructor() {
    
    const attributeSpecs = [];
    attributeSpecs.push({name: 'textureNumber', itemSize: 1});
    attributeSpecs.push({name: 'distortionSpeed', itemSize: 1});
    attributeSpecs.push({name: 'distortionRange', itemSize: 1});
    attributeSpecs.push({name: 'scales', itemSize: 2});
    attributeSpecs.push({name: 'offset', itemSize: 2});
    attributeSpecs.push({name: 'rotationY', itemSize: 1});

    
    const geometry2 = new PlaneGeometry(10, 10);
    const geometry = _getGeometry(geometry2, attributeSpecs, PARTICLE_COUNT);

    const shader = Cloud.CloudShader;

    const material = new ShaderMaterial({
      fragmentShader: shader.fragmentShader,
			vertexShader: shader.vertexShader,
			uniforms: UniformsUtils.clone(shader.uniforms),
			side: DoubleSide,
			depthWrite: false,
      transparent: true,
    });

		super(geometry, material, PARTICLE_COUNT);
    this.cloudRadius = CLOUD_RADIUS;
    this.initialCloudAttribute(this);

	}
  
  initialCloudAttribute(cloud) { // initialize the cloud based on the cloud-data.js
    const scalesAttribute = cloud.geometry.getAttribute('scales');
    const positionsAttribute = cloud.geometry.getAttribute('positions');
    const rotationAttribute = cloud.geometry.getAttribute('rotationY');
    const offsetAttribute = cloud.geometry.getAttribute('offset');
    const distortionSpeedAttribute = cloud.geometry.getAttribute('distortionSpeed');
    const distortionRangeAttribute = cloud.geometry.getAttribute('distortionRange');
    const textureNumberAttribute = cloud.geometry.getAttribute('textureNumber');
    
    for(let i = 0; i < PARTICLE_COUNT; i++){
      const w = cloudData[i].width;
      const h = cloudData[i].height;
      const posY = cloudData[i].posY;
      const cloudNumber = cloudData[i].cloudNumber;
      scalesAttribute.setXY(i, w, h);
      const theta = 2. * Math.PI * cloudData[i].positionIndex / TOTAL_RADIUS_CHUNK;
      positionsAttribute.setXYZ(
                              i,
                              Math.sin(theta) * CLOUD_RADIUS,
                              posY,
                              Math.cos(theta) * CLOUD_RADIUS
      ) 
      const n = Math.cos(theta) > 0 ? 1 : -1;
      rotationAttribute.setX(i, -Math.sin(theta) * n * (Math.PI / 2));
      offsetAttribute.setXY(
        i,
        (cloudNumber % 2) * (1. / 2.),
        (3 / 4) - Math.floor(cloudNumber / 2) * (1 / 4)
      );
      distortionSpeedAttribute.setX(i, cloudData[i].distortionSpeed);
      distortionRangeAttribute.setX(i, (1. - cloudData[i].distortionRange) * 2);
      textureNumberAttribute.setX(i, cloudData[i].textureNumber);
    }
    scalesAttribute.needsUpdate = true;
    positionsAttribute.needsUpdate = true; 
    rotationAttribute.needsUpdate = true;
    offsetAttribute.needsUpdate = true;
    distortionSpeedAttribute.needsUpdate = true;
    distortionRangeAttribute.needsUpdate = true;
    textureNumberAttribute.needsUpdate = true;
  }

}
Cloud.CloudShader = {
  uniforms: {
    uTime: { 
      value: 0 
    },
    sunPosition: {
      value: new Vector3()
    },
    noiseTexture2: {
      value: null
    },
    cloudRadius: {
      value: CLOUD_RADIUS
    },
    cloudTexture1: {
      value: null
    },
    cloudTexture2: {
      value: null
    },
    cloudTexture3: {
      value: null
    },
    cloudTexture4: {
      value: null
    },
  },
  vertexShader:`
    ${THREE.ShaderChunk.common}
    ${THREE.ShaderChunk.logdepthbuf_pars_vertex}
    
    attribute float textureNumber;
    attribute float distortionSpeed;
    attribute float distortionRange;
    attribute vec2 offset;
    attribute vec2 scales;
    attribute vec3 positions;
    attribute float rotationY;

    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec2 vOffset;
    varying float vDistortionSpeed;
    varying float vDistortionRange;
    varying float vTextureNumber;

    uniform float uTime;
    uniform vec3 playerPos;

    void main() { 
      
      // varying
      vTextureNumber = textureNumber;
      vDistortionSpeed = distortionSpeed;
      vDistortionRange = distortionRange;
      vOffset = offset;
      vUv = uv;

      mat3 rotY = mat3(
        cos(rotationY), 0.0, -sin(rotationY), 
        0.0, 1.0, 0.0, 
        sin(rotationY), 0.0, cos(rotationY)
      );
      vec3 pos = position;
      pos.x *= scales.x;
      pos.y *= scales.y;
      pos *= rotY;
      pos += positions;
      vec4 modelPosition = modelMatrix * vec4(pos, 1.0);
      vec4 viewPosition = viewMatrix * modelPosition;
      vWorldPosition = modelPosition.xyz;
      vec4 projectionPosition = projectionMatrix * viewPosition;
      gl_Position = projectionPosition;
      ${THREE.ShaderChunk.logdepthbuf_vertex}
    }
  `,
  fragmentShader: `
    ${THREE.ShaderChunk.logdepthbuf_pars_fragment}
    #include <common>
    uniform sampler2D cloudTexture1;
    uniform sampler2D cloudTexture2;
    uniform sampler2D cloudTexture3;
    uniform sampler2D cloudTexture4;
    uniform sampler2D noiseTexture2;
    uniform float uTime;
    uniform vec3 sunPosition;
    uniform float cloudRadius;
    
    
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec2 vOffset;
    varying float vDistortionSpeed;
    varying float vDistortionRange;
    varying float vTextureNumber;

    float getCloudAlpha(vec4 lerpTex, vec4 cloudTex, float lerpCtrl) { // distort the cloud
      float cloudStep = 1. - lerpCtrl;
      float cloudLerp = smoothstep(0.95, 1., lerpCtrl);
      float alpha = smoothstep(clamp(cloudStep - 0.1, 0.0, 1.0), cloudStep, lerpTex.b);  
      alpha = mix(alpha, cloudTex.a, cloudLerp);
      alpha = clamp(alpha, 0., cloudTex.a);

      return alpha;
    }
    
    vec4 getCloudTex(float number) { // choose the cloud texture from the 4 cloud textures based on the cloud data
      vec4 noise = texture2D(
        noiseTexture2, 
        vec2(
          vUv.x + uTime * vDistortionSpeed * 0.1,
          vUv.y + uTime * vDistortionSpeed * 0.2
        )
      );
      vec2 uv = vec2(
        vUv.x / 2. + vOffset.x,
        vUv.y / 4. + vOffset.y
      ) + noise.rb * 0.01;

      vec4 tex;
      if (number < 0.5) {
        tex = texture2D(cloudTexture1, uv);
      }
      else if (number < 1.5) {
        tex = texture2D(cloudTexture2, uv);
      }
      else if (number < 2.5) {
        tex = texture2D(cloudTexture3, uv);
      }
      else if (number < 3.5) {
        tex = texture2D(cloudTexture4, uv);
      }
      return tex;
    }

    void main() {
      vec4 cloud = getCloudTex(vTextureNumber);

      float lerpCtrl = 0.1;
      
      float alphaLerp = mix((sin((uTime) * vDistortionSpeed) * 0.78 + 0.78 * vDistortionRange), 1.0, lerpCtrl);
      float cloudAlpha = getCloudAlpha(cloud, cloud, alphaLerp);
      
      float sunNightStep = smoothstep(-0.3, 0.25, sunPosition.y / cloudRadius);
      vec3 cloudBrightColor = mix(vec3(0.141, 0.607, 0.940), vec3(1.0, 1.0, 1.0), sunNightStep);
      vec3 cloudDarkColor = mix(vec3(0.0236, 0.320, 0.590), vec3(0.141, 0.807, 0.940), sunNightStep);


      float brightLerpSize = cloudRadius * 1.0;
      float sunDist = distance(vWorldPosition, sunPosition);
      float brightLerp = smoothstep(0., brightLerpSize, sunDist);
      float bright = mix(2.0, 1.0, brightLerp);
      float cloudColorLerp = cloud.r;
      vec3 cloudColor = mix(cloudDarkColor, cloudBrightColor, cloudColorLerp) * bright
                      + cloud.g * (1. - brightLerp);

      float horizon = 400.;
      float fadeOutY = (vWorldPosition.y + horizon)/ (cloudRadius * 0.4) * 2.;
      fadeOutY = clamp(fadeOutY, 0.0, 1.0);
       
      gl_FragColor.rgb = cloudColor; 
      gl_FragColor.a = cloudAlpha * fadeOutY;

      #include <tonemapping_fragment>
      #include <encodings_fragment>
      
      ${THREE.ShaderChunk.logdepthbuf_fragment}
    }
  `
}
export {Cloud};