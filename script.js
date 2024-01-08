import { Domain } from "./quiacito.js";
import { USection } from "./quiacito.js";
import { SEAWATER } from "./quiacito.js";

var LAYER_WIDTH = 400;
var SMOOTH_WIN = 7;
var TAPER_WIN = 1;
var uSection = null;

var mX = 0;
var mY = 0;
var rZ = 0;
var mIdx = -1;
var editingDomain = Domain.None;

var editLayer;
var prevIdx = -1;
var edited_i0 = -1;
var edited_i1 = -1;
var prevY = -Number.MAX_VALUE;
var fixY = -Number.MAX_VALUE;
var initialZ;
var editZ;
var wholeZ;
var wasShiftKeyPressed = false;
var wasCtrlKeyPressed = false;
var wasWholeLayerShift = false;

init();

function init() {
  console.log("init!!!");

  SMOOTH_WIN = Math.ceil(LAYER_WIDTH / 30);
  SMOOTH_WIN = Math.floor(SMOOTH_WIN / 2) * 2 + 1;
  TAPER_WIN = SMOOTH_WIN;

  let canvas = document.getElementById("canvasTime");
  canvas.addEventListener("mousedown", startEditTIME);
  canvas.addEventListener("mousemove", moveEditTIME);
  canvas.addEventListener("mouseup", endEdit);
  canvas.addEventListener("mouseout", mouseOut);
  canvas.addEventListener("touchstart", startEditTIME);
  canvas.addEventListener("touchmove", moveEditTIME);
  canvas.addEventListener("touchend", endEdit);
  canvas.addEventListener("touchend", touchEnd);

  canvas = document.getElementById("canvasDepth");
  canvas.addEventListener("mousedown", startEditDEPTH);
  canvas.addEventListener("mousemove", moveEditDEPTH);
  canvas.addEventListener("mouseup", endEdit);
  canvas.addEventListener("mouseout", mouseOut);
  canvas.addEventListener("touchstart", startEditDEPTH);
  canvas.addEventListener("touchmove", moveEditDEPTH);
  canvas.addEventListener("touchend", endEdit);
  canvas.addEventListener("touchend", touchEnd);

  // Prevent scrolling on touchscreen devices
  document.body.addEventListener(
    "touchmove",
    function (e) {
      if (editingDomain != Domain.None) {
        e.preventDefault();
      }
    },
    { passive: false }
  );

  document.addEventListener("DOMContentLoaded", function () {
    addOutsideEventListener("canvasTime");
    addOutsideEventListener("canvasDepth");
  });

  window.addEventListener("resize", resizeCanvas, false);

  // Event for 'h' key press
  document.addEventListener("keydown", function (event) {
    if (event.key === "h") {
      uSection.showHC = !uSection.showHC;
      document.getElementById("showHC").checked = uSection.showHC;
    }
    if (event.key === "l") {
      uSection.showLayerNames = !uSection.showLayerNames;
      document.getElementById("layerNames").checked = uSection.showLayerNames;
    }

    if (event.key === "1") {
      document.getElementById("gasA").checked =
        uSection.toggleLayerActive("GasA");
      checkboxChanged();
    }
    if (event.key === "2") {
      document.getElementById("oilA").checked =
        uSection.toggleLayerActive("OilA");
      checkboxChanged();
    }
    if (event.key === "3") {
      document.getElementById("resA").checked =
        uSection.toggleCompartmentRestriction("GasA");
      document.getElementById("resA").checked =
        uSection.toggleCompartmentRestriction("OilA");
      checkboxChanged();
    }

    if (event.key === "4") {
      document.getElementById("gasB").checked =
        uSection.toggleLayerActive("GasB");
      checkboxChanged();
    }
    if (event.key === "5") {
      document.getElementById("oilB").checked =
        uSection.toggleLayerActive("OilB");
      checkboxChanged();
    }
    if (event.key === "6") {
      document.getElementById("resB").checked =
        uSection.toggleCompartmentRestriction("GasB");
      document.getElementById("resB").checked =
        uSection.toggleCompartmentRestriction("OilB");
      checkboxChanged();
    }
  });

  resetSection();
  draw();
}

export function resetSection() {
  dismissMenu();

  var gasDV = 500;
  var oilDV = 240;

  var last_showLayerNames = uSection != null ? uSection.showLayerNames : true;

  uSection = new USection(LAYER_WIDTH);
  uSection.addLayer(SEAWATER, "lightblue", 1500, 0, false, 0.0);
  uSection.addLayer("Claystone", "tan", 1600, 0.41, false, 300.0);
  uSection.addLayer("Sandstone A", "lightyellow", 2000, 0.515, false, 1000.0);
  uSection.addLayer("GasA", "darkred", 1500 - gasDV, 0.01, true, 1100.0);
  uSection.addLayer("OilA", "darkgreen", 1500 - oilDV, 0.01, true, 1200.0);
  uSection.addLayer("Salt", "deepskyblue", 4500, 0.0, false, 1700.0);
  uSection.addLayer("Sandstone B", "lightyellow", 2000, 0.515, false, 2500.0);
  uSection.addLayer("GasB", "darkred", 1500 - gasDV, 0.01, true, 2600.0);
  uSection.addLayer("OilB", "darkgreen", 1500 - oilDV, 0.01, true, 2700.0);
  uSection.addLayer("Basement", "darkviolet", 4500, 1.1, false, 3500.0);

  uSection.setVerticalRange(Domain.DomDepth, -200.0, 5000.0);
  uSection.setVerticalRange(Domain.DomTime, -200.0, 4000.0);

  let canvas = document.getElementById("canvasTime");
  uSection.canvasTime = canvas;

  canvas = document.getElementById("canvasDepth");
  uSection.canvasDepth = canvas;
  uSection.showLayerNames = last_showLayerNames;
  uSection.showHC = true;

  document.getElementById("gasA").checked = false;
  document.getElementById("gasB").checked = false;
  document.getElementById("oilA").checked = false;
  document.getElementById("oilB").checked = false;
  document.getElementById("resA").checked = false;
  document.getElementById("resB").checked = false;
  document.getElementById("layerNames").checked = uSection.showLayerNames;
  document.getElementById("showHC").checked = uSection.showHC;

  changedHydrocarbon();
  uSection.update_From(Domain.DomDepth);
}

function addOutsideEventListener(canvasName) {
  var canvas = document.getElementById(canvasName);

  canvas.addEventListener("mousedown", function (e) {
    document.addEventListener("mouseup", function mouseUpHandler(e) {
      // Your mouseup code here, even if it's outside the canvas
      endEdit(e);
      // Remove the mouseup event listener from the document
      document.removeEventListener("mouseup", mouseUpHandler);
      document.removeEventListener("mouseup", mouseUpHandler);
    });
  });
}

export function toggleMenu() {
  console.log("toggle");
  const menuList = document.querySelector(".menu-list");
  menuList.classList.toggle("active");
}

export function dismissMenu() {
  const menuList = document.querySelector(".menu-list");
  menuList.classList.remove("active");
}

export function checkboxChanged() {
  dismissMenu();
  changedHydrocarbon();
}

export function changedCompartment() {
  changedHydrocarbon();
}
export function changedHydrocarbon() {
  var oilA = false;
  var oilB = false;
  var gasA = false;
  var gasB = false;

  gasA = document.getElementById("gasA").checked;
  gasB = document.getElementById("gasB").checked;
  oilA = document.getElementById("oilA").checked;
  oilB = document.getElementById("oilB").checked;
  var resA = document.getElementById("resA").checked;
  var resB = document.getElementById("resB").checked;
  var layerNames = document.getElementById("layerNames").checked;
  var showHC = document.getElementById("showHC").checked;

  uSection.setLayerActive("OilA", oilA);
  uSection.setLayerActive("OilB", oilB);
  uSection.setLayerActive("GasA", gasA);
  uSection.setLayerActive("GasB", gasB);

  uSection.setCompartmentRestriction("OilA", resA);
  uSection.setCompartmentRestriction("OilB", resB);
  uSection.setCompartmentRestriction("GasA", resA);
  uSection.setCompartmentRestriction("GasB", resB);

  uSection.showLayerNames = layerNames;
  uSection.showHC = showHC;

  uSection.flattenContactsInDepth();
  uSection.ensureHChasThickness();
  uSection.update_From(Domain.DomDepth);
  uSection.autosetVerticalRanges();
}

function draw() {
  uSection.drawSection(Domain.DomTime, "canvasTime");
  uSection.drawSection(Domain.DomDepth, "canvasDepth");
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
}

function moveEditDEPTH(e) {
  moveEdit(Domain.DomDepth, e);
}

function mouseOut(e) {
  uSection.pointerDomain = Domain.None;
  uSection.setCursor(NaN, NaN, -1);
}

function startEdit(domain, e) {
  dismissMenu();
  let coord = uSection.handleXY(domain, e);
  mX = coord.x;
  mY = coord.y;

  editingDomain = domain;
  editLayer = uSection.getLayerAtPointer(editingDomain, mX, mY);
  let idx = uSection.getIndex(mX);

  if (idx < 0) return;

  prevIdx = idx;
  prevY = mY;

  edited_i0 = edited_i1 = idx;

  if (editLayer != null) {
    initialZ = editLayer.snapShot(editingDomain);
    editZ = editLayer.snapShot(editingDomain);
  }
}

function moveEdit(domain, e) {
  let coord = uSection.handleXY(domain, e);
  mX = coord.x;
  mY = coord.y;
  rZ = uSection.pointerTo(domain, mY);
  mIdx = uSection.getIndex(mX);

  if (domain == Domain.DomTime)
    uSection.setCursor(rZ, uSection.convertTimeToDepth(rZ, mIdx), mIdx);
  else uSection.setCursor(uSection.convertDepthToTime(rZ, mIdx), rZ, mIdx);

  uSection.pointerDomain = domain;

  var isShiftKeyPressed = e.shiftKey;
  var isCtrlKeyPressed = e.ctrlKey;
  var isWholeLayerShift = isShiftKeyPressed && isCtrlKeyPressed;

  if (editLayer != null && isWholeLayerShift) {
    if (!wasWholeLayerShift) {
      //take snapshot of whole layer
      wholeZ = editLayer.snapShot(editingDomain);
      fixY = rZ;
    }
    wasWholeLayerShift = true;
  } else {
    wasWholeLayerShift = false;
  }

  if (!wasWholeLayerShift && isCtrlKeyPressed) {
    if (!wasCtrlKeyPressed) fixY = mY;
    wasCtrlKeyPressed = true;
  } else wasCtrlKeyPressed = false;

  wasShiftKeyPressed = isShiftKeyPressed;

  if (editingDomain != domain) return;
  if (editLayer == null) return;

  if (editLayer.isContact) {
    if (domain == Domain.DomDepth)
      uSection.adjustContactDepth(editLayer, rZ, mIdx, true);
    else {
      editLayer.contactControlTime = rZ;
      editLayer.contactControlIndex = mIdx;
    }
  } else {
    // REGULAR
    var layerA = uSection.getActiveRegularLayerAbove(editLayer);
    var layerB = uSection.getActiveRegularLayerBelow(editLayer);
    if (mIdx != -1) {
      let ia = 0;
      let ib = 0;
      let ya = 0;
      let yb = 0;
      if (mIdx > prevIdx) {
        ia = prevIdx;
        ib = mIdx;
        ya = prevY;
        yb = mY;
      } else {
        ia = mIdx;
        ib = prevIdx;
        ya = mY;
        yb = prevY;
      }

      edited_i0 = Math.min(edited_i0, mIdx);
      edited_i1 = Math.max(edited_i1, mIdx);

      if (wasWholeLayerShift) {
        var dZ = rZ - fixY;
        for (let i = 0; i < LAYER_WIDTH; i++) editZ[i] = wholeZ[i] + dZ;
        uSection.overwriteLayer(editLayer, editingDomain, editZ);
      } else {
        if (wasCtrlKeyPressed) {
          // flat parts
          ya = fixY;
          yb = fixY;
          mY = fixY;
        }

        var minZ = 0.0;
        var maxZ = 0.0;
        for (let i = ia; i <= ib; i++) {
          let y = ib == ia ? ya : ((yb - ya) * (i - ia)) / (ib - ia) + ya;

          if (editingDomain == Domain.DomDepth) {
            minZ =
              layerA.name == SEAWATER
                ? -Number.MAX_VALUE
                : layerA.point[i].depth;
            maxZ = layerB != null ? layerB.point[i].depth : Number.MAX_VALUE;
          } else {
            minZ = layerA != null ? layerA.point[i].time : -Number.MAX_VALUE;
            maxZ = layerB != null ? layerB.point[i].time : Number.MAX_VALUE;
          }
          var z = uSection.pointerTo(editingDomain, y);
          if (z < minZ) z = minZ;
          if (z > maxZ) z = maxZ;
          editZ[i] = z;
        } //end little loop

        // extend edges horizontally
        const tmp = new Array(LAYER_WIDTH).fill(0.0);
        for (let i = 0; i < LAYER_WIDTH; i++) {
          if (i < edited_i0) tmp[i] = editZ[edited_i0];
          else if (i > edited_i1) tmp[i] = editZ[edited_i1];
          else tmp[i] = editZ[i];
        }

        // simply overwrite in TIME/DEPTH
        uSection.overwriteLayer(editLayer, editingDomain, initialZ);
        uSection.overwriteLayerRange(
          editLayer,
          editingDomain,
          tmp,
          edited_i0,
          edited_i1,
          SMOOTH_WIN,
          TAPER_WIN
        );
      } // end free edit
      prevIdx = mIdx;
      prevY = mY;
    }
  } // end regular layer edit

  uSection.update_From(editingDomain);
}

function endEdit(e) {
  uSection.autosetVerticalRanges();
  editingDomain = Domain.None;
  editLayer = null;
  prevIdx = -1;
  prevY = -Number.MAX_VALUE;
  edited_i0 = -1;
  edited_i1 = -1;
  wasShiftKeyPressed = false;
  wasCtrlKeyPressed = false;
  wasWholeLayerShift = false;
}

function touchEnd(e) {
  mouseOut(e);
}
