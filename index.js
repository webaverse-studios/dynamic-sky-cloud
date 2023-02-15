import * as THREE from 'three';

import { Sky } from './sky.js';
import {Cloud} from './cloud.js';
import { Lensflare, LensflareElement } from './Lensflare.js';

import metaversefile from 'metaversefile';

const {useApp, useFrame, useInternals, useLocalPlayer} = metaversefile;

const baseUrl = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1');
const textureLoader = new THREE.TextureLoader();

const cloudTexture1 = textureLoader.load(baseUrl + `./textures/cloud1.png`);
const cloudTexture2 = textureLoader.load(baseUrl + `./textures/cloud2.png`);
const cloudTexture3 = textureLoader.load(baseUrl + `./textures/cloud3.png`);
const cloudTexture4 = textureLoader.load(baseUrl + `./textures/cloud4.png`);

const moonTexture = textureLoader.load(baseUrl + `./textures/moon2.png`);

const starTexture = textureLoader.load(baseUrl + `./textures/star3.png`);
starTexture.wrapS = starTexture.wrapT = THREE.RepeatWrapping;
const noiseTexture = textureLoader.load(baseUrl + `./textures/noise.png`);
noiseTexture.wrapS = noiseTexture.wrapT = THREE.RepeatWrapping;

const galaxyTexture = textureLoader.load(baseUrl + `./textures/galaxy.png`);

const noiseTexture2 = textureLoader.load(baseUrl + `./textures/noise2.png`);
noiseTexture2.wrapS = noiseTexture2.wrapT = THREE.RepeatWrapping;

const textureFlare0 = textureLoader.load(baseUrl + `./textures/Flare32.png`);
const textureFlare3 = textureLoader.load(baseUrl + `./textures/lensflare3.png`);


export default () => {
  const app = useApp();
  const {renderer, camera} = useInternals();
  const localPlayer = useLocalPlayer();

  //############################################################## sun position ##############################################################
  let azimuth = 0.4;
  const inclination = 0.;
  const sunPosition = new THREE.Vector3();

  useFrame(() => {
    app.position.x = (localPlayer.position.x);
    app.position.z = (localPlayer.position.z);

    azimuth = (Date.now() / 50000) % 1;
    const theta = Math.PI * (inclination - 0.5);
    const phi = 2 * Math.PI * (azimuth - 0.5);

    sunPosition.set(
      Math.cos(phi),
      Math.sin(phi) * Math.sin(theta),
      Math.sin(phi) * Math.cos(theta)
    );
  });
 //############################################################## Skydome ##############################################################
  {
    const sky = new Sky();
    sky.material.uniforms.uColorDayCycleLow.value.set('#f0fff9')
    sky.material.uniforms.uColorDayCycleHigh.value.set('#2e89ff')
    sky.material.uniforms.uColorNightLow.value.set('#004794')
    sky.material.uniforms.uColorNightHigh.value.set('#001624')
    sky.material.uniforms.uColorSun.value.set('#ff531a')
    sky.material.uniforms.uColorDawn.value.set('#ff1900')

    sky.material.uniforms.galaxyTexture.value = galaxyTexture;
    sky.material.uniforms.noiseTexture2.value = noiseTexture2;
    sky.material.uniforms.starTexture.value = starTexture;
    sky.material.uniforms.noiseTexture.value = noiseTexture;
    app.add(sky);

    
    const sunMoonRotationRadius = 4000;

    const moonGeometry = new THREE.PlaneGeometry( 400, 400 );
    const moonMaterial = new THREE.MeshBasicMaterial( { map: moonTexture, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true} );
    const moon = new THREE.Mesh(moonGeometry, moonMaterial);
    app.add( moon );

    const sun = new THREE.PointLight(0xffffff, 100, 2000);
    const lensflare = new Lensflare();
    const mainFlare = new LensflareElement(textureFlare0, 800, 0, sun.color, 0.2);
    lensflare.addElement(mainFlare);
    lensflare.addElement(new LensflareElement(textureFlare3, 60, 0.6));
    lensflare.addElement(new LensflareElement(textureFlare3, 70, 0.7));
    lensflare.addElement(new LensflareElement(textureFlare3, 120, 0.9));
    lensflare.addElement(new LensflareElement(textureFlare3, 70, 1));
    sun.add( lensflare );
    app.add( sun );
    sun.visible = false;

    useFrame(({timestamp}) => {
    
      sky.material.uniforms.uSunPosition.value.set(sunPosition.x, sunPosition.y, sunPosition.z);
      sky.material.uniforms.uDayCycleProgress.value = azimuth;
      sky.material.uniforms.uTime.value = timestamp / 1000;
  
      if (azimuth < 0.5) {
        sun.visible = true;
        sun.position.set(sunPosition.x, sunPosition.y, sunPosition.z).multiplyScalar(sunMoonRotationRadius);
        mainFlare.rotation = camera.rotation.y;
      }
      else {
        sun.visible = false;
      }

      // update moon
      moon.position.set(sunPosition.x, sunPosition.y, sunPosition.z).multiplyScalar(-sunMoonRotationRadius);
      moon.rotation.copy(camera.rotation);
    });
    
  }

  //############################################################## cloud ##############################################################
  {
    const cloud = new Cloud();
    app.add(cloud);
    cloud.material.uniforms.noiseTexture2.value = noiseTexture2
    cloud.material.uniforms.cloudRadius.value = cloud.cloudRadius;
    cloud.material.uniforms.cloudTexture1.value = cloudTexture1;
    cloud.material.uniforms.cloudTexture2.value = cloudTexture2;
    cloud.material.uniforms.cloudTexture3.value = cloudTexture3;
    cloud.material.uniforms.cloudTexture4.value = cloudTexture4;
    useFrame(({timestamp}) => {
      const player = useLocalPlayer();
      
      cloud.material.uniforms.uTime.value = timestamp / 1000;
      cloud.material.uniforms.sunPosition.value.set(
        sunPosition.x * cloud.cloudRadius + localPlayer.position.x, 
        sunPosition.y * cloud.cloudRadius, 
        sunPosition.z * cloud.cloudRadius + localPlayer.position.z
      )
                                              
      app.updateMatrixWorld();
    });
  }
  
  app.setComponent('renderPriority', 'low');
  
  return app;
};

