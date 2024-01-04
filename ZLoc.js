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

export const SEAWATER = "Sea Water";

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
    this.isRestricted = false;
    this.length = length;
    this.point = Array.from({ length }, (_) => new ZLoc(initDepth, initDepth));
    this.index = -1;
    this.velocityLayer = this;
  }

  setZ(domain, i, value) {
    if (domain == Domain.DomTime) {
      this.point[i].time = value;
    } else {
      this.point[i].depth = value;
    }
  }

  setZ(domain, i, value, layerA, layerB) {
    if (domain == Domain.DomTime) {
      var minZ = layerA != null ? layerA.point[i].time : -Number.MAX_VALUE;
      var maxZ = layerB != null ? layerB.point[i].time : Number.MAX_VALUE;
      this.point[i].time = clamp(value, minZ, maxZ);
    } else {
      var minZ = layerA != null ? layerA.point[i].depth : -Number.MAX_VALUE;
      var maxZ = layerB != null ? layerB.point[i].depth : Number.MAX_VALUE;
      this.point[i].depth = clamp(value, minZ, maxZ);
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

  isAnyDeeperThan(layerA) {
    for (let i = 0; i < this.length; i++)
      if (this.point[i].depth > layerA.point[i].depth) return true;
    return false;
  }

  maximumThicknessBetween(layerA) {
    var maxThickness = 0;
    for (let i = 0; i < this.length; i++)
      maxThickness = Math.max(
        maxThickness,
        Math.abs(this.point[i].depth - layerA.point[i].depth)
      );
    return maxThickness;
  }

  get minDepth() {
    var v = Number.MAX_VALUE;
    for (let i = 0; i < this.length; i++) v = Math.min(this.point[i].depth, v);
    return v;
  }
  get maxDepth() {
    var v = -Number.MAX_VALUE;
    for (let i = 0; i < this.length; i++) v = Math.max(this.point[i].depth, v);
    return v;
  }
  get minTime() {
    var v = Number.MAX_VALUE;
    for (let i = 0; i < this.length; i++) v = Math.min(this.point[i].time, v);
    return v;
  }
  get maxTime() {
    var v = -Number.MAX_VALUE;
    for (let i = 0; i < this.length; i++) v = Math.max(this.point[i].time, v);
    return v;
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
    this.showLayerNames = true;

    this.taper = new Array(1).fill(0.0);
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

  overwriteLayer(layer, domain, inputZ) {
    let layerA = this.getVisibleLayerAbove(layer);
    let layerB = this.getVisibleLayerBelow(layer);
    if (layer == this.mudlineLayer && domain == Domain.DomDepth) {
      for (let i = 0; i < layer.length; i++)
        layer.setZ(domain, i, inputZ[i], null, layerB);
    } else if (layer == this.waterLayer) {
      for (let i = 0; i < layer.length; i++)
        layer.setZ(domain, i, inputZ[i], layerA, layerB);
    } else {
      for (let i = 0; i < layer.length; i++)
        layer.setZ(domain, i, inputZ[i], layerA, layerB);
    }
  }

  overwriteLayerRange(layer, domain, inputZ, i0, i1, taperW) {
    if (this.taper.length != taperW) this.taper = this.calcTaper(taperW);

    let layerA = this.getVisibleLayerAbove(layer);
    let layerB = this.getVisibleLayerBelow(layer);
    // values in edit range
    for (let i = i0; i <= i1; i++) layer.setZ(domain, i, inputZ[i]);

    // tapering
    for (let i = 1; i < taperW; i++) {
      var f = this.taper[i];
      var ia = i1 + i;
      if (ia < this.length)
        layer.setZ(
          domain,
          ia,
          f * layer.getZ(domain, ia) + (1 - f) * inputZ[ia],
          layerA,
          layerB
        );

      ia = i0 - i;
      if (ia >= 0)
        layer.setZ(
          domain,
          ia,
          f * layer.getZ(domain, ia) + (1 - f) * inputZ[ia],
          layerA,
          layerB
        );
    }
  }

  calcTaper(taperW) {
    const fs = new Array(taperW).fill(0.0);
    const k = 6;
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

  setVerticalRange(domain, min, max) {
    if (domain == Domain.DomDepth) {
      this.minDepth = min;
      this.maxDepth = max;
    } else if (domain == Domain.DomTime) {
      this.minTime = min;
      this.maxTime = max;
    }
  }

  autosetVerticalRanges() {
    this.minDepth = Number.MAX_VALUE;
    this.maxDepth = -Number.MIN_VALUE;
    this.minTime = Number.MAX_VALUE;
    this.maxTime = -Number.MIN_VALUE;

    this.layers.forEach((layer) => {
      this.minDepth = Math.min(this.minDepth, layer.minDepth);
      this.maxDepth = Math.max(this.maxDepth, layer.maxDepth);
      this.minTime = Math.min(this.minTime, layer.minTime);
      this.maxTime = Math.max(this.maxTime, layer.maxTime);
    });

    var dz = (this.maxDepth - this.minDepth) * 0.05;
    this.minDepth -= dz;
    this.maxDepth += dz;
    dz = (this.maxTime - this.minTime) * 0.05;
    this.minTime -= dz;
    this.maxTime += dz;
  }

  setLayerVisible(layerName, viz) {
    this.layers.forEach((layer) => {
      if (layer.name == layerName) {
        layer.visible = viz;
        return;
      }
    });
  }

  setCompartmentRestriction(layerName, isRestricted) {
    this.layers.forEach((layer) => {
      if (layer.name == layerName) {
        layer.isRestricted = isRestricted;
        return;
      }
    });
  }

  ensureHChasThickness() {
    var anyZeroThicknessHC = false;
    this.visibleContactLayers.forEach((layer) => {
      var layerA = this.getVisibleLayerAbove(layer);
      if (layerA != null && !layer.isAnyDeeperThan(layerA))
        anyZeroThicknessHC = true;
    });

    if (anyZeroThicknessHC == false) return; // no need to do anything

    var DEPTH_INCREMENT = 100;
    var adjusted = true;

    while (adjusted) {
      adjusted = false;

      this.visibleContactLayers.forEach((layer) => {
        var layerA = this.getVisibleLayerAbove(layer);
        var maxThick = layer.maximumThicknessBetween(layerA);

        // move all that have thin thickess downward
        if (maxThick < DEPTH_INCREMENT) {
          adjusted = true;
          // push it down some
          layer.contactControlDepth += DEPTH_INCREMENT;
        }
      });

      if (adjusted) {
        // flatten out again
        // flatten and test again...
        this.flattenContacts();
      }
    }
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

  get mudlineLayer() {
    return this.layers[1];
  }
  get waterLayer() {
    return this.layers[0];
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

  adjustContactDepth(layer, rZ, idx, restrictBelow) {
    layer.contactControlDepth = rZ;
    layer.contactControlIndex = idx;

    let layerA = this.getVisibleLayerAbove(layer);
    let layerB = this.getVisibleLayerBelow(layer);

    // depth limit contact
    for (let i = 0; i < layer.length; i++) {
      var minZ = layerA.point[i].depth;
      var maxZ = layerB != null ? layerB.point[i].depth : 9999999999;
      layer.point[i].depth = clamp(rZ, minZ, maxZ);
    }

    layerA = this.getVisibleRegularLayerAbove(layer);
    layerB = this.getVisibleRegularLayerBelow(layer);
    for (let i = 0; i < layer.length; i++) {
      var minZ = layerA.point[i].depth;
      var maxZ =
        restrictBelow && layerB != null ? layerB.point[i].depth : 9999999999;
      layer.point[i].depth = clamp(layer.point[i].depth, minZ, maxZ);
    }

    // then restrict compartment? [option?]
    var restrictCompartment = layer.isRestricted;
    if (restrictCompartment) {
      layerA = this.getVisibleRegularLayerAbove(layer);
      if (layer.point[idx].depth > layerA.point[idx].depth) {
        // find extent
        var compartmentIdxA = 0;
        for (let i = idx; i >= 0; i--) {
          if (layer.point[i].depth <= layerA.point[i].depth) {
            compartmentIdxA = i;
            break;
          }
        }

        var compartmentIdxB = layer.length - 1;
        for (let i = idx; i < layer.length; i++) {
          if (layer.point[i].depth <= layerA.point[i].depth) {
            compartmentIdxB = i;
            break;
          }
        }

        for (let i = 0; i < layer.length; i++) {
          if (i < compartmentIdxA || i > compartmentIdxB)
            layer.point[i].depth = layerA.point[i].depth;
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
    for (let i = 0; i < this.length; i++) {
      this.waterLayer.point[i].depth = Math.min(
        this.mudlineLayer.point[i].depth,
        0.0
      );
    }
    this.waterLayer.setToConstant(Domain.DomTime, 0);
    // top layer with simple water velocity
    let v0 = this.waterLayer.v0;
    for (let i = 0; i < this.length; i++) {
      if (this.mudlineLayer.point[i].depth > 0)
        // mudline: seawater velocity
        this.mudlineLayer.point[i].time =
          (this.mudlineLayer.point[i].depth * 2000) / v0;
      else this.mudlineLayer.point[i].time = 0.0; // it's at surface, elevated
    }
    // the rest..
    for (let j = 2; j < this.visibleLayers.length; j++) {
      let layerA = this.visibleLayers[j - 1];
      let layerB = this.visibleLayers[j];

      for (let i = 0; i < this.length; i++) {
        let ptA = layerA.point[i];
        let ptB = layerB.point[i];
        let ptML = this.mudlineLayer.point[i];
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
    this.autosetVerticalRanges();
  }

  update_DepthFromTime(finalLayer) {
    this.setupVelocityLayers();

    // water at zero always
    this.waterLayer.setToConstant(Domain.DomDepth, 0);
    this.waterLayer.setToConstant(Domain.DomTime, 0);

    // top layer with simple water velocity
    let v0 = this.waterLayer.v0;
    for (let i = 0; i < this.length; i++) {
      this.mudlineLayer.point[i].depth =
        (v0 * this.mudlineLayer.point[i].time) / 2000;
    }

    // the rest..
    for (let j = 2; j < this.visibleLayers.length; j++) {
      let layerA = this.visibleLayers[j - 1];
      let layerB = this.visibleLayers[j];

      for (let i = 0; i < this.length; i++) {
        let ptA = layerA.point[i];
        let ptB = layerB.point[i];
        let ptML = this.mudlineLayer.point[i];
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
    this.autosetVerticalRanges();
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
    for (let i = vizLayers.length - 1; i >= 0; i--) {
      var layerA = vizLayers[i];
      if (depth >= layerA.point[idx].depth) {
        // therefore tA, dA above pointer
        var tA = layerA.point[idx].time;
        var dA = layerA.point[idx].depth;
        let ptML = this.mudlineLayer.point[idx];
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
    for (let i = vizLayers.length - 1; i >= 0; i--) {
      var layerA = vizLayers[i];
      if (time >= layerA.point[idx].time) {
        // therefore tA, dA above pointer
        var tA = layerA.point[idx].time;
        var dA = layerA.point[idx].depth;
        let ptML = this.mudlineLayer.point[idx];
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

  getVelocityAtTimeDepth(time, depth, idx) {
    // get the layer pointer is in
    if (idx < 0) return NaN;
    if (idx >= this.length) return NaN;
    var vizLayers = this.visibleLayers;

    for (let i = vizLayers.length - 1; i >= 0; i--) {
      var layerA = vizLayers[i];
      if (depth >= layerA.point[idx].depth) {
        let ptML = this.mudlineLayer.point[idx];

        // therefore velocity
        return VelocityAtTime(
          time,
          layerA.velocityLayer.v0,
          layerA.velocityLayer.k,
          ptML.time
        );
      }
    }

    return 343;
  }

  setCursor(t, d, i) {
    if (i < 0) i = -1;
    if (i >= this.length) i = -1;

    if (i != -1) {
      this.pointerTime = t;
      this.pointerDepth = d;
      this.pointerIndex = i;
      this.pointerVelocity = this.getVelocityAtTimeDepth(t, d, i);
    } else {
      this.pointerTime = NaN;
      this.pointerDepth = NaN;
      this.pointerIndex = i;
      this.pointerVelocity = NaN;
    }
  }

  drawSection(domain, name) {
    var canvas = document.getElementById(name);
    var ctx = canvas.getContext("2d");
    canvas.height = (window.innerHeight - 70) / 2;
    canvas.width = window.innerWidth;
    ctx.clearRect(0, 0, window.innerWidth, canvas.height);
    ctx.save();

    this.x0 = this.showLayerNames ? LEFT_SPACE : 0;
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
        ctx,
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
        ctx,
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

      var siz = 3;
      ctx.beginPath();
      ctx.strokeStyle = "rgb(255,0,0)";
      ctx.lineWidth = 1;
      ctx.moveTo(sx + siz, sy);
      ctx.lineTo(sx - siz, sy);
      ctx.stroke();
      ctx.moveTo(sx, sy - siz);
      ctx.lineTo(sx, sy + siz);
      ctx.stroke();
    }

    // labels
    ctx.font = "12px exo";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "black";

    var n = this.visibleRegularLayers.length;
    for (let index = 0; index < n; index++) {
      const layerA = this.visibleRegularLayers[index];
      const aY = layerA.yValues[0];
      const bY =
        index + 1 < n ? this.visibleRegularLayers[index + 1].yValues[0] : h;
      ctx.fillText(layerA.name, this.x0 - 5, (aY + bY) / 2);
    }

    this.drawgrid(ctx, canvas.width, h, minZ, maxZ);
    this.drawstatus(ctx, canvas.width, h);
    this.drawFrame(ctx, w, h);
  }

  drawgrid(ctx, w, h, minZ, maxZ) {
    var dZ = this.getGridVerticalIncrement(minZ, maxZ);

    var z0 = Math.floor(minZ / dZ) * dZ;
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = "rgba(110,110,255, 0.5)";

    ctx.font = "10px exo";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "blue";

    for (var i = 0; i < 30; i++) {
      var z = z0 + i * dZ;
      if (z > maxZ) break;
      var sy = toScreenY(z, h, minZ, maxZ);
      ctx.beginPath();
      ctx.moveTo(this.x0 + 28, sy);
      ctx.lineTo(w, sy);
      ctx.stroke();

      ctx.fillText(z, this.x0 + 2, sy);
    }
  }

  drawstatus(ctx, w, h) {
    ctx.font = "12px exo";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = "white";
    var x = w - 270; //this.x0 + 5;
    var y = h;

    var BLANK = " ";
    var txtT = "Time: ";
    if (this.pointerDomain != Domain.None)
      txtT += isNaN(this.pointerTime)
        ? BLANK
        : Math.round(this.pointerTime) + "ms";

    var txtD = this.pointerDepth < 0 ? "Elevation: " : "Depth: ";
    if (this.pointerDomain != Domain.None)
      txtD += isNaN(this.pointerDepth)
        ? BLANK
        : Math.abs(Math.round(this.pointerDepth)) + "m ";

    var txtV = "Velocity: ";
    if (this.pointerDomain != Domain.None)
      txtV += isNaN(this.pointerVelocity)
        ? BLANK
        : Math.round(this.pointerVelocity) + "m/s";

    ctx.fillText(txtT, x, y);
    x += 80;
    ctx.fillText(txtD, x, y);
    x += 80;
    ctx.fillText(txtV, x, y);
  }

  getGridVerticalIncrement(minZ, maxZ) {
    var dZ = (maxZ - minZ) / 10;

    for (var i = 0; i < 5; i++) {
      var b = Math.pow(10, i);
      // 1,2,5
      var v = b * 1;
      if (dZ < v) return v;
      v = b * 2;
      if (dZ < v) return v;
      v = b * 5;
      if (dZ < v) return v;
    }
    return 1000;
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

    const x = e.clientX || e.touches[0].clientX;
    const y = e.clientY || e.touches[0].clientY;

    var mouseX = (x - rect.left) * scaleX;
    var mouseY = (y - rect.top) * scaleY;

    //console.log("XY: " + mouseX + ", " + mouseY);
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
