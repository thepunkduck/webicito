export class ZLoc {
    constructor(time, depth) {
        this.time = time;
        this.depth = depth;
        this.screenTime = 0;
        this.screenDepth = 0;
    }


}

export const Domain = {
    DomTime: 'DomTime',
    DomDepth: 'DomDepth',
    None: 'None',
    Any: 'Any'
};

export class Layer {


    constructor(name, color, v0, k, length, initDepth) {
        this.name = name;
        this.v0 = v0;
        this.k = k;
        this.isContact = false;
        this.color = color;
        this.active = false;
        this.length = length;
        this.point = Array.from({ length }, (_) => new ZLoc(initDepth, initDepth));
        this.index = -1;

    }


    convertToScreenY(domain, height, minZ, maxZ) {

        let res = initializeFloatArray(this.length);
        var dZ = maxZ - minZ;

        if (domain == Domain.DomTime) {
            for (let i = 0; i < this.length; i++) {
                var z = this.point[i].time;
                var y = height * ((z - minZ) / dZ);
                this.point[i].screenTime = y;
                res[i] = y;
            }
        }
        else {
            for (let i = 0; i < this.length; i++) {
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
            for (let i = 0; i < this.length; i++) {
                this.point[i].depth = value;
            }
        }
        else {
            for (let i = 0; i < this.length; i++) {
                this.point[i].time = value;
            }
        }
    }
}




export class USection {

    constructor(width) {
        this.layers = []; // Initialize an empty array
        this.minDepth = -100.0;
        this.maxDepth = 4000.0;
        this.minTime = -100.0;
        this.maxTime = 4000.0;
        this.xValues = new Array(width).fill(0.0);
        this.canvasDepth = null;
        this.canvasTime = null;
        this.width = width;
    }

    addLayer(name, color, v0, k, initDepth) {
        var newLayer = new Layer(name, color, v0, k, this.width, initDepth);
        newLayer.index = this.layers.length;
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
        for (let i = 0; i < this.width; i++) {
            mudlineLayer.point[i].time =
                mudlineLayer.point[i].depth * 2000 / v0;
        }


        // the rest..
        for (let j = 2; j < this.layers.length; j++) {
            let layerA = this.layers[j - 1];
            let layerB = this.layers[j];

            for (let i = 0; i < this.width; i++) {
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
        for (let i = 0; i < this.width; i++) {
            mudlineLayer.point[i].depth = v0 * mudlineLayer.point[i].time / 2000;
        }

        // the rest..
        for (let j = 2; j < this.layers.length; j++) {
            let layerA = this.layers[j - 1];
            let layerB = this.layers[j];

            for (let i = 0; i < this.width; i++) {
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
        for (let i = 0; i < this.width; i++) {

            let x = w * i / (this.width - 1);
            this.xValues[i] = x;
        }


        this.layers.forEach(layer => {
            var yValues = layer.convertToScreenY(domain, h, minZ, maxZ);
            //console.log(layer.name + " t:" + layer.point[0].time + " d:" + layer.point[0].depth);
            this.plotSurface(context, this.xValues, yValues, 'dimgray', layer.color);
        });

        this.drawFrame(context);
    }

    handleXY(domain, e) {
        let canvas = domain == Domain.DomTime ? this.canvasTime : this.canvasDepth;
        const rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }


    plotSurface(ctx, xValues, yValues, style, fillColor) {

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

    drawFrame(ctx) {
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



    getLayerAtPointer(domain, x, y) {

        let idx = this.getIndex(x);
        if (idx == -1) return null;

        let minDiff = 99999999;
        let closeLayer = null;
        let i = -1;
        if (domain == Domain.DomDepth) {

            this.layers.forEach(layer => {
                i++;
                if (i > 0) {

                    let diff = Math.abs(layer.point[idx].screenDepth - y);
                    if (diff < 10 && diff < minDiff) {

                        minDiff = diff;
                        closeLayer = layer;
                    }
                }
            });
        } else {

            this.layers.forEach(layer => {

                i++;
                if (i > 0) {

                    let diff = Math.abs(layer.point[idx].screenTime - y);
                    if (diff < 10 && diff < minDiff) {

                        minDiff = diff;
                        closeLayer = layer;
                    }
                }
            });

        }

        return closeLayer;
    }

    getIndex(x) {
        return this.findClosestIndex(this.xValues, x);
    }

    findClosestIndex(array, targetValue) {
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
