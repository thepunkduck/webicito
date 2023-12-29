import { Domain } from "./ZLoc.js";
import { USection } from "./ZLoc.js";

var LAYER_WIDTH = 400;

var mX = 0;
var mY = 0;
var rZ = 0;
var frame = 0;
var editingDomain = Domain.None;
var pointerDomain = Domain.None;
var editLayer;
var prevIdx = -1;
var prevY = -999;
var uSection;

init();

function init() {
  console.log("init!!!");
  window.requestAnimationFrame(draw);
  window.addEventListener("resize", resizeCanvas, false);

  var gasDV = 300;
  var oilDV = 0;
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

  //     .addEventListener("mousemove", function (event) {
  //     myFunctionTIME(event);
  // });
  canvas = document.getElementById("canvasDepth");
  canvas.addEventListener("mousedown", startEditDEPTH);
  canvas.addEventListener("mousemove", moveEditDEPTH);
  canvas.addEventListener("mouseup", endEdit);
  canvas.addEventListener("mouseout", mouseOut);
  uSection.canvasDepth = canvas;
  // document.getElementById("canvasDepth")
  //     .addEventListener("mousemove", function (event) {
  //         myFunctionDEPTH(event);
  //     });
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

  // rough convert if needed
  if (editLayer.isContact && editingDomain == Domain.DomTime) {
    uSection.setupQuickTimeToDepth(editLayer);
  }

  if (editLayer != null) console.log("EDIT LAYER START:" + editLayer.name);
  else console.log("EDIT LAYER START: NULL");
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
          layerB.name
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

        if (editLayer.isContact) {
          if (editingDomain == Domain.DomDepth)
            uSection.moveContact(editLayer, rZ, idx, true);
          else {
            // rough convert time to depth to
            var roughDepth = uSection.quickConvert(rZ);
            uSection.moveContact(editLayer, roughDepth, idx, false);
            uSection.update_TimeFromDepth(editLayer);
            // restrict editlayer in TIME

            // times below unaffected
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
              editLayer.point[i].time = z;
            } else {
              var minZ = layerA.point[i].depth;
              var maxZ = layerB != null ? layerB.point[i].depth : 9999999999;
              var z = uSection.pointerTo(editingDomain, y);
              if (z < minZ) z = minZ;
              if (z > maxZ) z = maxZ;
              editLayer.point[i].depth = z;
            }
          }
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
  console.log("EDIT LAYER END:");
}

function showOut() {
  var coor = pointerDomain + " (" + Math.round(mX) + "," + Math.round(rZ) + ")";
  document.getElementById("demo").innerHTML = coor;
}
