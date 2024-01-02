export class ZLoc {
  constructor(time, depth) {
    this.time = time;
    this.depth = depth;
    this.screenTime = 0;
    this.screenDepth = 0;
  }
}

export const Domain = {
  DomTime: "Time",
  DomDepth: "Depth",
  None: "None",
};

const LEFT_SPACE = 80;
const CANVAS_H = 400;

const MINKT = 0.0001;
const _ms2S = 0.001;
const _mm2M = 0.001;
const _s2Ms = 1000.0;
const _m2Mm = 1000.0;

function DeltaDepth(tA, tB, v0, k, tml) {
  return (_mm2M * ((tB - tA) * (k * (tA + tB - 2.0 * tml) + v0))) / 2.0;
}

function TimeToDepth(dA, tA, tB, v0, k, tml) {
  return dA + DeltaDepth(tA, tB, v0, k, tml);
}

function VelocityAtTime(tB, v0, k, tml) {
  if (tB < 0) {
    return 343; // air
  }
  if (tB < tml) {
    // in water
    return 1500;
  }

  var tbml = tB - tml;
  return v0 + 2 * k * tbml;
}

function DepthToTime(tA, dA, dB, v0, k, tml) {
  if (Math.abs(k) > MINKT) {
    dA *= _m2Mm;
    dB *= _m2Mm;
    var num = v0 - 2.0 * k * tml;
    var num2 = k * (2.0 * tml * tA - tA * tA) - v0 * tA + 2.0 * (dA - dB);
    return (0.0 - num + Math.sqrt(num * num - 4.0 * k * num2)) / (2.0 * k);
  }
  return tA + (2.0 * _s2Ms * (dB - dA)) / v0;
}

export class Layer {
  constructor(name, color, v0, k, isContact, length, initDepth) {
    this.name = name;
    this.v0 = v0;
    this.k = k;
    this.isContact = isContact;
    this.contactControlDepth = initDepth;
    this.contactControlIndex = length / 2;
    this.color = color;
    this.active = false;
    this.visible = true;
    this.length = length;
    this.point = Array.from({ length }, (_) => new ZLoc(initDepth, initDepth));
    this.index = -1;
    this.velocityLayer = this;

    this.taper = new Array(1).fill(0.0);
  }

  setZ(domain, i, value) {
    if (domain == Domain.DomTime) {
      this.point[i].time = value;
    } else {
      this.point[i].depth = value;
    }
  }

  getZ(domain, i) {
    return domain == Domain.DomTime ? this.point[i].time : this.point[i].depth;
  }

  convertToScreenY(domain, height, minZ, maxZ) {
    let res = initializeFloatArray(this.length);
    for (let i = 0; i < this.length; i++) {
      var z = this.getZ(domain, i);
      var y = toScreenY(z, height, minZ, maxZ);
      if (domain == Domain.DomTime) this.point[i].screenTime = y;
      else this.point[i].screenDepth = y;
      res[i] = y;
    }

    return res;
  }

  setToConstant(domain, value) {
    for (let i = 0; i < this.length; i++) {
      this.setZ(domain, i, value);
    }
  }

  snapShot(domain) {
    const n = this.length;
    const z = new Array(n).fill(0.0);
    for (let i = 0; i < n; i++) z[i] = this.getZ(domain, i);
    return z;
  }

  calcTaper(taperW) {
    const fs = new Array(taperW).fill(0.0);
    const k = 8;
    const A0 = 1 / (1 + Math.exp(-k * (0 - 0.5)));
    const A1 = 1 / (1 + Math.exp(-k * (1 - 0.5)));
    const B0 = A1 - A0;
    for (let i = 0; i < taperW; i++) {
      var t = i / (taperW - 1);
      var A = 1 / (1 + Math.exp(-k * (t - 0.5)));
      var B = A1 - A;
      var C = 1 - B / B0;
      fs[i] = C;
    }
    return fs;
  }

  overwriteRange(domain, inputZ, i0, i1, taperW) {
    if (this.taper.length != taperW) this.taper = this.calcTaper(taperW);

    // values in edit range
    for (let i = i0; i <= i1; i++) this.setZ(domain, i, inputZ[i]);

    // tapering
    for (let i = 1; i < taperW; i++) {
      var f = this.taper[i];
      var ia = i1 + i;
      if (ia < this.length)
        this.setZ(domain, ia, f * this.getZ(domain, ia) + (1 - f) * inputZ[ia]);

      ia = i0 - i;
      if (ia >= 0)
        this.setZ(domain, ia, f * this.getZ(domain, ia) + (1 - f) * inputZ[ia]);
    }
  }

  overwrite(domain, inputZ) {
    for (let i = 0; i < this.length; i++) this.setZ(domain, i, inputZ[i]);
  }
}

export class USection {
  constructor(length) {
    this.layers = []; // Initialize an empty array
    this.minDepth = -100.0;
    this.maxDepth = 4000.0;
    this.minTime = -100.0;
    this.maxTime = 4000.0;
    this.xValues = new Array(length).fill(0.0);
    this.canvasDepth = null;
    this.canvasTime = null;
    this.length = length;

    this.x0 = LEFT_SPACE;
    this.y0 = 0;

    this.quik_layer = null;

    this.pointerIndex = -1;
    this.pointerDepth = NaN;
    this.pointerTime = NaN;
    this.pointerVelocity = NaN;
    this.pointerDomain = Domain.None;
  }

  addLayer(name, color, v0, k, isContact, initDepth) {
    var newLayer = new Layer(
      name,
      color,
      v0,
      k,
      isContact,
      this.length,
      initDepth
    );
    newLayer.index = this.layers.length;
    this.layers.push(newLayer);
  }

  setVerticalRange(domain, min, max) {
    if (domain == Domain.DomDepth) {
      this.minDepth = min;
      this.maxDepth = max;
    } else if (domain == Domain.DomTime) {
      this.minTime = min;
      this.maxTime = max;
    }
  }

  setLayerVisible(layerName, viz) {
    this.layers.forEach((layer) => {
      if (layer.name == layerName) {
        layer.visible = viz;
        console.log(layer.name + " : " + viz);
        return;
      }
    });
  }

  get visibleLayers() {
    return this.layers.filter((item) => item.visible === true);
  }

  get visibleRegularLayers() {
    return this.layers.filter(
      (item) => item.visible === true && item.isContact == false
    );
  }
  get visibleContactLayers() {
    return this.layers.filter(
      (item) => item.visible === true && item.isContact == true
    );
  }

  getVisibleRegularLayerAbove(layer) {
    if (layer == null) return null;
    var idx = this.layers.indexOf(layer);
    if (idx == -1) return null;

    for (let i = idx - 1; i >= 0; i--) {
      if (this.layers[i].isContact == false && this.layers[i].visible)
        return this.layers[i];
    }
    return null;
  }

  getVisibleRegularLayerBelow(layer) {
    if (layer == null) return null;
    var idx = this.layers.indexOf(layer);
    if (idx == -1) return null;
    for (let i = idx + 1; i < this.layers.length; i++) {
      if (this.layers[i].isContact == false && this.layers[i].visible)
        return this.layers[i];
    }
    return null;
  }

  getVisibleLayerAbove(layer) {
    if (layer == null) return null;
    var idx = this.layers.indexOf(layer);
    if (idx == -1) return null;

    for (let i = idx - 1; i >= 0; i--) {
      if (this.layers[i].visible) return this.layers[i];
    }
    return null;
  }

  getVisibleLayerBelow(layer) {
    if (layer == null) return null;
    var idx = this.layers.indexOf(layer);
    if (idx == -1) return null;
    for (let i = idx + 1; i < this.layers.length; i++) {
      if (this.layers[i].visible) return this.layers[i];
    }
    return null;
  }

  adjustContactDepth(editLayer, rZ, idx, restrictBelow) {
    editLayer.contactControlDepth = rZ;
    editLayer.contactControlIndex = idx;

    //console.log("moveContact: " + editLayer.name + " : " + rZ + " " + idx);
    let layerA = this.getVisibleLayerAbove(editLayer);
    let layerB = this.getVisibleLayerBelow(editLayer);

    // depth limit contact
    for (let i = 0; i < editLayer.length; i++) {
      var minZ = layerA.point[i].depth;
      var maxZ = layerB != null ? layerB.point[i].depth : 9999999999;
      editLayer.point[i].depth = clamp(rZ, minZ, maxZ);
    }

    layerA = this.getVisibleRegularLayerAbove(editLayer);
    layerB = this.getVisibleRegularLayerBelow(editLayer);
    for (let i = 0; i < editLayer.length; i++) {
      var minZ = layerA.point[i].depth;
      var maxZ =
        restrictBelow && layerB != null ? layerB.point[i].depth : 9999999999;
      editLayer.point[i].depth = clamp(editLayer.point[i].depth, minZ, maxZ);
    }

    // then restrict compartment? [option?]
    var restrictCompartment = false;
    if (restrictCompartment) {
      layerA = this.getVisibleRegularLayerAbove(editLayer);
      if (editLayer.point[idx].depth > layerA.point[idx].depth) {
        // find extent
        var compartmentIdxA = 0;
        for (let i = idx; i >= 0; i--) {
          if (editLayer.point[i].depth <= layerA.point[i].depth) {
            compartmentIdxA = i;
            break;
          }
        }

        var compartmentIdxB = editLayer.length - 1;
        for (let i = idx; i < editLayer.length; i++) {
          if (editLayer.point[i].depth <= layerA.point[i].depth) {
            compartmentIdxB = i;
            break;
          }
        }

        for (let i = 0; i < editLayer.length; i++) {
          if (i < compartmentIdxA || i > compartmentIdxB)
            editLayer.point[i].depth = layerA.point[i].depth;
        }
      }
    }
  }

  flattenContacts() {
    this.layers.forEach((layer) => {
      if (layer.isContact && layer.visible) {
        this.adjustContactDepth(
          layer,
          layer.contactControlDepth,
          layer.contactControlIndex,
          true
        );
      }
    });
  }

  update_From(domain) {
    if (domain == Domain.DomDepth) this.update_TimeFromDepth(null);
    else this.update_DepthFromTime(null);
  }

  debug(title) {
    console.log(title);
    for (let j = 0; j < this.visibleLayers.length; j++) {
      let layer = this.visibleLayers[j];

      console.log(
        layer.name + " " + layer.point[0].time + ", " + layer.point[0].depth
      );
    }
  }

  update_TimeFromDepth(finalLayer) {
    this.setupVelocityLayers();
    // ensure contacts increasing
    for (let i = 1; i < this.visibleContactLayers.length; i++) {
      var cntA = this.visibleContactLayers[i - 1];
      var cntB = this.visibleContactLayers[i];
      if (cntB.contactControlDepth <= cntA.contactControlDepth)
        cntB.contactControlDepth = cntA.contactControlDepth + 50;
    }

    // water at zero always
    let waterLayer = this.layers[0];
    let mudlineLayer = this.layers[1];

    for (let i = 0; i < this.length; i++) {
      waterLayer.point[i].depth = Math.min(mudlineLayer.point[i].depth, 0.0);
    }
    waterLayer.setToConstant(Domain.DomTime, 0);
    // top layer with simple water velocity
    let v0 = waterLayer.v0;
    for (let i = 0; i < this.length; i++) {
      if (mudlineLayer.point[i].depth > 0)
        // mudline: seawater velocity
        mudlineLayer.point[i].time = (mudlineLayer.point[i].depth * 2000) / v0;
      else mudlineLayer.point[i].time = 0.0; // it's at surface, elevated
    }
    // the rest..
    for (let j = 2; j < this.visibleLayers.length; j++) {
      let layerA = this.visibleLayers[j - 1];
      let layerB = this.visibleLayers[j];

      for (let i = 0; i < this.length; i++) {
        let ptA = layerA.point[i];
        let ptB = layerB.point[i];
        let ptML = mudlineLayer.point[i];
        ptB.time = DepthToTime(
          ptA.time,
          ptA.depth,
          ptB.depth,
          layerA.velocityLayer.v0,
          layerA.velocityLayer.k,
          ptML.time
        );
      }

      if (finalLayer == layerB) return;
    }
  }

  update_DepthFromTime(finalLayer) {
    this.setupVelocityLayers();

    // water at zero always
    let waterLayer = this.layers[0];
    waterLayer.setToConstant(Domain.DomDepth, 0);
    waterLayer.setToConstant(Domain.DomTime, 0);

    // top layer with simple water velocity
    let v0 = waterLayer.v0;
    let mudlineLayer = this.layers[1];
    for (let i = 0; i < this.length; i++) {
      mudlineLayer.point[i].depth = (v0 * mudlineLayer.point[i].time) / 2000;
    }

    // the rest..
    for (let j = 2; j < this.visibleLayers.length; j++) {
      let layerA = this.visibleLayers[j - 1];
      let layerB = this.visibleLayers[j];

      for (let i = 0; i < this.length; i++) {
        let ptA = layerA.point[i];
        let ptB = layerB.point[i];
        let ptML = mudlineLayer.point[i];
        ptB.depth = TimeToDepth(
          ptA.depth,
          ptA.time,
          ptB.time,
          layerA.velocityLayer.v0,
          layerA.velocityLayer.k,
          ptML.time
        );
      }

      if (finalLayer == layerB) return;
    }
  }

  setupVelocityLayers() {
    var vizLayers = this.visibleLayers;

    // stage1: set to self
    vizLayers.forEach((layer) => {
      layer.velocityLayer = layer;
    });

    // stage 2: find contacts, and swap *velocity* with layer above
    for (let i = 1; i < vizLayers.length; i++) {
      let layerA = vizLayers[i - 1];
      let layerB = vizLayers[i];
      if (layerB.isContact) {
        var c = layerA.velocityLayer;
        layerA.velocityLayer = layerB.velocityLayer;
        layerB.velocityLayer = c;
      }
    }
  }

  setupQuickTimeToDepth(layer) {
    this.quik_layer = this.getVisibleLayerAbove(layer);
  }

  quickConvert(t1, idx) {
    var d1 = TimeToDepth(
      this.quik_layer.point[idx].depth,
      this.quik_layer.point[idx].time,
      t1,
      this.quik_layer.velocityLayer.v0,
      this.quik_layer.velocityLayer.k,
      this.layers[1].point[idx].time
    );
    return d1;
  }

  convertDepthToTime(depth, idx) {
    // get the layer pointer is in
    if (idx < 0) return NaN;
    if (idx >= this.length) return NaN;
    var vizLayers = this.visibleLayers;
    let mudlineLayer = this.layers[1];
    for (let i = vizLayers.length - 1; i >= 0; i--) {
      var layerA = vizLayers[i];
      if (depth >= layerA.point[idx].depth) {
        // therefore tA, dA above pointer
        var tA = layerA.point[idx].time;
        var dA = layerA.point[idx].depth;
        let ptML = mudlineLayer.point[idx];
        // therefore time
        var time = DepthToTime(
          tA,
          dA,
          depth,
          layerA.velocityLayer.v0,
          layerA.velocityLayer.k,
          ptML.time
        );
        return time;
      }
    }

    return NaN;
  }

  convertTimeToDepth(time, idx) {
    // get the layer pointer is in
    if (idx < 0) return NaN;
    if (idx >= this.length) return NaN;
    var vizLayers = this.visibleLayers;
    let mudlineLayer = this.layers[1];
    for (let i = vizLayers.length - 1; i >= 0; i--) {
      var layerA = vizLayers[i];
      if (time >= layerA.point[idx].time) {
        // therefore tA, dA above pointer
        var tA = layerA.point[idx].time;
        var dA = layerA.point[idx].depth;
        let ptML = mudlineLayer.point[idx];
        // therefore depth
        var depth = TimeToDepth(
          dA,
          tA,
          time,
          layerA.velocityLayer.v0,
          layerA.velocityLayer.k,
          ptML.time
        );
        return depth;
      }
    }

    return NaN;
  }

  getVelocityAtTime(time, idx) {
    // get the layer pointer is in
    if (idx < 0) return NaN;
    if (idx >= this.length) return NaN;
    var vizLayers = this.visibleLayers;
    let mudlineLayer = this.layers[1];

    for (let i = vizLayers.length - 1; i >= 0; i--) {
      var layerA = vizLayers[i];
      if (time >= layerA.point[idx].time) {
        let ptML = mudlineLayer.point[idx];
        // therefore velocity
        return VelocityAtTime(
          time,
          layerA.velocityLayer.v0,
          layerA.velocityLayer.k,
          ptML.time
        );
      }
    }

    return NaN;
  }

  setCursor(t, d, v, i) {
    if (i < 0) i = -1;
    if (i >= this.length) i = -1;

    if (i != -1) {
      this.pointerTime = t;
      this.pointerDepth = d;
      this.pointerIndex = i;
      this.pointerVelocity = v;
    } else {
      this.pointerTime = NaN;
      this.pointerDepth = NaN;
      this.pointerIndex = i;
      this.pointerVelocity = NaN;
    }
  }

  drawSection(domain, name) {
    var canvas = document.getElementById(name);
    var context = canvas.getContext("2d");
    canvas.height = CANVAS_H;
    canvas.width = window.innerWidth;
    context.clearRect(0, 0, window.innerWidth, CANVAS_H);
    context.save();

    var w = canvas.width - this.x0;
    var h = canvas.height;
    // get the vertical range for this domain
    var minZ = 0;
    var maxZ = 100;
    if (domain == Domain.DomDepth) {
      minZ = this.minDepth;
      maxZ = this.maxDepth;
    } else if (domain == Domain.DomTime) {
      minZ = this.minTime;
      maxZ = this.maxTime;
    }

    // draw, fill layers
    for (let i = 0; i < this.length; i++) {
      let x = this.toScreenX(i, w);
      this.xValues[i] = x;
    }

    // layers
    this.visibleLayers.forEach((layer) => {
      layer.yValues = layer.convertToScreenY(domain, h, minZ, maxZ);
      this.plotSurface(
        context,
        this.xValues,
        layer.yValues,
        "dimgray",
        layer.velocityLayer.color,
        false,
        true
      );
    });

    this.visibleLayers.forEach((layer) => {
      this.plotSurface(
        context,
        this.xValues,
        layer.yValues,
        "dimgray",
        layer.velocityLayer.color,
        true,
        false
      );
    });

    // cursor
    if (this.pointerIndex != -1 && this.pointerDomain != domain) {
      if (domain == Domain.DomTime) {
        var sy = toScreenY(this.pointerTime, h, minZ, maxZ);
        var sx = this.toScreenX(this.pointerIndex, w);
      } else {
        var sy = toScreenY(this.pointerDepth, h, minZ, maxZ);
        var sx = this.toScreenX(this.pointerIndex, w);
      }

      context.beginPath();
      context.strokeStyle = "rgba(255,0,0, 1)";
      context.lineWidth = 1;
      context.moveTo(sx + 10, sy);
      context.lineTo(sx - 10, sy);
      context.stroke();
      context.moveTo(sx, sy - 10);
      context.lineTo(sx, sy + 10);
      context.stroke();
    }

    // labels
    context.font = "12px exo";
    context.textAlign = "right";
    context.textBaseline = "middle";
    context.fillStyle = "black";

    var n = this.visibleRegularLayers.length;
    for (let index = 0; index < n; index++) {
      const layerA = this.visibleRegularLayers[index];
      const aY = layerA.yValues[0];
      const bY =
        index + 1 < n ? this.visibleRegularLayers[index + 1].yValues[0] : h;
      context.fillText(layerA.name, this.x0 - 5, (aY + bY) / 2);
    }

    this.drawFrame(context, w, h);
  }

  drawFrame(ctx, w, h) {
    ctx.beginPath();
    ctx.strokeStyle = "rgb(128,128,128)";
    ctx.lineWidth = 2;
    ctx.moveTo(this.x0, this.y0);
    ctx.lineTo(this.x0 + w, this.y0);
    ctx.lineTo(this.x0 + w, this.y0 + h);
    ctx.lineTo(this.x0, this.y0 + h);
    ctx.lineTo(this.x0, this.y0);
    ctx.stroke();
  }

  handleXY(domain, e) {
    let canvas = domain == Domain.DomTime ? this.canvasTime : this.canvasDepth;
    const rect = canvas.getBoundingClientRect();
    var scaleX = canvas.width / rect.width;
    var scaleY = canvas.height / rect.height;

    var mouseX = (e.clientX - rect.left) * scaleX;
    var mouseY = (e.clientY - rect.top) * scaleY;

    return { x: mouseX, y: mouseY };
  }

  plotSurface(ctx, xValues, yValues, style, fillColor, showLine, showFill) {
    var height = ctx.canvas.height;

    // fill
    if (showFill) {
      ctx.beginPath();
      ctx.fillStyle = fillColor || "red"; // Default to red if fillColor is not provided
      for (var i = 0; i < xValues.length; i++) {
        var x = xValues[i];
        var y = yValues[i];

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.lineTo(x, height);
      ctx.lineTo(xValues[0], height);
      ctx.fill();
    }

    if (showLine) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = style;
      ctx.beginPath();
      for (var i = 0; i < xValues.length; i++) {
        var x = xValues[i];
        var y = yValues[i];

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.stroke();
    }
  }

  getLayerAtPointer(domain, x, y) {
    let idx = this.getIndex(x);
    if (idx == -1) return null;
    let minDiff = 99999999;
    let closeLayer = null;
    let i = -1;
    if (domain == Domain.DomDepth) {
      this.visibleLayers.forEach((layer) => {
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
      this.visibleLayers.forEach((layer) => {
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
    if (x < this.xValues[0] - 2) return -1;
    if (x > this.xValues[this.xValues.length - 1] + 2) return -1;
    return findClosestIndex(this.xValues, x);
  }

  pointerTo(domain, y) {
    if (domain == Domain.DomDepth) return this.pointerToDepth(y);
    else return this.pointerToTime(y);
  }

  pointerToTime(y) {
    var dZ = this.maxTime - this.minTime;
    let h = this.canvasTime.height;
    return (dZ * y) / h + this.minTime;
  }

  pointerToDepth(y) {
    var dZ = this.maxDepth - this.minDepth;
    let h = this.canvasDepth.height;
    return (dZ * y) / h + this.minDepth;
  }

  toScreenX(i, width) {
    return this.x0 + (width * i) / (this.length - 1);
  }

  toX(sx, width) {
    return Math.round(((sx - this.x0) * (this.length - 1)) / width);
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

function clamp(v, minv, maxv) {
  if (v < minv) return minv;
  if (v > maxv) return maxv;
  return v;
}

function toScreenY(z, height, minZ, maxZ) {
  return height * ((z - minZ) / (maxZ - minZ));
}
