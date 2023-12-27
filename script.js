
import { ZLoc } from './ZLoc.js';
import { Domain } from './ZLoc.js';

import { USection } from './ZLoc.js';
import { Layer } from './ZLoc.js';

var LAYER_WIDTH = 400;
const MINKT = 0.0001;
const _ms2S = 0.001;
const _mm2M = 0.001;
const _s2Ms = 1000.0;
const _m2Mm = 1000.0;

var mX = 0, mY = 0;
var frame = 0;
var pointerDomain = Domain.None;
var editLayer;
var prevIdx = -1;
var prevY = -999;

var uSection;





// class USection {

//     constructor(width) {
//         this.layers = []; // Initialize an empty array
//         this.minDepth = -100.0;
//         this.maxDepth = 4000.0;
//         this.minTime = -100.0;
//         this.maxTime = 4000.0;
//         this.xValues = new Array(width).fill(0.0);
//         this.canvasDepth = null;
//         this.canvasTime = null;
//         this.width = width;
//     }

//     addLayer(name, color, v0, k, initDepth) {
//         var newLayer = new Layer(name, color, v0, k, this.width, initDepth);
//         newLayer.index = this.layers.length;
//         this.layers.push(newLayer);
//     }

//     setVerticalRange(domain, min, max) {
//         if (domain == Domain.DomDepth) {
//             this.minDepth = min;
//             this.maxDepth = max;
//         }
//         else if (domain == Domain.DomTime) {
//             this.minTime = min;
//             this.maxTime = max;
//         }
//     }

//     update_TimeFromDepth() {
//         // water at zero always
//         let waterLayer = this.layers[0];
//         waterLayer.setToConstant(Domain.DomDepth, 0);
//         waterLayer.setToConstant(Domain.DomTime, 0);

//         // top layer with simple water velocity
//         let v0 = waterLayer.v0;
//         let mudlineLayer = this.layers[1];
//         for (let i = 0; i < this.width; i++) {
//             mudlineLayer.point[i].time =
//                 mudlineLayer.point[i].depth * 2000 / v0;
//         }


//         // the rest..
//         for (let j = 2; j < this.layers.length; j++) {
//             let layerA = this.layers[j - 1];
//             let layerB = this.layers[j];

//             for (let i = 0; i < this.width; i++) {
//                 let ptA = layerA.point[i];
//                 let ptB = layerB.point[i];
//                 let ptML = mudlineLayer.point[i];
//                 ptB.time = DepthToTime(ptA.time, ptA.depth, ptB.depth, layerA.v0, layerA.k, ptML.time);
//             }
//         }
//     }

//     update_DepthFromTime() {

//         // water at zero always
//         let waterLayer = this.layers[0];
//         waterLayer.setToConstant(Domain.DomDepth, 0);
//         waterLayer.setToConstant(Domain.DomTime, 0);

//         // top layer with simple water velocity
//         let v0 = waterLayer.v0;
//         let mudlineLayer = this.layers[1];
//         for (let i = 0; i < this.width; i++) {
//             mudlineLayer.point[i].depth = v0 * mudlineLayer.point[i].time / 2000;
//         }

//         // the rest..
//         for (let j = 2; j < this.layers.length; j++) {
//             let layerA = this.layers[j - 1];
//             let layerB = this.layers[j];

//             for (let i = 0; i < this.width; i++) {
//                 let ptA = layerA.point[i];
//                 let ptB = layerB.point[i];
//                 let ptML = mudlineLayer.point[i];
//                 ptB.depth = TimeToDepth(ptA.depth, ptA.time, ptB.time, layerA.v0, layerA.k, ptML.time);
//             }

//         }
//     }

//     drawSection(domain, name) {

//         var canvas = document.getElementById(name);
//         var context = canvas.getContext("2d");
//         canvas.width = window.innerWidth - 20;
//         canvas.height = 200;
//         var w = canvas.width;
//         var h = canvas.height;
//         context.clearRect(0, 0, w, h);
//         context.save();

//         // get the vertical range for this domain
//         var minZ = 0;
//         var maxZ = 100;
//         if (domain == Domain.DomDepth) {
//             minZ = this.minDepth;
//             maxZ = this.maxDepth;
//         }
//         else if (domain == Domain.DomTime) {
//             minZ = this.minTime;
//             maxZ = this.maxTime;
//         }

//         // draw, fill layers
//         for (let i = 0; i < this.width; i++) {

//             let x = w * i / (this.width - 1);
//             this.xValues[i] = x;
//         }


//         this.layers.forEach(layer => {
//             var yValues = layer.convertToScreenY(domain, h, minZ, maxZ);
//             //console.log(layer.name + " t:" + layer.point[0].time + " d:" + layer.point[0].depth);
//             this.plotSurface(context, this.xValues, yValues, 'dimgray', layer.color);
//         });

//         this.drawFrame(context);
//     }

//     handleXY(domain, e) {
//         let canvas = domain == Domain.DomTime ? this.canvasTime : this.canvasDepth;
//         const rect = canvas.getBoundingClientRect();
//         return { x: e.clientX - rect.left, y: e.clientY - rect.top };
//     }


//     plotSurface(ctx, xValues, yValues, style, fillColor) {

//         var height = ctx.canvas.height;

//         // fill
//         ctx.beginPath();
//         ctx.fillStyle = fillColor || 'red'; // Default to red if fillColor is not provided
//         ctx.lineWidth = 2;
//         ctx.strokeStyle = style;
//         for (var i = 0; i < xValues.length; i++) {
//             var x = xValues[i];
//             var y = yValues[i];

//             if (i === 0)
//                 ctx.moveTo(x, y);
//             else
//                 ctx.lineTo(x, y);
//         }

//         ctx.lineTo(x, height);
//         ctx.lineTo(xValues[0], height);
//         ctx.fill();

//         ctx.beginPath();
//         for (var i = 0; i < xValues.length; i++) {
//             var x = xValues[i];
//             var y = yValues[i];

//             if (i === 0)
//                 ctx.moveTo(x, y);
//             else
//                 ctx.lineTo(x, y);
//         }

//         ctx.stroke();
//     }

//     drawFrame(ctx) {
//         var width = ctx.canvas.width;
//         var height = ctx.canvas.height;
//         var xMin = 0;

//         ctx.beginPath();
//         ctx.strokeStyle = "rgb(128,128,128)";
//         ctx.lineWidth = 2;
//         ctx.moveTo(xMin, 0);
//         ctx.lineTo(width, 0);
//         ctx.lineTo(width, height);
//         ctx.lineTo(0, height);
//         ctx.lineTo(xMin, 0);
//         ctx.stroke();
//     }



//     getLayerAtPointer(domain, x, y) {

//         let idx = this.getIndex(x);
//         if (idx == -1) return null;

//         let minDiff = 99999999;
//         let closeLayer = null;
//         let i = -1;
//         if (domain == Domain.DomDepth) {

//             this.layers.forEach(layer => {
//                 i++;
//                 if (i > 0) {

//                     let diff = Math.abs(layer.point[idx].screenDepth - y);
//                     if (diff < 10 && diff < minDiff) {

//                         minDiff = diff;
//                         closeLayer = layer;
//                     }
//                 }
//             });
//         } else {

//             this.layers.forEach(layer => {

//                 i++;
//                 if (i > 0) {

//                     let diff = Math.abs(layer.point[idx].screenTime - y);
//                     if (diff < 10 && diff < minDiff) {

//                         minDiff = diff;
//                         closeLayer = layer;
//                     }
//                 }
//             });

//         }

//         return closeLayer;
//     }

//     getIndex(x) {
//         return this.findClosestIndex(this.xValues, x);
//     }

//     findClosestIndex(array, targetValue) {
//         let minDifference = Infinity;
//         let closestIndex = -1;

//         for (let i = 0; i < array.length; i++) {
//             const difference = Math.abs(array[i] - targetValue);

//             if (difference < minDifference) {
//                 minDifference = difference;
//                 closestIndex = i;
//             }
//         }

//         return closestIndex;
//     }

//     pointerTo(domain, y) {
//         if (domain == Domain.DomDepth)
//             return this.pointerToDepth(y);

//         else
//             return this.pointerToTime(y);
//     }

//     pointerToTime(y) {
//         var dZ = this.maxTime - this.minTime;
//         let h = this.canvasTime.height;
//         return dZ * y / h + this.minTime;
//     }

//     pointerToDepth(y) {
//         var dZ = this.maxDepth - this.minDepth;
//         let h = this.canvasDepth.height;
//         return dZ * y / h + this.minDepth;
//     }


// }


init();



function DeltaDepth(tA, tB, v0, k, tml) {
    return _mm2M * ((tB - tA) * (k * (tA + tB - 2.0 * tml) + v0)) / 2.0;
}

function TimeToDepth(dA, tA, tB, v0, k, tml) {
    return dA + DeltaDepth(tA, tB, v0, k, tml);
}


function DepthToTime(tA, dA, dB, v0, k, tml) {
    if (Math.abs(k) > MINKT) {
        dA *= _m2Mm;
        dB *= _m2Mm;
        var num = v0 - 2.0 * k * tml;
        var num2 = k * (2.0 * tml * tA - tA * tA) - v0 * tA + 2.0 * (dA - dB);
        return (0.0 - num + Math.sqrt(num * num - 4.0 * k * num2)) / (2.0 * k);
    }

    return tA + 2.0 * _s2Ms * (dB - dA) / v0;
}













function init() {
    window.requestAnimationFrame(draw);
    window.addEventListener('resize', resizeCanvas, false);

    uSection = new USection(LAYER_WIDTH);
    uSection.addLayer("Seawater", "lightblue", 1500, 0, 0.0);
    uSection.addLayer("Claystone", "pink", 2500, 0.02, 300.0);
    uSection.addLayer("SandstoneA", "lightyellow", 1500, 0.01, 1000.0);
    uSection.addLayer("Salt", "deepskyblue", 4500, 0.0, 1700.0);
    uSection.addLayer("SandstoneB", "yellow", 1500, 0.01, 2500.0);
    uSection.addLayer("Basement", "red", 3500, 0.01, 3500.0);

    uSection.setVerticalRange(Domain.DomDepth, -100.0, 5000.0);
    uSection.setVerticalRange(Domain.DomTime, -100.0, 4000.0);
    uSection.update_TimeFromDepth();


    let canvas = document.getElementById("canvasTime");
    canvas.addEventListener('mousedown', startEditTIME);
    canvas.addEventListener('mousemove', moveEditTIME);
    canvas.addEventListener('mouseup', endEdit);
    uSection.canvasTime = canvas;
    //canvas.addEventListener('mouseout', stopDrawing);


    //     .addEventListener("mousemove", function (event) {
    //     myFunctionTIME(event);
    // });
    canvas = document.getElementById("canvasDepth");
    canvas.addEventListener('mousedown', startEditDEPTH);
    canvas.addEventListener('mousemove', moveEditDEPTH);
    canvas.addEventListener('mouseup', endEdit);
    uSection.canvasDepth = canvas;
    // document.getElementById("canvasDepth")
    //     .addEventListener("mousemove", function (event) {
    //         myFunctionDEPTH(event);
    //     });



}


function draw() {

    //sectionTIME.draw();
    uSection.drawSection(Domain.DomTime, "canvasTime");
    uSection.drawSection(Domain.DomDepth, "canvasDepth");

    // movement??
    frame++;
    showOut();
    window.requestAnimationFrame(draw);
}


function resizeCanvas() {

}




function startEditTIME(e) {
    startEdit(Domain.DomTime, e);
}

function startEditDEPTH(e) {
    startEdit(Domain.DomDepth, e);
}

function moveEditTIME(e) {
    moveEdit(Domain.DomTime, e);
    showOut();
}

function moveEditDEPTH(e) {
    moveEdit(Domain.DomDepth, e);
    showOut();
}

function startEdit(domain, e) {
    let coord = uSection.handleXY(domain, e);
    mX = coord.x;
    mY = coord.y;

    pointerDomain = domain;
    editLayer = uSection.getLayerAtPointer(pointerDomain, mX, mY);
    let idx = uSection.getIndex(mX);
    prevIdx = idx;
    prevY = mY;
    if (editLayer != null) console.log("EDIT LAYER START:" + editLayer.name);
    else console.log("EDIT LAYER START: NULL");

}

function moveEdit(domain, e) {
    if (pointerDomain != domain) return;

    let coord = uSection.handleXY(pointerDomain, e);
    mX = coord.x;
    mY = coord.y;

    if (editLayer != null) {

        var layerA = uSection.layers[editLayer.index - 1];
        var layerB = (editLayer.index + 1) < uSection.layers.length ? uSection.layers[editLayer.index + 1] : null;
        let idx = uSection.getIndex(mX);
        if (idx != -1) {

            let ia = 0;
            let ib = 0;
            let ya = 0;
            let yb = 0;
            if (idx > prevIdx) {
                ia = prevIdx;
                ib = idx;
                ya = prevY;
                yb = mY;
            }
            else {
                ia = idx;
                ib = prevIdx;
                ya = mY;
                yb = prevY;
            }

            for (let i = ia; i <= ib; i++) {
                let y = (ib == ia) ? mY : ((yb - ya) * (i - ia) / (ib - ia) + ya);
                if (pointerDomain == Domain.DomTime) {
                    var minZ = layerA.point[i].time;
                    var maxZ = layerB != null ? layerB.point[i].time : 9999999999;
                    var z = uSection.pointerTo(pointerDomain, y);
                    if (z < minZ) z = minZ;
                    if (z > maxZ) z = maxZ;
                    editLayer.point[i].time = z;

                }
                else {
                    var minZ = layerA.point[i].depth;
                    var maxZ = layerB != null ? layerB.point[i].depth : 9999999999;
                    var z = uSection.pointerTo(pointerDomain, y);
                    if (z < minZ) z = minZ;
                    if (z > maxZ) z = maxZ;
                    editLayer.point[i].depth = z;
                }
            }

            prevIdx = idx;
            prevY = mY;
        }
        if (pointerDomain == Domain.DomTime)
            uSection.update_DepthFromTime();
        else
            uSection.update_TimeFromDepth();
    }
}

function endEdit(e) {
    pointerDomain = Domain.None;
    editLayer = null;
    prevIdx = -1;
    prevY = -999;
    console.log("EDIT LAYER END:");
}

function showOut() {
    var coor = "Coordinates: (" + mX + "," + mY + ") frame:" + frame
        + " layers:" + uSection.layers.length + " domain:" + pointerDomain;
    document.getElementById("demo").innerHTML = coor;
}

