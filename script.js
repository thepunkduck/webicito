import { Domain } from "./quiacito.js";
import { USection } from "./quiacito.js";
import { SEAWATER } from "./quiacito.js";

var LAYER_WIDTH = 400;
const SMOOTH_WIN_TOUCH = 13;
const SMOOTH_WIN_MOUSE = 7;
var SMOOTH_WIN = SMOOTH_WIN_MOUSE;
var uSection = null;

// Edit mode chosen on the toolbar. Keyboard modifiers still work on desktop:
// Ctrl = flat, Shift+Ctrl = move whole layer.
export const EditMode = { Draw: "draw", Flat: "flat", Move: "move" };
var editMode = EditMode.Draw;

var mX = 0;
var mY = 0;
var rZ = 0;
var mIdx = -1;
var editingDomain = Domain.None;
var activePointerId = null;

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

var drawPending = false;

init();

function init() {
  setupCanvas("canvasTime", Domain.DomTime);
  setupCanvas("canvasDepth", Domain.DomDepth);

  // Redraw when the panels change size (rotation, window resize, toolbar wrap...)
  if ("ResizeObserver" in window) {
    const ro = new ResizeObserver(requestDraw);
    ro.observe(document.getElementById("canvasTime"));
    ro.observe(document.getElementById("canvasDepth"));
  }
  window.addEventListener("resize", requestDraw, false);
  // Labels use the Exo web font; redraw once it has arrived
  if (document.fonts) document.fonts.ready.then(requestDraw);

  document.addEventListener("keydown", function (event) {
    const key = event.key.toLowerCase();
    if (key === "h") {
      uSection.showHC = !uSection.showHC;
      document.getElementById("showHC").checked = uSection.showHC;
    }
    if (key === "l") {
      uSection.showLayerNames = !uSection.showLayerNames;
      document.getElementById("layerNames").checked = uSection.showLayerNames;
    }

    if (key === "1") {
      document.getElementById("gasA").checked =
        uSection.toggleLayerActive("GasA");
      checkboxChanged();
    }
    if (key === "2") {
      document.getElementById("oilA").checked =
        uSection.toggleLayerActive("OilA");
      checkboxChanged();
    }
    if (key === "3") {
      document.getElementById("resA").checked =
        uSection.toggleCompartmentRestriction("GasA");
      document.getElementById("resA").checked =
        uSection.toggleCompartmentRestriction("OilA");
      checkboxChanged();
    }

    if (key === "4") {
      document.getElementById("gasB").checked =
        uSection.toggleLayerActive("GasB");
      checkboxChanged();
    }
    if (key === "5") {
      document.getElementById("oilB").checked =
        uSection.toggleLayerActive("OilB");
      checkboxChanged();
    }
    if (key === "6") {
      document.getElementById("resB").checked =
        uSection.toggleCompartmentRestriction("GasB");
      document.getElementById("resB").checked =
        uSection.toggleCompartmentRestriction("OilB");
      checkboxChanged();
    }
    requestDraw();
  });

  resetSection();
}

function setupCanvas(id, domain) {
  const canvas = document.getElementById(id);

  canvas.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary || activePointerId !== null) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    activePointerId = e.pointerId;
    // keep receiving moves even if the finger/mouse leaves the canvas
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) {}
    startEdit(domain, e);
    updateCursor(domain, e); // show the read-out immediately on touch
    requestDraw();
  });

  canvas.addEventListener("pointermove", (e) => {
    if (activePointerId !== null && e.pointerId !== activePointerId) return;
    // Hovering only makes sense with a mouse or pen
    if (activePointerId === null && e.pointerType === "touch") return;
    moveEdit(domain, e);
    requestDraw();
  });

  const finish = (e) => {
    if (e.pointerId !== activePointerId) return;
    activePointerId = null;
    endEdit(e);
    // a finger lifted off the glass leaves no hover cursor behind
    if (e.pointerType !== "mouse") pointerOut();
    requestDraw();
  };
  canvas.addEventListener("pointerup", finish);
  canvas.addEventListener("pointercancel", finish);

  canvas.addEventListener("pointerleave", (e) => {
    if (activePointerId !== null) return;
    pointerOut();
    requestDraw();
  });

  // no long-press context menu on Android
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
}

export function setEditMode(mode) {
  editMode = mode;
  document.querySelectorAll(".toolbar .mode").forEach((btn) => {
    const on = btn.dataset.mode === mode;
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-checked", on ? "true" : "false");
  });
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

  uSection.canvasTime = document.getElementById("canvasTime");
  uSection.canvasDepth = document.getElementById("canvasDepth");
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

  // Draw once so the screen positions used for hit-testing exist
  draw();
  changedHydrocarbon();
  uSection.update_From(Domain.DomDepth);
  requestDraw();
}

export function toggleMenu() {
  const menuList = document.querySelector(".menu-list");
  const open = menuList.classList.toggle("active");
  document.querySelector(".menu-icon").setAttribute("aria-expanded", open);
}

export function dismissMenu() {
  const menuList = document.querySelector(".menu-list");
  menuList.classList.remove("active");
  const btn = document.querySelector(".menu-icon");
  if (btn) btn.setAttribute("aria-expanded", "false");
}

export function checkboxChanged() {
  changedHydrocarbon();
}

export function changedCompartment() {
  changedHydrocarbon();
}

export function changedHydrocarbon() {
  var gasA = document.getElementById("gasA").checked;
  var gasB = document.getElementById("gasB").checked;
  var oilA = document.getElementById("oilA").checked;
  var oilB = document.getElementById("oilB").checked;
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
  requestDraw();
}

// Draw only when something changed, not every frame - saves battery on phones.
function requestDraw() {
  if (drawPending) return;
  drawPending = true;
  window.requestAnimationFrame(() => {
    drawPending = false;
    draw();
  });
}

function draw() {
  uSection.drawSection(Domain.DomTime, "canvasTime");
  uSection.drawSection(Domain.DomDepth, "canvasDepth");
}

function pointerOut() {
  uSection.pointerDomain = Domain.None;
  uSection.setCursor(NaN, NaN, -1);
}

function startEdit(domain, e) {
  dismissMenu();
  const isTouch = e.pointerType !== "mouse";
  SMOOTH_WIN = isTouch ? SMOOTH_WIN_TOUCH : SMOOTH_WIN_MOUSE;

  let coord = uSection.handleXY(domain, e);
  mX = coord.x;
  mY = coord.y;

  editingDomain = domain;
  // fingers are less precise than a mouse: grab layers from further away
  editLayer = uSection.getLayerAtPointer(editingDomain, mX, mY, isTouch ? 24 : 10);
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

function updateCursor(domain, e) {
  let coord = uSection.handleXY(domain, e);
  mX = coord.x;
  mY = coord.y;
  rZ = uSection.pointerTo(domain, mY);
  mIdx = uSection.getIndex(mX);

  if (domain == Domain.DomTime)
    uSection.setCursor(rZ, uSection.convertTimeToDepth(rZ, mIdx), mIdx);
  else uSection.setCursor(uSection.convertDepthToTime(rZ, mIdx), rZ, mIdx);

  uSection.pointerDomain = domain;
}

function moveEdit(domain, e) {
  updateCursor(domain, e);

  // Toolbar mode, or the original desktop keyboard modifiers
  var isWholeLayerShift =
    editMode === EditMode.Move || (e.shiftKey && e.ctrlKey);
  var isFlat = editMode === EditMode.Flat || e.ctrlKey;
  var isShiftKeyPressed = e.shiftKey;

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

  if (!wasWholeLayerShift && isFlat) {
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
          SMOOTH_WIN
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
