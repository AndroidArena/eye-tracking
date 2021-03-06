/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */

import * as facemesh from '@tensorflow-models/facemesh';
import Stats from 'stats.js';
import * as tf from '@tensorflow/tfjs-core';
import * as tfjsWasm from '@tensorflow/tfjs-backend-wasm';
// TODO(annxingyuan): read version from tfjsWasm directly once
// https://github.com/tensorflow/tfjs/pull/2819 is merged.
import {version} from '@tensorflow/tfjs-backend-wasm/dist/version';

import {TRIANGULATION} from './triangulation';

tfjsWasm.setWasmPath(
    `https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@${
        version}/dist/tfjs-backend-wasm.wasm`);

function isMobile() {
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isiOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  return isAndroid || isiOS;
}

function drawPath(ctx, points, closePath) {
  const region = new Path2D();
  region.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    const point = points[i];
    region.lineTo(point[0], point[1]);
  }

  if (closePath) {
    region.closePath();
  }
  ctx.stroke(region);
}

let model, ctx, videoWidth, videoHeight, video, canvas,
    scatterGLHasInitialized = false, scatterGL;

const VIDEO_SIZE = 500;
const mobile = isMobile();
// Don't render the point cloud on mobile in order to maximize performance and
// to avoid crowding limited screen space.
const renderPointcloud = mobile === false;
const stats = new Stats();
const state = {
  backend: 'wasm',
  maxFaces: 1,
  triangulateMesh: true,
};

if (renderPointcloud) {
  state.renderPointcloud = true;
}

function setupDatGui() {
  const gui = new dat.GUI();
  gui.add(state, 'backend', ['wasm', 'webgl', 'cpu'])
      .onChange(async (backend) => {
        await tf.setBackend(backend);
      });

  gui.add(state, 'maxFaces', 1, 20, 1).onChange(async (val) => {
    model = await facemesh.load({maxFaces: val});
  });

  gui.add(state, 'triangulateMesh');

  if (renderPointcloud) {
    gui.add(state, 'renderPointcloud').onChange((render) => {
      document.querySelector('#scatter-gl-container').style.display =
          render ? 'inline-block' : 'none';
    });
  }
}

async function setupCamera() {
  video = document.getElementById('video');

  const stream = await navigator.mediaDevices.getUserMedia({
    'audio': false,
    'video': {
      facingMode: 'user',
      // Only setting the video to a specified size in order to accommodate a
      // point cloud, so on mobile devices accept the default size.
      width: mobile ? undefined : VIDEO_SIZE,
      height: mobile ? undefined : VIDEO_SIZE,
    },
  });
  video.srcObject = stream;

  return new Promise((resolve) => {
    video.onloadedmetadata = () => {
      resolve(video);
    };
  });
}

async function getCoordinates() {
  stats.begin();
  let data,val;
  let midwaydata,lipsUpperOuter,rightCheek,nosetip;
  const predictions = await model.estimateFaces(video);
  ctx.drawImage(video, 0, 0, videoWidth, videoHeight, 0, 0, canvas.width, canvas.height);

  if (predictions.length > 0) {
     //TODO for testing purpose only -
    //data = JSON.stringify(predictions[0]['annotations']['noseTip']);
   let head = JSON.stringify(predictions[0]['mesh'][10]);
    let rightchek = JSON.stringify(predictions[0]['mesh'][454]);
  let leftcheek = JSON.stringify(predictions[0]['mesh'][234]);
  let  chin = JSON.stringify(predictions[0]['mesh'][152][2]);
  let  nose = JSON.stringify(predictions[0]['mesh'][134]);
   midwaydata = JSON.stringify(predictions[0]['annotations']['midwayBetweenEyes'][0][0]);
   let headz= JSON.stringify(predictions[0]['mesh'][10][2]);
   let  chinY = JSON.stringify(predictions[0]['mesh'][152][1]);

  // let  midwaydata1 = JSON.stringify(predictions[0]['annotations']['noseTip']);
    //rightCheek = JSON.stringify(predictions[0]['annotations']['rightCheek']);
    //lipsUpperOuter = JSON.stringify(predictions[0]['annotations']['lipsUpperOuter']);
    //nosetip = JSON.stringify(predictions[0]['annotations']['noseTip']);
    //data = "<br> eye midway=>"+midwaydata + "<br>Right Cheek =>"+ rightCheek +"<br> LipsUpperOuter=> "+ lipsUpperOuter  +"<br> NoseTip=>"+nosetip
    //data = "head\n"+head +"\n rightcheek"+ rightchek+"\n lefcheek "+leftcheek+" \nchin==>"+chin
    data = chin
  
    
  }
 
  return data;
}


async function renderPrediction() {
  stats.begin();

  const predictions = await model.estimateFaces(video);
  ctx.drawImage(
      video, 0, 0, videoWidth, videoHeight, 0, 0, canvas.width, canvas.height);

  
       
  if (predictions.length > 0) {
    let positive =0;
    let negative =0;

          let headz= JSON.stringify(predictions[0]['mesh'][10][2]);
          let rightchek = JSON.stringify(predictions[0]['mesh'][454][0]);
         let  chinZ = JSON.stringify(predictions[0]['mesh'][152][2]);

        let leftcheek = JSON.stringify(predictions[0]['mesh'][234][0]);
          
          
           let isout = false;

          //left
          if(isout ==false){
          if(Math.floor(rightchek)<140 ){
            negative +=1;
            isout = true;
     
           }else{
            isout = false;

             positive +=1;
           }
          }
          //right 
          if(isout ==false){
       if( Math.floor(leftcheek)>50 ){
            negative +=1;
            isout = true;

           }else{
             positive +=1;
             isout = false;

           }
          }

          //up 
          if(isout ==false){
            if(Math.floor(headz)>30 ){
              negative +=1;
              isout = true;
       
             }else{
              isout = false;
  
               positive +=1;
             }
            }
            //down 
            if(isout ==false){
              if(Math.floor(chinZ)>30 ){
                negative +=1;
                isout = true;
         
               }else{
                isout = false;
    
                 positive +=1;
               }
              }
            
          if(isout==false){
            const innerHTML2 = "<div style=\"border: 2px dotted #a2a2a2; padding: 12px; border-radius: 8px; margin: 10px;\">" + "Focused" + "</div>";
           document.getElementById('mydiv').innerHTML =innerHTML2;
      
           }else{
            const innerHTML3 = "<div style=\"border: 2px dotted #a2a2a2; padding: 12px; border-radius: 8px; margin: 10px;\">" + "NotFocused" + "</div>";
      
            document.getElementById('mydiv').innerHTML =innerHTML3;

     

    }

     
    
    //show Retina Dots.
     predictions.forEach((prediction) => {
      const keypoints = prediction.scaledMesh;

          const left_x = keypoints[259][0];
          const left_y = keypoints[259][1];

          ctx.beginPath();
          ctx.arc(left_x, left_y, 2 /* radius */, 0, 2 * Math.PI);
          ctx.fill();

          const right_x = keypoints[28][0];
          const right_y = keypoints[28][1];

          ctx.beginPath();
          ctx.arc(right_x, right_y, 2 /* radius */, 0, 2 * Math.PI);
          ctx.fill();
       
    });

    if (renderPointcloud && state.renderPointcloud && scatterGL != null) {
      const pointsData = predictions.map((prediction) => {
        let scaledMesh = prediction.scaledMesh;
        return scaledMesh.map((point) => ([-point[0], -point[1], -point[2]]));
      });

      let flattenedPointsData = [];
      for (let i = 0; i < pointsData.length; i++) {
        flattenedPointsData = flattenedPointsData.concat(pointsData[i]);
      }
      const dataset = new ScatterGL.Dataset(flattenedPointsData);

      if (!scatterGLHasInitialized) {
        scatterGL.render(dataset);
      } else {
        scatterGL.updateDataset(dataset);
      }
      scatterGLHasInitialized = true;
    }
  }

  stats.end();
  requestAnimationFrame(renderPrediction);
};

function clearBox()
{
  const prevData = document.getElementById("printNodes");

  prevData.innerHTML = "";

}

async function main() {
  await tf.setBackend(state.backend);
  setupDatGui();

  stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
  document.getElementById('main').appendChild(stats.dom);

  await setupCamera();
  video.play();
  videoWidth = video.videoWidth;
  videoHeight = video.videoHeight;
  video.width = videoWidth;
  video.height = videoHeight;

  canvas = document.getElementById('output');
  canvas.width = videoWidth;
  canvas.height = videoHeight;
  const canvasContainer = document.querySelector('.canvas-wrapper');
  canvasContainer.style = `width: ${videoWidth}px; height: ${videoHeight}px`;

  ctx = canvas.getContext('2d');
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.fillStyle = '#32EEDB';
  ctx.strokeStyle = '#32EEDB';
  ctx.lineWidth = 0.5;

  model = await facemesh.load({maxFaces: state.maxFaces});
  renderPrediction();

  if (renderPointcloud) {
    document.querySelector('#scatter-gl-container').style =
        `width: ${VIDEO_SIZE}px; height: ${VIDEO_SIZE}px;`;

    scatterGL = new ScatterGL(
        document.querySelector('#scatter-gl-container'),
        {'rotateOnStart': false, 'selectEnabled': false});
  }

  document.getElementById("captureNodes").addEventListener("click", async function(){
    const _data = await getCoordinates();
    if (typeof _data==="undefined"){

      document.getElementById('mydiv').innerHTML ="Not on screen";
     }
    const prevData = document.getElementById("printNodes");
    const innerHTML = "<div style=\"border: 2px dotted #a2a2a2; padding: 12px; border-radius: 8px; margin: 10px;\">" + _data + "</div>";

    prevData.insertAdjacentHTML( 'beforeend', innerHTML );
  });

  document.getElementById("clearNodes").addEventListener("click", async function(){
    const prevData = document.getElementById("printNodes");
    prevData.innerHTML = "";

  });


  
};

main();
