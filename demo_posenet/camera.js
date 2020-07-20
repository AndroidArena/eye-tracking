/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
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
import * as posenet from '@tensorflow-models/posenet';
import dat from 'dat.gui';
import Stats from 'stats.js';

import {drawBoundingBox, drawKeypoints, drawSkeleton, isMobile, toggleLoadingUI, tryResNetButtonName, tryResNetButtonText, updateTryResNetButtonDatGuiCss} from './demo_util';

const videoWidth = 600;
const videoHeight = 500;
const stats = new Stats();

/**
 * Loads a the camera to be used in the demo
 *
 */
async function setupCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error(
        'Browser API navigator.mediaDevices.getUserMedia not available');
  }

  const video = document.getElementById('video');
  video.width = videoWidth;
  video.height = videoHeight;

  const mobile = isMobile();
  const stream = await navigator.mediaDevices.getUserMedia({
    'audio': false,
    'video': {
      facingMode: 'user',
      width: mobile ? undefined : videoWidth,
      height: mobile ? undefined : videoHeight,
    },
  });
  video.srcObject = stream;

  return new Promise((resolve) => {
    video.onloadedmetadata = () => {
      resolve(video);
    };
  });
}

async function loadVideo() {
  const video = await setupCamera();
  video.play();

  return video;
}

const defaultQuantBytes = 2;

const defaultMobileNetMultiplier = isMobile() ? 0.50 : 0.75;
const defaultMobileNetStride = 16;
const defaultMobileNetInputResolution = 500;

const defaultResNetMultiplier = 1.0;
const defaultResNetStride = 32;
const defaultResNetInputResolution = 250;

const guiState = {
  algorithm: 'multi-pose',
  input: {
    architecture: 'MobileNetV1',
    outputStride: defaultMobileNetStride,
    inputResolution: defaultMobileNetInputResolution,
    multiplier: defaultMobileNetMultiplier,
    quantBytes: defaultQuantBytes
  },
  singlePoseDetection: {
    minPoseConfidence: 0.1,
    minPartConfidence: 0.5,
  },
  multiPoseDetection: {
    maxPoseDetections: 5,
    minPoseConfidence: 0.15,
    minPartConfidence: 0.1,
    nmsRadius: 30.0,
  },
  output: {
    showVideo: true,
    showSkeleton: true,
    showPoints: true,
    showBoundingBox: false,
  },
  net: null,
};

/**
 * Sets up dat.gui controller on the top-right of the window
 */
function setupGui(cameras, net) {
  guiState.net = net;

  if (cameras.length > 0) {
    guiState.camera = cameras[0].deviceId;
  }

  const gui = new dat.GUI({width: 300});

  let architectureController = null;
  guiState[tryResNetButtonName] = function() {
    architectureController.setValue('ResNet50')
  };
  gui.add(guiState, tryResNetButtonName).name(tryResNetButtonText);
  updateTryResNetButtonDatGuiCss();

  // The single-pose algorithm is faster and simpler but requires only one
  // person to be in the frame or results will be innaccurate. Multi-pose works
  // for more than 1 person
  const algorithmController =
      gui.add(guiState, 'algorithm', ['single-pose', 'multi-pose']);

  // The input parameters have the most effect on accuracy and speed of the
  // network
  let input = gui.addFolder('Input');
  // Architecture: there are a few PoseNet models varying in size and
  // accuracy. 1.01 is the largest, but will be the slowest. 0.50 is the
  // fastest, but least accurate.
  architectureController =
      input.add(guiState.input, 'architecture', ['MobileNetV1', 'ResNet50']);
  guiState.architecture = guiState.input.architecture;
  // Input resolution:  Internally, this parameter affects the height and width
  // of the layers in the neural network. The higher the value of the input
  // resolution the better the accuracy but slower the speed.
  let inputResolutionController = null;
  function updateGuiInputResolution(
      inputResolution,
      inputResolutionArray,
  ) {
    if (inputResolutionController) {
      inputResolutionController.remove();
    }
    guiState.inputResolution = inputResolution;
    guiState.input.inputResolution = inputResolution;
    inputResolutionController =
        input.add(guiState.input, 'inputResolution', inputResolutionArray);
    inputResolutionController.onChange(function(inputResolution) {
      guiState.changeToInputResolution = inputResolution;
    });
  }

  // Output stride:  Internally, this parameter affects the height and width of
  // the layers in the neural network. The lower the value of the output stride
  // the higher the accuracy but slower the speed, the higher the value the
  // faster the speed but lower the accuracy.
  let outputStrideController = null;
  function updateGuiOutputStride(outputStride, outputStrideArray) {
    if (outputStrideController) {
      outputStrideController.remove();
    }
    guiState.outputStride = outputStride;
    guiState.input.outputStride = outputStride;
    outputStrideController =
        input.add(guiState.input, 'outputStride', outputStrideArray);
    outputStrideController.onChange(function(outputStride) {
      guiState.changeToOutputStride = outputStride;
    });
  }

  // Multiplier: this parameter affects the number of feature map channels in
  // the MobileNet. The higher the value, the higher the accuracy but slower the
  // speed, the lower the value the faster the speed but lower the accuracy.
  let multiplierController = null;
  function updateGuiMultiplier(multiplier, multiplierArray) {
    if (multiplierController) {
      multiplierController.remove();
    }
    guiState.multiplier = multiplier;
    guiState.input.multiplier = multiplier;
    multiplierController =
        input.add(guiState.input, 'multiplier', multiplierArray);
    multiplierController.onChange(function(multiplier) {
      guiState.changeToMultiplier = multiplier;
    });
  }

  // QuantBytes: this parameter affects weight quantization in the ResNet50
  // model. The available options are 1 byte, 2 bytes, and 4 bytes. The higher
  // the value, the larger the model size and thus the longer the loading time,
  // the lower the value, the shorter the loading time but lower the accuracy.
  let quantBytesController = null;
  function updateGuiQuantBytes(quantBytes, quantBytesArray) {
    if (quantBytesController) {
      quantBytesController.remove();
    }
    guiState.quantBytes = +quantBytes;
    guiState.input.quantBytes = +quantBytes;
    quantBytesController =
        input.add(guiState.input, 'quantBytes', quantBytesArray);
    quantBytesController.onChange(function(quantBytes) {
      guiState.changeToQuantBytes = +quantBytes;
    });
  }

  function updateGui() {
    if (guiState.input.architecture === 'MobileNetV1') {
      updateGuiInputResolution(
          defaultMobileNetInputResolution,
          [200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800]);
      updateGuiOutputStride(defaultMobileNetStride, [8, 16]);
      updateGuiMultiplier(defaultMobileNetMultiplier, [0.50, 0.75, 1.0]);
    } else {  // guiState.input.architecture === "ResNet50"
      updateGuiInputResolution(
          defaultResNetInputResolution,
          [200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800]);
      updateGuiOutputStride(defaultResNetStride, [32, 16]);
      updateGuiMultiplier(defaultResNetMultiplier, [1.0]);
    }
    updateGuiQuantBytes(defaultQuantBytes, [1, 2, 4]);
  }

  updateGui();
  input.open();
  // Pose confidence: the overall confidence in the estimation of a person's
  // pose (i.e. a person detected in a frame)
  // Min part confidence: the confidence that a particular estimated keypoint
  // position is accurate (i.e. the elbow's position)
  let single = gui.addFolder('Single Pose Detection');
  single.add(guiState.singlePoseDetection, 'minPoseConfidence', 0.0, 1.0);
  single.add(guiState.singlePoseDetection, 'minPartConfidence', 0.0, 1.0);

  let multi = gui.addFolder('Multi Pose Detection');
  multi.add(guiState.multiPoseDetection, 'maxPoseDetections')
      .min(1)
      .max(20)
      .step(1);
  multi.add(guiState.multiPoseDetection, 'minPoseConfidence', 0.0, 1.0);
  multi.add(guiState.multiPoseDetection, 'minPartConfidence', 0.0, 1.0);
  // nms Radius: controls the minimum distance between poses that are returned
  // defaults to 20, which is probably fine for most use cases
  multi.add(guiState.multiPoseDetection, 'nmsRadius').min(0.0).max(40.0);
  multi.open();

  let output = gui.addFolder('Output');
  output.add(guiState.output, 'showVideo');
  output.add(guiState.output, 'showSkeleton');
  output.add(guiState.output, 'showPoints');
  output.add(guiState.output, 'showBoundingBox');
  output.open();


  architectureController.onChange(function(architecture) {
    // if architecture is ResNet50, then show ResNet50 options
    updateGui();
    guiState.changeToArchitecture = architecture;
  });

  algorithmController.onChange(function(value) {
    switch (guiState.algorithm) {
      case 'single-pose':
        multi.close();
        single.open();
        break;
      case 'multi-pose':
        single.close();
        multi.open();
        break;
    }
  });
}

/**
 * Sets up a frames per second panel on the top-left of the window
 */
function setupFPS() {
  stats.showPanel(0);  // 0: fps, 1: ms, 2: mb, 3+: custom
  document.getElementById('main').appendChild(stats.dom);
}

var i,data;
let count =0;
let count_cup=0
function setpose(keypoints){

// for (i = 0; i < keypoints.length; i++) {
//   data += JSON.stringify(keypoints)[i]["position"]["x"] + "<br>";
//   data += keypoints[i]["position"]["y"] + "<br>";
// }
data =JSON.stringify(keypoints);


//left eye
let lefteye_part = JSON.stringify(keypoints[1]["part"]);
let lefteye_x = JSON.stringify(keypoints[1]["position"]["x"]);
let lefteye_y = JSON.stringify(keypoints[1]["position"]["y"]);


//left Ear
let leftear_part = JSON.stringify(keypoints[3]["part"]);
let leftear_x = JSON.stringify(keypoints[3]["position"]["x"]);
let leftear_y = JSON.stringify(keypoints[3]["position"]["y"]);

//Right Ear
let rightear_part = JSON.stringify(keypoints[4]["part"]);
let rightear_x= JSON.stringify(keypoints[4]["position"]["x"]);
let rightear_y= JSON.stringify(keypoints[4]["position"]["y"]);

//left wrist
let leftwrist_part = JSON.stringify(keypoints[9]["part"]);
let leftwrist_x = JSON.stringify(keypoints[9]["position"]["x"]);
let leftwrist_y = JSON.stringify(keypoints[9]["position"]["y"]);

//Right wrist
let rightwrist_part = JSON.stringify(keypoints[10]["part"]);
let rightwrist_x= JSON.stringify(keypoints[10]["position"]["x"]);
let rightwrist_y= JSON.stringify(keypoints[10]["position"]["y"]);

//shoulder left
let leftshoulder_part = JSON.stringify(keypoints[5]["part"]);
let leftshoulder_x = JSON.stringify(keypoints[5]["position"]["x"]);
let leftshoulder_y = JSON.stringify(keypoints[5]["position"]["y"]);

//shoulder Right
let rightshoulder_part = JSON.stringify(keypoints[6]["part"]);
let rightshoulder_x= JSON.stringify(keypoints[6]["position"]["x"]);
let rightshoulder_y= JSON.stringify(keypoints[6]["position"]["y"]);


//elbow left
let leftelbow_part = JSON.stringify(keypoints[7]["part"]);
let leftelbow_x = JSON.stringify(keypoints[7]["position"]["x"]);
let leftelbow_y = JSON.stringify(keypoints[7]["position"]["y"]);

//elbow Right
let rightelbow_part = JSON.stringify(keypoints[8]["part"]);
let rightelbow_x= JSON.stringify(keypoints[8]["position"]["x"]);
let rightelbow_y= JSON.stringify(keypoints[8]["position"]["y"]);


let finalvalues = lefteye_part +"<br>"+ "X:: "+lefteye_x +"<br>"+" Y :: "+
lefteye_y 

// let finalvalues = leftelbow_part +"<br>"+ "X:: "+leftelbow_x +"<br>"+" Y :: "+
// leftelbow_y +"<br><br>"+ rightelbow_part +
//  "<br>"+ "X:: "+rightelbow_x +"<br>"+"Y :: "+ rightelbow_y



// let finalvalues = rightshoulder_part +"<br>"+ "X:: "+rightshoulder_x +"<br>"+" Y :: "+
// rightshoulder_y +"<br><br>"+ leftshoulder_part +
//  "<br>"+ "X:: "+leftshoulder_x +"<br>"+"Y :: "+ leftshoulder_y


// let finalvalues = leftear_part +"<br>"+ "X:: "+leftear_x +"<br>"+" Y :: "+
//  leftear_y +"<br><br>"+ rightear_part +
//  "<br>"+ "X:: "+rightear_x +"<br>"+"Y :: "+ rightear_y


// let finalvalues = leftshoulder_part +"<br>"+ "X:: "+leftshoulder_x +"<br>"+" Y :: "+leftshoulder_y 
//      +"<br><br>"+ 
//  leftelbow_part +"<br>"+ "X:: "+leftelbow_x +"<br>"+"Y :: "+ leftelbow_y
//  +"<br><br>"+ 
//  leftwrist_part +"<br>"+ "X:: "+leftwrist_x +"<br>"+"Y :: "+ leftwrist_y

// let finalvalues =  leftwrist_part +"<br>"+ "X:: "+leftwrist_x +"<br>"+"Y :: "+ leftwrist_y
// //rightshoulder_part +"<br>"+ "X:: "+rightshoulder_x +"<br>"+" Y :: "+rightshoulder_y 
//      +"<br><br>"+ 
//     // rightelbow_part +"<br>"+ "X:: "+rightelbow_x +"<br>"+"Y :: "+ rightelbow_y
//  +"<br><br>"+ 
//  rightwrist_part +"<br>"+ "X:: "+rightwrist_x +"<br>"+"Y :: "+ rightwrist_y

// let finalvalues = leftear_part +"<br>"+ "X:: "+leftear_x +"<br>"+" Y :: "+leftear_y 
//      +"<br><br>"+ 
//      rightear_part +"<br>"+ "X:: "+rightear_x +"<br>"+"Y :: "+ rightear_y

 //result


 var isperf = false;
//document.getElementById('mydiv').innerHTML = "<div style=\"border: 2px dotted #a2a2a2; padding: 12px; border-radius: 8px; margin: 10px;\">" + isperf + "</div>";

//looking down
if ((isperf==false) && lefteye_y > 280 ) {
  isperf =true;
  document.getElementById('mydiv').innerHTML =  "<div style=\"border: 2px dotted #a2a2a2; padding: 12px; border-radius: 8px; margin: 10px;\">" + "looking Down" + "</div>";
 }

//  //looking up
//  if ((isperf==false) && lefteye_y < 200 ) {
//   isperf =true;
//   document.getElementById('mydiv').innerHTML =  "<div style=\"border: 2px dotted #a2a2a2; padding: 12px; border-radius: 8px; margin: 10px;\">" + "looking Up" + "</div>";
//  }
 //Body building
 if ((isperf==false) && leftshoulder_y < 450 && leftelbow_y < 450 && leftwrist_y <300 ) {
  isperf =true;
  count=0
  document.getElementById('mydiv').innerHTML =  "<div style=\"border: 2px dotted #a2a2a2; padding: 12px; border-radius: 8px; margin: 10px;\">" + "Body Building" + "</div>";
 }


//talking on phone left
 if (isperf==false&& (leftwrist_x > 130 && leftwrist_x<200 && leftwrist_y >240 && leftwrist_y<400)   ) {
  isperf =true;
 
  if(count>30){
    //count=0
  document.getElementById('mydiv').innerHTML =  "<div style=\"border: 2px dotted #a2a2a2; padding: 12px; border-radius: 8px; margin: 10px;\">" + "Talking on Phone " + count+ "</div>";
 }else{
  count+=1;
  document.getElementById('mydiv').innerHTML =  "<div style=\"border: 2px dotted #a2a2a2; padding: 12px; border-radius: 8px; margin: 10px;\">" + "Touching ears or Talking on phone " + count+ "</div>";

 }
}


//right body building
 if ((isperf==false) && rightshoulder_y < 450 && rightelbow_y < 500 && rightwrist_y <300 ) {
  isperf =true;
  count=0
  document.getElementById('mydiv').innerHTML =  "<div style=\"border: 2px dotted #a2a2a2; padding: 12px; border-radius: 8px; margin: 10px;\">" + "Body Building" + "</div>";
 }

//talking on phone right
if (isperf==false&& (rightwrist_x > 300 && rightwrist_x<400 && rightwrist_y >200 && rightwrist_y<400)   ) {
  isperf =true;
  
  if(count>30){
    //count=0
    document.getElementById('mydiv').innerHTML =  "<div style=\"border: 2px dotted #a2a2a2; padding: 12px; border-radius: 8px; margin: 10px;\">" + "Talking on Phone Left " + count+ "</div>";
   }else{
    count+=1;
    document.getElementById('mydiv').innerHTML =  "<div style=\"border: 2px dotted #a2a2a2; padding: 12px; border-radius: 8px; margin: 10px;\">" + "Touching ears or Talking on phone " + count+ "</div>";
  
   }
   }

 
 
    
     // moving right shoulder
     if ((isperf==false) && rightshoulder_y < 420 &&  rightshoulder_x <420 && leftelbow_x>400 && leftelbow_y<450 ) {
      isperf =true;

      document.getElementById('mydiv').innerHTML =  "<div style=\"border: 2px dotted #a2a2a2; padding: 12px; border-radius: 8px; margin: 10px;\">" + "Moving left shoulder Streching" + "</div>";
     }

       // moving left shoulder

       if ((isperf==false) && leftshoulder_x > 120 &&  leftshoulder_y < 450 && rightelbow_x<10 && rightelbow_y<500) {
        isperf =true;
        document.getElementById('mydiv').innerHTML =  "<div style=\"border: 2px dotted #a2a2a2; padding: 12px; border-radius: 8px; margin: 10px;\">" + "Moving right shoulder Streching" + "</div>";
       }

          //moving both shoulder left + right = both
          if ((isperf==false) && (rightshoulder_y < 420 &&  rightshoulder_x <420)&&(leftshoulder_x > 120 &&  leftshoulder_y < 450) ) {
            isperf =true;
            document.getElementById('mydiv').innerHTML =  "<div style=\"border: 2px dotted #a2a2a2; padding: 12px; border-radius: 8px; margin: 10px;\">" + "Moving both shoulder" + "</div>";
           }
      
  //moving head left
  if (isperf==false && (leftear_x <170 && leftear_y>250)  ) {
    isperf =true;
    
  
      //count=0
      document.getElementById('mydiv').innerHTML =  "<div style=\"border: 2px dotted #a2a2a2; padding: 12px; border-radius: 8px; margin: 10px;\">" + "Moving head to left " + count+ "</div>";
    
     }
     //moving head right
     if (isperf==false && (rightear_x >360 && rightear_y>260)  ) {
      isperf =true;
      
    
        //count=0
        document.getElementById('mydiv').innerHTML =  "<div style=\"border: 2px dotted #a2a2a2; padding: 12px; border-radius: 8px; margin: 10px;\">" + "Moving head to right " + count+ "</div>";
      
       }
    //holding zomething
    if (isperf==false &&( leftwrist_x >100 )|| (rightwrist_x<400 && rightwrist_y>400)) {
      isperf =true;
      count_cup +=1
        document.getElementById('mydiv').innerHTML =  "<div style=\"border: 2px dotted #a2a2a2; padding: 12px; border-radius: 8px; margin: 10px;\">" + "holding something "+ "</div>";
      
       }
       
         //holding cup
    if (isperf==false && rightwrist_x<400 && rightwrist_y<250  ) {
      isperf =true;
      count_cup +=1
        document.getElementById('mydiv').innerHTML =  "<div style=\"border: 2px dotted #a2a2a2; padding: 12px; border-radius: 8px; margin: 10px;\">" + "scarthing head "+ "</div>";
      
       }  


 //normal
if(isperf ==false){
  count=0
    document.getElementById('mydiv').innerHTML = "<div style=\"border: 2px dotted #a2a2a2; padding: 12px; border-radius: 8px; margin: 10px;\">" + "Normal " + "</div>";
   
}
 document.getElementById('mydiv1').innerHTML = finalvalues ;

    
//leftwirst - y axis 230 less 
//left elbow y - less 400
//left shoulder y -less 310
//&& (leftelbow_x < 150 && leftelbow_x <500 )
//wrist y greater 240 x greater 140
//elbow y 500 less x less 150

  document.getElementById("captureNodes").addEventListener("click", async function(){
    const _data = data;
    // if (typeof data==="undefined"){

    //   document.getElementById('mydiv').innerHTML ="Not on screen";
    //  }
    const prevData = document.getElementById("printNodes");
    const innerHTML = "<div style=\"border: 2px dotted #a2a2a2; padding: 12px; border-radius: 8px; margin: 10px;\">" + _data + "</div>";

    prevData.insertAdjacentHTML( 'beforeend', innerHTML );
  });

  document.getElementById("clearNodes").addEventListener("click", async function(){
    const prevData = document.getElementById("printNodes");
    prevData.innerHTML = "";

  });

}
/**
 * Feeds an image to posenet to estimate poses - this is where the magic
 * happens. This function loops with a requestAnimationFrame method.
 */
function detectPoseInRealTime(video, net) {
  const canvas = document.getElementById('output');
  const ctx = canvas.getContext('2d');

  // since images are being fed from a webcam, we want to feed in the
  // original image and then just flip the keypoints' x coordinates. If instead
  // we flip the image, then correcting left-right keypoint pairs requires a
  // permutation on all the keypoints.
  const flipPoseHorizontal = true;

  canvas.width = videoWidth;
  canvas.height = videoHeight;

  async function poseDetectionFrame() {
    if (guiState.changeToArchitecture) {
      // Important to purge variables and free up GPU memory
      guiState.net.dispose();
      toggleLoadingUI(true);
      guiState.net = await posenet.load({
        architecture: guiState.changeToArchitecture,
        outputStride: guiState.outputStride,
        inputResolution: guiState.inputResolution,
        multiplier: guiState.multiplier,
      });
      toggleLoadingUI(false);
      guiState.architecture = guiState.changeToArchitecture;
      guiState.changeToArchitecture = null;
    }

    if (guiState.changeToMultiplier) {
      guiState.net.dispose();
      toggleLoadingUI(true);
      guiState.net = await posenet.load({
        architecture: guiState.architecture,
        outputStride: guiState.outputStride,
        inputResolution: guiState.inputResolution,
        multiplier: +guiState.changeToMultiplier,
        quantBytes: guiState.quantBytes
      });
      toggleLoadingUI(false);
      guiState.multiplier = +guiState.changeToMultiplier;
      guiState.changeToMultiplier = null;
    }

    if (guiState.changeToOutputStride) {
      // Important to purge variables and free up GPU memory
      guiState.net.dispose();
      toggleLoadingUI(true);
      guiState.net = await posenet.load({
        architecture: guiState.architecture,
        outputStride: +guiState.changeToOutputStride,
        inputResolution: guiState.inputResolution,
        multiplier: guiState.multiplier,
        quantBytes: guiState.quantBytes
      });
      toggleLoadingUI(false);
      guiState.outputStride = +guiState.changeToOutputStride;
      guiState.changeToOutputStride = null;
    }

    if (guiState.changeToInputResolution) {
      // Important to purge variables and free up GPU memory
      guiState.net.dispose();
      toggleLoadingUI(true);
      guiState.net = await posenet.load({
        architecture: guiState.architecture,
        outputStride: guiState.outputStride,
        inputResolution: +guiState.changeToInputResolution,
        multiplier: guiState.multiplier,
        quantBytes: guiState.quantBytes
      });
      toggleLoadingUI(false);
      guiState.inputResolution = +guiState.changeToInputResolution;
      guiState.changeToInputResolution = null;
    }

    if (guiState.changeToQuantBytes) {
      // Important to purge variables and free up GPU memory
      guiState.net.dispose();
      toggleLoadingUI(true);
      guiState.net = await posenet.load({
        architecture: guiState.architecture,
        outputStride: guiState.outputStride,
        inputResolution: guiState.inputResolution,
        multiplier: guiState.multiplier,
        quantBytes: guiState.changeToQuantBytes
      });
      toggleLoadingUI(false);
      guiState.quantBytes = guiState.changeToQuantBytes;
      guiState.changeToQuantBytes = null;
    }

    // Begin monitoring code for frames per second
    stats.begin();

    let poses = [];
    let minPoseConfidence;
    let minPartConfidence;
    switch (guiState.algorithm) {
      case 'single-pose':
        const pose = await guiState.net.estimatePoses(video, {
          flipHorizontal: flipPoseHorizontal,
          decodingMethod: 'single-person'
        });
        poses = poses.concat(pose);
        minPoseConfidence = +guiState.singlePoseDetection.minPoseConfidence;
        minPartConfidence = +guiState.singlePoseDetection.minPartConfidence;
        break;
      case 'multi-pose':
        let all_poses = await guiState.net.estimatePoses(video, {
          flipHorizontal: flipPoseHorizontal,
          decodingMethod: 'multi-person',
          maxDetections: guiState.multiPoseDetection.maxPoseDetections,
          scoreThreshold: guiState.multiPoseDetection.minPartConfidence,
          nmsRadius: guiState.multiPoseDetection.nmsRadius
        });

        poses = poses.concat(all_poses);
        
        minPoseConfidence = +guiState.multiPoseDetection.minPoseConfidence;
        minPartConfidence = +guiState.multiPoseDetection.minPartConfidence;
        break;
    }

    ctx.clearRect(0, 0, videoWidth, videoHeight);

    if (guiState.output.showVideo) {
      ctx.save();
      ctx.scale(-1, 1);
      ctx.translate(-videoWidth, 0);
      ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
      ctx.restore();
    }

    // For each pose (i.e. person) detected in an image, loop through the poses
    // and draw the resulting skeleton and keypoints if over certain confidence
    // scores
    poses.forEach(({score, keypoints}) => {
      if (score >= minPoseConfidence) {
        setpose(keypoints)
        // setpose(keypoints[0]["position"]["x"]);
        // setpose(keypoints[0]["part"]);

        if (guiState.output.showPoints) {

          drawKeypoints(keypoints, minPartConfidence, ctx);
        }
        if (guiState.output.showSkeleton) {
          drawSkeleton(keypoints, minPartConfidence, ctx);
        }
        if (guiState.output.showBoundingBox) {
          drawBoundingBox(keypoints, ctx);
        }
      }
    });

    // End monitoring code for frames per second
    stats.end();

    requestAnimationFrame(poseDetectionFrame);
  }

  poseDetectionFrame();
}

/**
 * Kicks off the demo by loading the posenet model, finding and loading
 * available camera devices, and setting off the detectPoseInRealTime function.
 */
export async function bindPage() {
  toggleLoadingUI(true);
  const net = await posenet.load({
    architecture: guiState.input.architecture,
    outputStride: guiState.input.outputStride,
    inputResolution: guiState.input.inputResolution,
    multiplier: guiState.input.multiplier,
    quantBytes: guiState.input.quantBytes
  });
  toggleLoadingUI(false);

  let video;

  try {
    video = await loadVideo();
  } catch (e) {
    let info = document.getElementById('info');
    info.textContent = 'this browser does not support video capture,' +
        'or this device does not have a camera';
    info.style.display = 'block';
    throw e;
  }

  setupGui([], net);
  setupFPS();
  detectPoseInRealTime(video, net);
}

navigator.getUserMedia = navigator.getUserMedia ||
    navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
// kick off the demo
bindPage();
