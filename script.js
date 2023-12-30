import { Domain } from "./ZLoc.js";
import { USection } from "./ZLoc.js";

var LAYER_WIDTH = 400;
var SMOOTH_WIN = 15;
var TAPER_WIN = 1;
var uSection;

var mX = 0;
var mY = 0;
var rZ = 0;
var frame = 0;
var editingDomain = Domain.None;
var pointerDomain = Domain.None;
var editLayer;
var prevIdx = -1;
var edited_i0 = -1;
var edited_i1 = -1;
var prevY = -999;
var initialZ;
var editZ;

init();

function init() {
  console.log("init!!!");

  TAPER_WIN = Math.floor(SMOOTH_WIN / 2);
  TAPER_WIN = SMOOTH_WIN;
  var gasDV = 300;
  var oilDV = 100;
  uSection = new USection(LAYER_WIDTH);
  uSection.addLayer("Seawater", "lightblue", 1500, 0, false, 0.0);
  uSection.addLayer("Claystone", "pink", 2500, 0.02, false, 300.0);
  uSection.addLayer("SandstoneA", "yellow", 1500, 0.01, false, 1000.0);
  uSection.addLayer("GasA", "darkred", 1500 - gasDV, 0.01, true, 1100.0);
  uSection.addLayer("OilA", "darkgreen", 1500 - oilDV, 0.01, true, 1200.0);
  uSection.addLayer("Salt", "deepskyblue", 4500, 0.0, false, 1700.0);
  uSection.addLayer("SandstoneB", "yellow", 1500, 0.01, false, 2500.0);
  uSection.addLayer("GasB", "darkred", 1500 - gasDV, 0.01, true, 2600.0);
  uSection.addLayer("OilB", "darkgreen", 1500 - oilDV, 0.01, true, 2700.0);
  uSection.addLayer("Basement", "purple", 3500, 0.01, false, 3500.0);

  uSection.setVerticalRange(Domain.DomDepth, -200.0, 5000.0);
  uSection.setVerticalRange(Domain.DomTime, -200.0, 4000.0);
  changedHydrocarbon();
  uSection.update_TimeFromDepth();

  let canvas = document.getElementById("canvasTime");
  canvas.addEventListener("mousedown", startEditTIME);
  canvas.addEventListener("mousemove", moveEditTIME);
  canvas.addEventListener("mouseup", endEdit);
  canvas.addEventListener("mouseout", mouseOut);
  uSection.canvasTime = canvas;

  canvas = document.getElementById("canvasDepth");
  canvas.addEventListener("mousedown", startEditDEPTH);
  canvas.addEventListener("mousemove", moveEditDEPTH);
  canvas.addEventListener("mouseup", endEdit);
  canvas.addEventListener("mouseout", mouseOut);
  uSection.canvasDepth = canvas;

  document.addEventListener("DOMContentLoaded", function () {
    addOutsideEventListener("canvasTime");
    addOutsideEventListener("canvasDepth");
  });

  window.requestAnimationFrame(draw);
  window.addEventListener("resize", resizeCanvas, false);
}

function addOutsideEventListener(canvasName) {
  var canvas = document.getElementById(canvasName);
  var isMouseDown = false;

  canvas.addEventListener("mousedown", function (e) {
    isMouseDown = true;

    document.addEventListener("mouseup", function mouseUpHandler(e) {
      isMouseDown = false;

      // Your mouseup code here, even if it's outside the canvas
      console.log("Mouse up outside canvas");
      endEdit(e);
      // Remove the mouseup event listener from the document
      document.removeEventListener("mouseup", mouseUpHandler);
      document.removeEventListener("mouseup", mouseUpHandler);
    });
  });
}

export function changedHydrocarbon() {
  var hcA = document.getElementById("hcSelectorA").value;
  var hcB = document.getElementById("hcSelectorB").value;
  var oilA = false;
  var oilB = false;
  var gasA = false;
  var gasB = false;
  switch (hcA) {
    case "oil":
      oilA = true;
      break;
    case "gas":
      gasA = true;
      break;
    case "oil_gas":
      oilA = true;
      gasA = true;
      break;
    case "none":
      break;
  }
  switch (hcB) {
    case "oil":
      oilB = true;
      break;
    case "gas":
      gasB = true;
      break;
    case "oil_gas":
      oilB = true;
      gasB = true;
      break;
    case "none":
      break;
  }

  uSection.setLayerVisible("OilA", oilA);
  uSection.setLayerVisible("OilB", oilB);
  uSection.setLayerVisible("GasA", gasA);
  uSection.setLayerVisible("GasB", gasB);
  uSection.flattenContacts();
  uSection.update_TimeFromDepth();

  draw();
}

function draw() {
  uSection.drawSection(Domain.DomTime, "canvasTime");
  uSection.drawSection(Domain.DomDepth, "canvasDepth");

  // movement??
  frame++;
  showOut();
  window.requestAnimationFrame(draw);
}

function resizeCanvas() {}

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

function mouseOut(e) {
  pointerDomain = Domain.None;
  showOut();
}

function startEdit(domain, e) {
  let coord = uSection.handleXY(domain, e);
  mX = coord.x;
  mY = coord.y;

  editingDomain = domain;
  editLayer = uSection.getLayerAtPointer(editingDomain, mX, mY);
  let idx = uSection.getIndex(mX);
  prevIdx = idx;
  prevY = mY;

  edited_i0 = edited_i1 = idx;

  // rough convert if needed
  if (
    editLayer != null &&
    editLayer.isContact &&
    editingDomain == Domain.DomTime
  ) {
    uSection.setupQuickTimeToDepth(editLayer, idx);
  }

  if (editLayer != null) {
    console.log("EDIT LAYER START:" + editLayer.name);
    initialZ = editLayer.snapShot(editingDomain);
    editZ = editLayer.snapShot(editingDomain);
  } else console.log("EDIT LAYER START: NULL");
}

function moveEdit(domain, e) {
  let coord = uSection.handleXY(domain, e);
  mX = coord.x;
  mY = coord.y;
  rZ = uSection.pointerTo(domain, mY);

  pointerDomain = domain;

  if (editingDomain == domain) {
    if (editLayer != null) {
      var layerA = uSection.getVisibleRegularLayerAbove(editLayer);
      var layerB = uSection.getVisibleRegularLayerBelow(editLayer);
      console.log(
        "Edit:" +
          editLayer.name +
          " between " +
          layerA.name +
          " and " +
          (layerB != null ? layerB.name : "-")
      );

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
        } else {
          ia = idx;
          ib = prevIdx;
          ya = mY;
          yb = prevY;
        }

        edited_i0 = Math.min(edited_i0, idx);
        edited_i1 = Math.max(edited_i1, idx);

        if (editLayer.isContact) {
          if (editingDomain == Domain.DomDepth)
            uSection.adjustContactDepth(editLayer, rZ, idx, true);
          else {
            // rough convert time to depth to
            var roughDepth = uSection.quickConvert(rZ);
            uSection.adjustContactDepth(editLayer, roughDepth, idx, false);
            uSection.update_TimeFromDepth(editLayer);
            var vizBelow = uSection.getVisibleLayerBelow(editLayer);
            // restrict editlayer in TIME. Times below unaffected
            if (vizBelow != null)
              for (let i = 0; i < uSection.length; i++)
                editLayer.point[i].time = Math.min(
                  editLayer.point[i].time,
                  vizBelow.point[i].time
                );
          }
        } else {
          // regular
          for (let i = ia; i <= ib; i++) {
            let y = ib == ia ? mY : ((yb - ya) * (i - ia)) / (ib - ia) + ya;
            if (editingDomain == Domain.DomTime) {
              var minZ = layerA.point[i].time;
              var maxZ = layerB != null ? layerB.point[i].time : 9999999999;
              var z = uSection.pointerTo(editingDomain, y);
              if (z < minZ) z = minZ;
              if (z > maxZ) z = maxZ;
              editZ[i] = z;
            } else {
              var minZ = layerA.point[i].depth;
              var maxZ = layerB != null ? layerB.point[i].depth : 9999999999;
              var z = uSection.pointerTo(editingDomain, y);
              if (z < minZ) z = minZ;
              if (z > maxZ) z = maxZ;
              editZ[i] = z;
            }
          }

          // smoothed version of editZ
          // -> push edit range (taper?) to editLayer
          editLayer.overwrite(editingDomain, initialZ);

          // extend edges horizontally
          var n = LAYER_WIDTH;
          const tmp = editLayer.snapShot(editingDomain);
          for (let i = 0; i < n; i++) {
            if (i < edited_i0) tmp[i] = editZ[edited_i0];
            else if (i > edited_i1) tmp[i] = editZ[edited_i1];
            else tmp[i] = editZ[i];
          }

          var smoothZ = smooth(tmp, SMOOTH_WIN);

          editLayer.overwriteRange(
            editingDomain,
            smoothZ,
            0, //    edited_i0,
            LAYER_WIDTH - 1, //    edited_i1,
            TAPER_WIN
          );
        }

        prevIdx = idx;
        prevY = mY;
      }

      if (editingDomain == Domain.DomTime) {
        uSection.update_DepthFromTime(null);
        uSection.flattenContacts();
        uSection.update_TimeFromDepth(null);
      } else {
        uSection.flattenContacts();
        uSection.update_TimeFromDepth(null);
      }
    }
  }
}

function endEdit(e) {
  editingDomain = Domain.None;
  editLayer = null;
  prevIdx = -1;
  prevY = -999;
  edited_i0 = -1;
  edited_i1 = -1;
  console.log("EDIT LAYER END:");
}

function showOut() {
  var coor = pointerDomain + " (" + Math.round(mX) + "," + Math.round(rZ) + ")";
  document.getElementById("demo").innerHTML = coor;
}

function smooth(zArray, win) {
  const n = zArray.length;
  const smoothed = new Array(n).fill(0.0);

  const hwin = Math.floor(win / 2);
  for (let j = 0; j < win; j++) {
    var offset = j - hwin;
    for (let i = 0; i < n; i++) {
      var ia = i + offset;
      if (ia < 0) ia = 0;
      if (ia >= n) ia = n - 1;
      smoothed[i] += zArray[ia] / win;
    }
  }
  return smoothed;
}
