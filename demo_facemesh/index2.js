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
  let midwaydata,noseleft,noseBottom,noseright,nosetip;
  const predictions = await model.estimateFaces(video);
  ctx.drawImage(video, 0, 0, videoWidth, videoHeight, 0, 0, canvas.width, canvas.height);

  if (predictions.length > 0) {
    midwaydata = JSON.stringify(predictions[0]['annotations']['leftCheek']);
    noseBottom = JSON.stringify(predictions[0]['annotations']['leftEyeLower0']);
    noseleft = JSON.stringify(predictions[0]['annotations']['leftEyebrowLower']);
    noseright = JSON.stringify(predictions[0]['annotations']['rightCheek']);
    nosetip = JSON.stringify(predictions[0]['annotations']['lipsUpperOuter']);

    // midwaydata = JSON.stringify(predictions[0]['annotations']['midwayBetweenEyes']);
    // noseBottom = JSON.stringify(predictions[0]['annotations']['noseBottom']);
    // noseleft = JSON.stringify(predictions[0]['annotations']['noseLeftCorner']);
    // noseright = JSON.stringify(predictions[0]['annotations']['noseRightCorner']);
    // nosetip = JSON.stringify(predictions[0]['annotations']['noseTip']);
     data = "<br>leftCheek=>"+midwaydata + "<br>leftEyeLower0 =>"+ noseBottom +"<br> leftEyebrowLower=> "+ noseleft +"<br>rightCheek=>"+ noseright +"<br> lipsUpperOuter=>"+nosetip
    //data = data + " NoseTip==>\n\n"+ data1

   // let data = JSON.stringify(predictions[0]['annotations']['noseTip']);

    // setTimeout( console.log(predictions[0]) , 100000);
 
    
  }
 
  return data;
}

let val;
const NOSETIP_THRESHOLD_UPPER=400;

const NOSETIP_THRESHOLD_LOWER = 200;
const RIGHTCHEEK_THRESHOLD_UPPER=350;
const RIGHTCHEEK_THRESHOLD_LOWER=160;
const LIPOUTER_THRESHOLD_UPPER=245;
const LIPOUTER_THRESHOLD_LOWER=230;
async function renderPrediction() {
  stats.begin();

  const predictions = await model.estimateFaces(video);
  ctx.drawImage(
      video, 0, 0, videoWidth, videoHeight, 0, 0, canvas.width, canvas.height);

  if (predictions.length > 0) {
    // var stat = JSON.stringify(predictions)
    // document.getElementById("stats").innerHTML(stat)
    // console.log("helo dinesh")
   // stat1 = predictions
// console.log("helloooo")
let positive =0;
let negative =0;
   let val = predictions[0]['annotations']['noseTip'][0][0]
   //console.log(typeof val)
    if( typeof val === "number"){

      if(Math.floor(val)>NOSETIP_THRESHOLD_LOWER && Math.floor(val)<NOSETIP_THRESHOLD_UPPER){
        positive +=1;
      //document.getElementById('mydiv').innerHTML ="Focused " + val;
  
     }
     else if(Math.floor(val)>NOSETIP_THRESHOLD_UPPER){
      negative +=1;
     // document.getElementById('mydiv').innerHTML ="Not Focused"+val ;
  
     }
     else{
      negative +=1;

     // document.getElementById('mydiv').innerHTML ="Not Focused==>" +val ;
  
     }
    }

    let val1 = predictions[0]['annotations']['rightCheek'][0][0]
    //console.log(typeof val)
     if( typeof val1 === "number"){
 
       if(Math.floor(val1)>RIGHTCHEEK_THRESHOLD_LOWER && Math.floor(val1)<RIGHTCHEEK_THRESHOLD_UPPER){
       //document.getElementById('mydiv').innerHTML ="Focused " + val;
       positive +=1;

      }
      else if(Math.floor(val1)>NOSETIP_THRESHOLD_UPPER){
      // document.getElementById('mydiv').innerHTML ="Not Focused"+val ;
      negative +=1;

      }
      else{
     //  document.getElementById('mydiv').innerHTML ="Not Focused==>" +val ;
     negative +=1;

      }
     }

     let val2 = predictions[0]['annotations']['lipsUpperOuter'][0][0]
     //console.log(typeof val)
      if( typeof val2 === "number"){
  
        if(Math.floor(val2)>LIPOUTER_THRESHOLD_LOWER && Math.floor(val2)<LIPOUTER_THRESHOLD_UPPER){
        //document.getElementById('mydiv').innerHTML ="Focused " + val;
        positive +=1;
 
       }
       else if(Math.floor(val2)>LIPOUTER_THRESHOLD_UPPER){
       // document.getElementById('mydiv').innerHTML ="Not Focused"+val ;
       negative +=1;
 
       }
       else{
      //  document.getElementById('mydiv').innerHTML ="Not Focused==>" +val ;
      negative +=1;
 
       }
      }

      //checking vertically for up and down
      let val3 = predictions[0]['annotations']['noseTip'][0][1]
     //console.log(typeof val)
      if( typeof val3 === "number"){
  
        if(Math.floor(val3)>290 && Math.floor(val3)<380){
        //document.getElementById('mydiv').innerHTML ="Focused " + val3;
        positive +=1;
 
       }
      //  else if(Math.floor(val3)>380){
      //  // document.getElementById('mydiv').innerHTML ="Not Focused"+val3 ;
      //  negative +=1;
 
      //  }
       else{
       // document.getElementById('mydiv').innerHTML ="Not Focused==>" +val3 ;
      negative +=1;
 
       }
      }

     if(positive>negative){

      const innerHTML1 = "<div style=\"border: 2px dotted #a2a2a2; padding: 12px; border-radius: 8px; margin: 10px;\">" + "Focused" + "</div>";

     document.getElementById('mydiv').innerHTML =innerHTML1;

     }else{
      const innerHTML2 = "<div style=\"border: 2px dotted #a2a2a2; padding: 12px; border-radius: 8px; margin: 10px;\">" + "NotFocused" + "</div>";

      document.getElementById('mydiv').innerHTML =innerHTML2;

     }
    predictions.forEach((prediction) => {
      const keypoints = prediction.scaledMesh;

      if (state.triangulateMesh) {
        for (let i = 0; i < TRIANGULATION.length / 3; i++) {
          const points = [
            TRIANGULATION[i * 3], TRIANGULATION[i * 3 + 1],
            TRIANGULATION[i * 3 + 2],
          ].map((index) => keypoints[index]);

          drawPath(ctx, points, true);
        }
      } else {
        for (let i = 0; i < keypoints.length; i++) {
          const x = keypoints[i][0];
          const y = keypoints[i][1];

          ctx.beginPath();
          ctx.arc(x, y, 1 /* radius */, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
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

      document.getElementById('mydiv').innerHTML ="NOt on screen";
     }
    const prevData = document.getElementById("printNodes");
    const innerHTML = "<div style=\"border: 2px dotted #a2a2a2; padding: 12px; border-radius: 8px; margin: 10px;\">" + _data + "</div>";

    prevData.insertAdjacentHTML( 'beforeend', innerHTML );
  });

  document.getElementById("clearNodes").addEventListener("click", async function(){
    //console.log("hello")
    const prevData = document.getElementById("printNodes");
    //console.log("hello",prevData)
    prevData.innerHTML = "";

  });


  
};

main();
