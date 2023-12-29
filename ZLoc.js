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
  Any: "Any",
};

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
    } else {
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
    } else {
      for (let i = 0; i < this.length; i++) {
        this.point[i].time = value;
      }
    }
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

    this.x0 = 100;
    this.y0 = 0;

    this.quik_d0 = 0;
    this.quik_t0 = 0;
    this.quik_tml = 0;
    this.quik_v0 = 0;
    this.quik_k = 0;
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

  moveContact(editLayer, rZ, idx, restrictBelow) {
    editLayer.contactControlDepth = rZ;
    editLayer.contactControlIndex = idx;

    console.log("moveContact: " + editLayer.name + " : " + rZ + " " + idx);
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
    console.log("flatten");
    this.layers.forEach((layer) => {
      if (layer.isContact && layer.visible) {
        this.moveContact(
          layer,
          layer.contactControlDepth,
          layer.contactControlIndex,
          true
        );
      }
    });
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
    waterLayer.setToConstant(Domain.DomDepth, 0);
    waterLayer.setToConstant(Domain.DomTime, 0);

    // top layer with simple water velocity
    let v0 = waterLayer.v0;
    let mudlineLayer = this.layers[1];
    for (let i = 0; i < this.length; i++) {
      mudlineLayer.point[i].time = (mudlineLayer.point[i].depth * 2000) / v0;
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
    var layerA = this.getVisibleLayerAbove(layer);

    var idx = layerA.point.reduce(
      (minIndex, currentElement, currentIndex, array) => {
        if (currentElement.t < array[minIndex].time) {
          return currentIndex;
        } else {
          return minIndex;
        }
      },
      0
    );

    this.quik_d0 = layerA.point[idx].depth;
    this.quik_t0 = layerA.point[idx].time;
    this.quik_tml = this.layers[1].point[idx].time;
    this.quik_v0 = layerA.velocityLayer.v0;
    this.quik_k = layerA.velocityLayer.k;
  }

  quickConvert(t1) {
    var d1 = TimeToDepth(
      this.quik_d0,
      this.quik_t0,
      t1,
      this.quik_v0,
      this.quik_k,
      this.quik_tml
    );
    return d1;
  }

  drawSection(domain, name) {
    var canvas = document.getElementById(name);
    var context = canvas.getContext("2d");
    var bdrX = 10;
    var h = 300;
    canvas.width = window.innerWidth - bdrX;
    canvas.height = h;
    context.clearRect(0, 0, window.innerWidth, h);
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
      let x = this.x0 + (w * i) / (this.length - 1);
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
        false //    true
      );
    });

    this.visibleLayers.forEach((layer) => {
      // if (layer.isContact)
      this.plotSurface(
        context,
        this.xValues,
        layer.yValues,
        layer.color, // "dimgray",
        layer.velocityLayer.color,
        true,
        false
      );
    });

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
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
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
