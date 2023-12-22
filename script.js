
const Domain = {
    DomTime: 'DomTime',
    DomDepth: 'DomDepth',
    None: 'None',
    Any: 'Any'
};

function drawFrame(ctx) {
    var width = ctx.canvas.width;
    var height = ctx.canvas.height;
    var xMin = 0;

    ctx.beginPath();
    ctx.strokeStyle = "rgb(128,128,128)";
    ctx.lineWidth = 2;
    ctx.moveTo(xMin, 0);
    ctx.lineTo(width, 0);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.lineTo(xMin, 0);
    ctx.stroke();
}


function plotSurface(ctx, xValues, yValues, style, fillColor) {

    var height = ctx.canvas.height;

    // fill
    ctx.beginPath();
    ctx.fillStyle = fillColor || 'red'; // Default to red if fillColor is not provided
    ctx.lineWidth = 2;
    ctx.strokeStyle = style;
    for (var i = 0; i < xValues.length; i++) {
        var x = xValues[i];
        var y = yValues[i];

        if (i === 0)
            ctx.moveTo(x, y);
        else
            ctx.lineTo(x, y);
    }

    ctx.lineTo(x, height);
    ctx.lineTo(xValues[0], height);
    ctx.fill();

    ctx.beginPath();
    for (var i = 0; i < xValues.length; i++) {
        var x = xValues[i];
        var y = yValues[i];

        if (i === 0)
            ctx.moveTo(x, y);
        else
            ctx.lineTo(x, y);
    }

    ctx.stroke();
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

var mX = 0, mY = 0;
var frame = 0;
var layerCount = 0;
var pointerDomain = Domain.None;
var editLayer;
var prevIdx = -1;
var prevY = -999;
var uSection;



function startEditTIME(e) {
    let coord = uSection.handleXY(Domain.DomTime, e);
    mX = coord.x;
    mY = coord.y;

    pointerDomain = Domain.DomTime;
    editLayer = uSection.getLayerAtPointer(pointerDomain, mX, mY);
    let idx = uSection.getIndex(mX);
    prevIdx = idx;
    prevY = mY;
    if (editLayer != null) console.log("EDIT LAYER START:" + editLayer.name);
    else console.log("EDIT LAYER START: NULL");
}

function moveEditTIME(e) {
    let coord = uSection.handleXY(Domain.DomTime, e);
    mX = coord.x;
    mY = coord.y;

    if (pointerDomain != Domain.DomTime) return;

    moveEdit();

    showOut();
}

function moveEdit() {
    if (editLayer != null ) {

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
                editLayer.point[i].time = uSection.pointerTo(pointerDomain, y);
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

function endEditTIME(e) {
    pointerDomain = Domain.None;
    editLayer = null;
    prevIdx = -1;
    prevY = -999;
    console.log("EDIT LAYER END:");
}


function startEditDEPTH(e) {
    let coord = uSection.handleXY(Domain.DomDepth, e);
    mX = coord.x;
    mY = coord.y;

    pointerDomain = Domain.DomDepth;

    editLayer = uSection.getLayerAtPointer(pointerDomain, mX, mY);
    if (editLayer != null) console.log("EDIT LAYER START:" + editLayer.name);
    else console.log("EDIT LAYER START: NULL");
}

function moveEditDEPTH(e) {

    let coord = uSection.handleXY(Domain.DomDepth, e);
    mX = coord.x;
    mY = coord.y;

    if (pointerDomain != Domain.DomDepth) return;

    moveEdit();

    showOut();
}

function endEditDEPTH(e) {
    pointerDomain = Domain.None;
    editLayer = null;
    prevIdx = -1;
    prevY = -999;
    console.log("EDIT LAYER END:");
}


function showOut() {
    var coor = "Coordinates: (" + mX + "," + mY + ") frame:" + frame
        + " layers:" + layerCount + " domain:" + pointerDomain;
    document.getElementById("demo").innerHTML = coor;
}





function init() {
    window.requestAnimationFrame(draw);
    window.addEventListener('resize', resizeCanvas, false);

    uSection = new USection();
    uSection.addLayer("Seawater", "lightblue", 1500, 0, 0.0);
    uSection.addLayer("Claystone", "pink", 2500, 0.02, 300.0);
    uSection.addLayer("SandstoneA", "lightyellow", 1500, 0.01, 1000.0);
    uSection.addLayer("Salt", "deepskyblue", 4500, 0.0, 1700.0);
    uSection.addLayer("SandstoneB", "yellow", 1500, 0.01, 2500.0);
    uSection.addLayer("Basement", "red", 3500, 0.03, 3500.0);

    uSection.setVerticalRange(Domain.DomDepth, -100.0, 7000.0);
    uSection.setVerticalRange(Domain.DomTime, -100.0, 4000.0);
    uSection.update_TimeFromDepth();


    let canvas = document.getElementById("canvasTime");
    canvas.addEventListener('mousedown', startEditTIME);
    canvas.addEventListener('mousemove', moveEditTIME);
    canvas.addEventListener('mouseup', endEditTIME);
    uSection.canvasTime = canvas;
    //canvas.addEventListener('mouseout', stopDrawing);


    //     .addEventListener("mousemove", function (event) {
    //     myFunctionTIME(event);
    // });
    canvas = document.getElementById("canvasDepth");
    canvas.addEventListener('mousedown', startEditDEPTH);
    canvas.addEventListener('mousemove', moveEditDEPTH);
    canvas.addEventListener('mouseup', endEditDEPTH);
    uSection.canvasDepth = canvas;
    // document.getElementById("canvasDepth")
    //     .addEventListener("mousemove", function (event) {
    //         myFunctionDEPTH(event);
    //     });



}



var LAYER_WIDTH = 100;

class USection {

    constructor() {
        this.layers = []; // Initialize an empty array
        this.minDepth = -100.0;
        this.maxDepth = 4000.0;
        this.minTime = -100.0;
        this.maxTime = 4000.0;
        this.xValues = initializeFloatArray(LAYER_WIDTH);
        this.canvasDepth = null;
        this.canvasTime = null;
    }

    addLayer(name, color, v0, k, initDepth) {
        var newLayer = new Layer(name, color, v0, k, LAYER_WIDTH, initDepth);
        this.layers.push(newLayer);
    }

    setVerticalRange(domain, min, max) {
        if (domain == Domain.DomDepth) {
            this.minDepth = min;
            this.maxDepth = max;
        }
        else if (domain == Domain.DomTime) {
            this.minTime = min;
            this.maxTime = max;
        }
    }

    update_TimeFromDepth() {
        // water at zero always
        let waterLayer = this.layers[0];
        waterLayer.setToConstant(Domain.DomDepth, 0);
        waterLayer.setToConstant(Domain.DomTime, 0);

        // top layer with simple water velocity
        let v0 = waterLayer.v0;
        let mudlineLayer = this.layers[1];
        for (let i = 0; i < LAYER_WIDTH; i++) {
            mudlineLayer.point[i].time =
                mudlineLayer.point[i].depth * 2000 / v0;
        }


        // the rest..
        for (let j = 2; j < this.layers.length; j++) {
            let layerA = this.layers[j - 1];
            let layerB = this.layers[j];

            for (let i = 0; i < LAYER_WIDTH; i++) {
                let ptA = layerA.point[i];
                let ptB = layerB.point[i];
                let ptML = mudlineLayer.point[i];
                ptB.time = DepthToTime(ptA.time, ptA.depth, ptB.depth, layerA.v0, layerA.k, ptML.time);
            }
        }
    }

    update_DepthFromTime() {

        // water at zero always
        let waterLayer = this.layers[0];
        waterLayer.setToConstant(Domain.DomDepth, 0);
        waterLayer.setToConstant(Domain.DomTime, 0);

        // top layer with simple water velocity
        let v0 = waterLayer.v0;
        let mudlineLayer = this.layers[1];
        for (let i = 0; i < LAYER_WIDTH; i++) {
            mudlineLayer.point[i].depth = v0 * mudlineLayer.point[i].time / 2000;
        }

        // the rest..
        for (let j = 2; j < this.layers.length; j++) {
            let layerA = this.layers[j - 1];
            let layerB = this.layers[j];

            for (let i = 0; i < LAYER_WIDTH; i++) {
                let ptA = layerA.point[i];
                let ptB = layerB.point[i];
                let ptML = mudlineLayer.point[i];
                ptB.depth = TimeToDepth(ptA.depth, ptA.time, ptB.time, layerA.v0, layerA.k, ptML.time);
            }

        }
    }

    drawSection(domain, name) {

        var canvas = document.getElementById(name);
        var context = canvas.getContext("2d");
        canvas.width = window.innerWidth - 20;
        canvas.height = 200;
        var w = canvas.width;
        var h = canvas.height;
        context.clearRect(0, 0, w, h);
        context.save();

        // get the vertical range for this domain
        var minZ = 0;
        var maxZ = 100;
        if (domain == Domain.DomDepth) {
            minZ = this.minDepth;
            maxZ = this.maxDepth;
        }
        else if (domain == Domain.DomTime) {
            minZ = this.minTime;
            maxZ = this.maxTime;
        }

        // draw, fill layers
        for (let i = 0; i < LAYER_WIDTH; i++) {

            let x = w * i / (LAYER_WIDTH - 1);
            this.xValues[i] = x;
        }

        layerCount = 0;
        this.layers.forEach(layer => {
            layerCount++;
            var yValues = layer.convertToScreenY(domain, h, minZ, maxZ);
            //console.log(layer.name + " t:" + layer.point[0].time + " d:" + layer.point[0].depth);
            plotSurface(context, this.xValues, yValues, 'dimgray', layer.color);
        });

        drawFrame(context);
    }

    handleXY(domain, e) {
        let canvas = domain == Domain.DomTime ? this.canvasTime : this.canvasDepth;
        const rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }


    getLayerAtPointer(domain, x, y) {

        let idx = this.getIndex(x);
        if (idx == -1) return null;

        let minDiff = 99999999;
        let closeLayer = null;
        if (domain == Domain.DomDepth) {

            this.layers.forEach(layer => {

                let diff = Math.abs(layer.point[idx].screenDepth - y);
                if (diff < 10 && diff < minDiff) {

                    minDiff = diff;
                    closeLayer = layer;
                }
            });
        } else {

            this.layers.forEach(layer => {

                let diff = Math.abs(layer.point[idx].screenTime - y);
                if (diff < 10 && diff < minDiff) {

                    minDiff = diff;
                    closeLayer = layer;
                }
            });

        }

        return closeLayer;
    }

    getIndex(x) {
        return findClosestIndex(this.xValues, x);
    }

    pointerTo(domain, y) {
        if (domain == Domain.DomDepth)
            return this.pointerToDepth(y);
        else
            return this.pointerToTime(y);
    }

    pointerToTime(y) {
        var dZ = this.maxTime - this.minTime;
        let h = this.canvasTime.height;
        return dZ * y / h + this.minTime;
    }

    pointerToDepth(y) {
        var dZ = this.maxDepth - this.minDepth;
        let h = this.canvasDepth.height;
        return dZ * y / h + this.minDepth;
    }



}

function initializeFloatArray(n) {
    return new Array(n).fill(0.0);
}

function findClosestIndex(array, targetValue) {
    let minDifference = Infinity;
    let closestIndex = -1;

    for (let i = 0; i < array.length; i++) {
        const difference = Math.abs(array[i] - targetValue);

        if (difference < minDifference) {
            minDifference = difference;
            closestIndex = i;
        }
    }

    return closestIndex;
}


const MINKT = 0.0001;
const _ms2S = 0.001;
const _mm2M = 0.001;
const _s2Ms = 1000.0;
const _m2Mm = 1000.0;
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







class Layer {


    constructor(name, color, v0, k, length, initDepth) {
        this.name = name;
        this.v0 = v0;
        this.k = k;
        this.isContact = false;
        this.color = color;
        this.active = false;
        this.length = length;
        this.point = Array.from({ length }, (_) => new ZLoc(initDepth, initDepth));


    }


    convertToScreenY(domain, height, minZ, maxZ) {

        let res = initializeFloatArray(LAYER_WIDTH);
        var dZ = maxZ - minZ;

        if (domain == Domain.DomTime) {
            for (let i = 0; i < LAYER_WIDTH; i++) {
                var z = this.point[i].time;
                var y = height * ((z - minZ) / dZ);
                this.point[i].screenTime = y;
                res[i] = y;
            }
        }
        else {
            for (let i = 0; i < LAYER_WIDTH; i++) {
                var z = this.point[i].depth;
                var y = height * ((z - minZ) / dZ);
                this.point[i].screenDepth = y;
                res[i] = y;
            }

        }

        return res;
    }



    setToConstant(domain, value) {
        if (domain == Domain.DomDepth) {
            for (let i = 0; i < LAYER_WIDTH; i++) {
                this.point[i].depth = value;
            }
        }
        else {
            for (let i = 0; i < LAYER_WIDTH; i++) {
                this.point[i].time = value;
            }
        }
    }
}

class ZLoc {
    constructor(time, depth) {
        this.time = time;
        this.depth = depth;
        this.screenTime = 0;
        this.screenDepth = 0;
    }

}



