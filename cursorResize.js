// ═══════════════════════════════════════════════════════════════
//  SIRH-Doc  cursorResize.js  v3
//  Gestionnaire d'images style Microsoft Word — version unifiée
//  • 8 poignées de redimensionnement (position:absolute dans le wrap)
//  • Toolbar flottante avec inputs W/H en mm + alignement + %
//  • Taille à l'import (px / mm / cm / %)
//  • Ratio lock · badge taille · menu contextuel style Word
//  • Curseurs de tableau
//  NOTE : wordImageManager.js ne doit PAS être chargé simultanément
// ═══════════════════════════════════════════════════════════════

(function (global) {
  "use strict";

  /* ──────────────────────────────────────────────────────────
     CONSTANTES
  ────────────────────────────────────────────────────────── */
  const MM_TO_PX = 96 / 25.4;
  const PX_TO_MM = 25.4 / 96;
  const MIN_W = 20;
  const MIN_H = 15;

  /* ──────────────────────────────────────────────────────────
     CSS GLOBAL
  ────────────────────────────────────────────────────────── */
  function injectCSS() {
    if (document.getElementById("sirh-cr-css")) return;
    const s = document.createElement("style");
    s.id = "sirh-cr-css";
    s.textContent = [
      ".ProseMirror{cursor:text!important}",
      ".sirh-img-wrap{display:inline-block;position:relative;line-height:0;user-select:none;max-width:100%;cursor:grab!important;box-sizing:border-box}",
      ".sirh-img-wrap:active{cursor:grabbing!important}",
      ".sirh-img-wrap img{display:block;max-width:100%;height:auto;pointer-events:none}",
      ".sirh-img-wrap img.sirh-sized{max-width:none!important}",
      /* Cadre sélection */
      ".sirh-sel-frame{position:absolute;inset:-2px;border:2px solid #2563eb;border-radius:1px;pointer-events:none;z-index:5;box-shadow:0 0 0 1px rgba(37,99,235,.18);display:none}",
      ".sirh-img-wrap.sirh-selected .sirh-sel-frame{display:block}",
      /* Poignées */
      ".sirh-handle{position:absolute;width:9px;height:9px;background:#fff;border:1.5px solid #2563eb;border-radius:2px;z-index:20;box-shadow:0 0 0 1.5px rgba(37,99,235,.22),0 1px 3px rgba(0,0,0,.16);opacity:0;transition:opacity .1s,transform .1s,background .1s;box-sizing:border-box}",
      ".sirh-img-wrap.sirh-selected .sirh-handle{opacity:1}",
      ".sirh-handle:hover{transform:scale(1.4);background:#2563eb}",
      ".sirh-handle[data-d=nw]{top:-5px;left:-5px;cursor:nw-resize}",
      ".sirh-handle[data-d=n]{top:-5px;left:calc(50% - 4.5px);cursor:n-resize}",
      ".sirh-handle[data-d=ne]{top:-5px;right:-5px;cursor:ne-resize}",
      ".sirh-handle[data-d=e]{top:calc(50% - 4.5px);right:-5px;cursor:e-resize}",
      ".sirh-handle[data-d=se]{bottom:-5px;right:-5px;cursor:se-resize}",
      ".sirh-handle[data-d=s]{bottom:-5px;left:calc(50% - 4.5px);cursor:s-resize}",
      ".sirh-handle[data-d=sw]{bottom:-5px;left:-5px;cursor:sw-resize}",
      ".sirh-handle[data-d=w]{top:calc(50% - 4.5px);left:-5px;cursor:w-resize}",
      /* Badge taille */
      ".sirh-size-badge{position:absolute;bottom:6px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.75);color:#fff;font-size:9px;font-family:'IBM Plex Mono',monospace;padding:3px 9px;border-radius:4px;white-space:nowrap;pointer-events:none;display:none;z-index:30;letter-spacing:.02em}",
      ".sirh-img-wrap.sirh-resizing .sirh-size-badge{display:block}",
      /* Curseurs resize body */
      "body.sirh-cur-nw *{cursor:nw-resize!important}",
      "body.sirh-cur-n *{cursor:n-resize!important}",
      "body.sirh-cur-ne *{cursor:ne-resize!important}",
      "body.sirh-cur-e *{cursor:e-resize!important}",
      "body.sirh-cur-se *{cursor:se-resize!important}",
      "body.sirh-cur-s *{cursor:s-resize!important}",
      "body.sirh-cur-sw *{cursor:sw-resize!important}",
      "body.sirh-cur-w *{cursor:w-resize!important}",
      "body.sirh-dragging *{cursor:grabbing!important}",
      /* Toolbar */
      ".sirh-img-toolbar{position:fixed;z-index:9500;background:#1a1d2e;border-radius:10px;padding:5px 8px;display:none;align-items:center;gap:2px;box-shadow:0 8px 32px rgba(0,0,0,.4),0 0 0 1px rgba(255,255,255,.07);white-space:nowrap;pointer-events:auto;font-family:'IBM Plex Sans',sans-serif;user-select:none}",
      ".sirh-img-toolbar.sirh-tb-visible{display:flex}",
      ".sirh-tb-btn{display:flex;align-items:center;justify-content:center;height:28px;padding:0 7px;gap:3px;border:none;background:transparent;border-radius:5px;cursor:pointer;color:rgba(255,255,255,.82);font-size:11px;font-weight:600;font-family:inherit;flex-shrink:0;transition:background .1s,color .1s}",
      ".sirh-tb-btn:hover{background:rgba(255,255,255,.13);color:#fff}",
      ".sirh-tb-btn.sirh-active{background:rgba(37,99,235,.55);color:#fff}",
      ".sirh-tb-btn.sirh-danger{color:#f87171}",
      ".sirh-tb-btn.sirh-danger:hover{background:rgba(220,38,38,.45);color:#fff}",
      ".sirh-tb-btn svg{pointer-events:none;flex-shrink:0}",
      ".sirh-tb-sep{width:1px;height:18px;background:rgba(255,255,255,.15);margin:0 3px;flex-shrink:0}",
      ".sirh-tb-input{width:52px;height:24px;padding:0 5px;border:1px solid rgba(255,255,255,.18);border-radius:4px;background:rgba(255,255,255,.07);color:#fff;font-size:11px;font-family:inherit;outline:none;text-align:center;transition:border-color .1s,background .1s;-moz-appearance:textfield}",
      ".sirh-tb-input::-webkit-inner-spin-button,.sirh-tb-input::-webkit-outer-spin-button{-webkit-appearance:none}",
      ".sirh-tb-input:focus{border-color:rgba(37,99,235,.7);background:rgba(37,99,235,.18)}",
      ".sirh-tb-label{font-size:9px;color:rgba(255,255,255,.38);font-weight:700;letter-spacing:.08em;flex-shrink:0}",
      ".sirh-tb-unit{font-size:9px;color:rgba(255,255,255,.45);flex-shrink:0;margin-left:1px}",
      /* Menu contextuel */
      ".sirh-ctx-menu{position:fixed;background:#fff;border:1px solid #d1d5db;border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.18);z-index:9800;min-width:200px;padding:4px 0;display:none;font-family:'IBM Plex Sans',sans-serif;font-size:13px}",
      ".sirh-ctx-menu.visible{display:block}",
      ".sirh-ctx-menu-sep{height:1px;background:#e5e7eb;margin:4px 0}",
      ".sirh-ctx-menu-item{padding:7px 16px;cursor:pointer;display:flex;align-items:center;gap:10px;color:#1f2937;transition:background-color .1s;user-select:none}",
      ".sirh-ctx-menu-item:hover{background:#f3f4f6}",
      ".sirh-ctx-menu-item.checked{font-weight:600;color:#2563eb}",
      ".sirh-ctx-menu-item.danger{color:#dc2626}",
      ".sirh-ctx-menu-item.danger:hover{background:#fef2f2}",
      ".sirh-ctx-menu-title{padding:4px 16px;font-size:10px;font-weight:700;color:#9ca3af;letter-spacing:.06em;text-transform:uppercase}",
      /* Curseurs tableau */
      ".column-resize-handle{cursor:col-resize!important}",
      ".ProseMirror td,.ProseMirror th{cursor:cell!important}",
      "body.sirh-col-resize *{cursor:col-resize!important}",
      "body.sirh-row-resize *{cursor:row-resize!important}",
    ].join("\n");
    document.head.appendChild(s);
  }

  /* ──────────────────────────────────────────────────────────
     UTILITAIRES
  ────────────────────────────────────────────────────────── */
  function parseSizeToPixels(raw, containerPx) {
    if (!raw) return null;
    const s = String(raw).trim().toLowerCase();
    if (!s || s === "auto") return null;
    let m;
    if ((m = s.match(/^([\d.]+)\s*px$/))) return parseFloat(m[1]);
    if ((m = s.match(/^([\d.]+)\s*mm$/))) return parseFloat(m[1]) * MM_TO_PX;
    if ((m = s.match(/^([\d.]+)\s*cm$/)))
      return parseFloat(m[1]) * 10 * MM_TO_PX;
    if ((m = s.match(/^([\d.]+)\s*%$/))) {
      const container =
        typeof containerPx === "number" && containerPx > 0
          ? containerPx
          : document?.documentElement?.clientWidth || window.innerWidth || 595;
      return (parseFloat(m[1]) / 100) * container;
    }
    if ((m = s.match(/^([\d.]+)$/))) return parseFloat(m[1]);
    return null;
  }

  function pxToMm(px) {
    return Math.round(px * PX_TO_MM * 10) / 10;
  }

  /* ──────────────────────────────────────────────────────────
     ICONS SVG
  ────────────────────────────────────────────────────────── */
  function _svgAlign(dir) {
    const L = {
      left: [
        '<line x1="3" y1="6" x2="21" y2="6"/>',
        '<line x1="3" y1="12" x2="15" y2="12"/>',
        '<line x1="3" y1="18" x2="18" y2="18"/>',
      ],
      center: [
        '<line x1="3" y1="6" x2="21" y2="6"/>',
        '<line x1="6" y1="12" x2="18" y2="12"/>',
        '<line x1="4" y1="18" x2="20" y2="18"/>',
      ],
      right: [
        '<line x1="3" y1="6" x2="21" y2="6"/>',
        '<line x1="9" y1="12" x2="21" y2="12"/>',
        '<line x1="6" y1="18" x2="21" y2="18"/>',
      ],
    };
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${(L[dir] || L.left).join("")}</svg>`;
  }
  function _svgLock(locked) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    el.setAttribute("width", "12");
    el.setAttribute("height", "12");
    el.setAttribute("viewBox", "0 0 14 14");
    el.setAttribute("fill", "none");
    el.setAttribute("stroke", "currentColor");
    el.setAttribute("stroke-width", "1.8");
    const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    r.setAttribute("x", "3");
    r.setAttribute("y", "6");
    r.setAttribute("width", "8");
    r.setAttribute("height", "7");
    r.setAttribute("rx", "1");
    el.appendChild(r);
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute(
      "d",
      locked ? "M5 6V4.5a2 2 0 014 0V6" : "M5 6V4.5a2 2 0 014 0",
    );
    if (!locked) p.setAttribute("stroke-dasharray", "2 1.5");
    el.appendChild(p);
    return el;
  }
  function _svgTrash() {
    return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>`;
  }
  function _mkBtn(content, title, danger, id) {
    const b = document.createElement("button");
    b.className = "sirh-tb-btn" + (danger ? " sirh-danger" : "");
    b.title = title || "";
    b.type = "button";
    if (id) b.dataset.id = id;
    if (typeof content === "string") b.innerHTML = content;
    else if (content instanceof Element) b.appendChild(content);
    return b;
  }
  function _mkSep() {
    const d = document.createElement("div");
    d.className = "sirh-tb-sep";
    return d;
  }

  /* ──────────────────────────────────────────────────────────
     MODULE PRINCIPAL : SirhImgResize
  ────────────────────────────────────────────────────────── */
  const SirhImgResize = (function () {
    let _activeWrap = null;
    let _activeImg = null;
    let _toolbar = null;
    let _ctxMenu = null;

    /* ── Toolbar ── */
    function _getToolbar() {
      if (_toolbar && document.body.contains(_toolbar)) return _toolbar;
      _toolbar = _buildToolbar();
      document.body.appendChild(_toolbar);
      return _toolbar;
    }

    function _buildToolbar() {
      const tb = document.createElement("div");
      tb.className = "sirh-img-toolbar";
      tb.id = "sirhImgToolbar";

      /* Alignement */
      const alignGrp = document.createElement("div");
      alignGrp.style.cssText = "display:flex;gap:2px";
      ["left", "center", "right"].forEach((v) => {
        const b = _mkBtn(
          _svgAlign(v),
          { left: "Gauche", center: "Centré", right: "Droite" }[v],
          false,
          "align-" + v,
        );
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          if (!_activeWrap) return;
          _applyAlign(_activeWrap, v);
          alignGrp
            .querySelectorAll(".sirh-tb-btn")
            .forEach((x) => x.classList.remove("sirh-active"));
          b.classList.add("sirh-active");
          _reposition();
        });
        alignGrp.appendChild(b);
      });
      tb.appendChild(alignGrp);
      tb._alignGrp = alignGrp;
      tb.appendChild(_mkSep());

      /* Largeurs prédéfinies */
      const widthGrp = document.createElement("div");
      widthGrp.style.cssText = "display:flex;gap:2px";
      ["25%", "50%", "75%", "100%"].forEach((pct) => {
        const b = _mkBtn(pct, "Largeur " + pct, false, "w-" + pct);
        b.style.fontSize = "10px";
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          if (!_activeWrap || !_activeImg) return;
          _applyWidthPct(_activeWrap, _activeImg, pct);
          widthGrp
            .querySelectorAll(".sirh-tb-btn")
            .forEach((x) => x.classList.remove("sirh-active"));
          b.classList.add("sirh-active");
          setTimeout(_reposition, 40);
        });
        widthGrp.appendChild(b);
      });
      tb.appendChild(widthGrp);
      tb._widthGrp = widthGrp;
      tb.appendChild(_mkSep());

      /* Verrou ratio */
      const lockBtn = _mkBtn(
        _svgLock(true),
        "Verrouiller le ratio",
        false,
        "lock",
      );
      lockBtn.classList.add("sirh-active");
      lockBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!_activeWrap) return;
        _activeWrap._lockAspect = !_activeWrap._lockAspect;
        lockBtn.innerHTML = "";
        lockBtn.appendChild(_svgLock(_activeWrap._lockAspect));
        lockBtn.classList.toggle("sirh-active", _activeWrap._lockAspect);
      });
      tb._lockBtn = lockBtn;
      tb.appendChild(lockBtn);
      tb.appendChild(_mkSep());

      /* Inputs W / H */
      const sizeGrp = document.createElement("div");
      sizeGrp.style.cssText = "display:flex;align-items:center;gap:4px";

      const wLbl = document.createElement("span");
      wLbl.className = "sirh-tb-label";
      wLbl.textContent = "L";
      const wInp = document.createElement("input");
      wInp.type = "number";
      wInp.min = 2;
      wInp.max = 9999;
      wInp.className = "sirh-tb-input";
      wInp.title = "Largeur en mm";
      const wUnit = document.createElement("span");
      wUnit.className = "sirh-tb-unit";
      wUnit.textContent = "mm";
      const xSp = document.createElement("span");
      xSp.style.cssText =
        "font-size:10px;color:rgba(255,255,255,.3);margin:0 1px";
      xSp.textContent = "×";
      const hLbl = document.createElement("span");
      hLbl.className = "sirh-tb-label";
      hLbl.textContent = "H";
      const hInp = document.createElement("input");
      hInp.type = "number";
      hInp.min = 2;
      hInp.max = 9999;
      hInp.className = "sirh-tb-input";
      hInp.title = "Hauteur en mm";
      const hUnit = document.createElement("span");
      hUnit.className = "sirh-tb-unit";
      hUnit.textContent = "mm";

      sizeGrp.append(wLbl, wInp, wUnit, xSp, hLbl, hInp, hUnit);
      tb._wInp = wInp;
      tb._hInp = hInp;

      /* Appliquer depuis les inputs */
      const _applyFromInputs = (changedW) => {
        if (!_activeWrap || !_activeImg) return;
        const wMm = parseFloat(wInp.value);
        const hMm = parseFloat(hInp.value);
        const wOk = !isNaN(wMm) && wMm >= 2;
        const hOk = !isNaN(hMm) && hMm >= 2;
        if (!wOk && !hOk) return;
        const natW = _activeImg.naturalWidth || _activeImg.offsetWidth || 200;
        const natH = _activeImg.naturalHeight || _activeImg.offsetHeight || 150;
        const asp = natH > 0 ? natW / natH : 1;
        let fW, fH;
        if (changedW) {
          if (!wOk) return;
          fW = wMm * MM_TO_PX;
          fH = _activeWrap._lockAspect
            ? fW / asp
            : hOk
              ? hMm * MM_TO_PX
              : _activeImg.offsetHeight || natH;
        } else {
          if (!hOk) return;
          fH = hMm * MM_TO_PX;
          fW = _activeWrap._lockAspect
            ? fH * asp
            : wOk
              ? wMm * MM_TO_PX
              : _activeImg.offsetWidth || natW;
        }
        _setImgSize(_activeWrap, _activeImg, fW, fH);
        _syncInputs();
        _reposition();
      };

      const _sp = (e) => e.stopPropagation();
      [wInp, hInp].forEach((inp) => {
        inp.addEventListener("mousedown", _sp);
        inp.addEventListener("click", _sp);
        inp.addEventListener("keydown", (e) => {
          e.stopPropagation();
          if (e.key === "Enter") _applyFromInputs(inp === wInp);
        });
      });
      wInp.addEventListener("change", () => _applyFromInputs(true));
      hInp.addEventListener("change", () => _applyFromInputs(false));

      tb.appendChild(sizeGrp);
      tb.appendChild(_mkSep());

      /* Supprimer */
      const delBtn = _mkBtn(_svgTrash(), "Supprimer l'image", true, "del");
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        _removeActive();
      });
      tb.appendChild(delBtn);

      tb.addEventListener("mousedown", (e) => e.stopPropagation());
      return tb;
    }

    /* ── Sync inputs ── */
    function _syncInputs() {
      const tb = _toolbar;
      if (!tb || !_activeImg) return;
      function _do() {
        const wPx = _activeImg.offsetWidth || _activeImg.naturalWidth || 0;
        const hPx = _activeImg.offsetHeight || _activeImg.naturalHeight || 0;
        if (tb._wInp)
          tb._wInp.value = wPx > 0 ? Math.round(pxToMm(wPx) * 10) / 10 : "";
        if (tb._hInp)
          tb._hInp.value = hPx > 0 ? Math.round(pxToMm(hPx) * 10) / 10 : "";
      }
      if (_activeImg.offsetWidth > 0) {
        _do();
        return;
      }
      if (_activeImg.complete && _activeImg.naturalWidth > 0) {
        _do();
        return;
      }
      const onLoad = () => {
        _do();
        _activeImg.removeEventListener("load", onLoad);
      };
      _activeImg.addEventListener("load", onLoad);
      let att = 0;
      const iv = setInterval(() => {
        if (_activeImg.offsetWidth > 0 || _activeImg.naturalWidth > 0) {
          _do();
          clearInterval(iv);
          _activeImg.removeEventListener("load", onLoad);
        } else if (++att >= 20) {
          _do();
          clearInterval(iv);
          _activeImg.removeEventListener("load", onLoad);
        }
      }, 80);
    }

    function _syncToolbarState() {
      const tb = _toolbar;
      if (!tb || !_activeWrap || !_activeImg) return;
      if (tb._lockBtn) {
        tb._lockBtn.innerHTML = "";
        tb._lockBtn.appendChild(_svgLock(_activeWrap._lockAspect !== false));
        tb._lockBtn.classList.toggle(
          "sirh-active",
          _activeWrap._lockAspect !== false,
        );
      }
      const ag = tb._alignGrp;
      if (ag) {
        const fl = _activeWrap.style.float;
        const ml = _activeWrap.style.marginLeft === "auto";
        const mr = _activeWrap.style.marginRight === "auto";
        let cur = "left";
        if (fl === "right") cur = "right";
        else if (!fl || fl === "none") {
          if (ml && mr) cur = "center";
        }
        ag.querySelectorAll(".sirh-tb-btn").forEach((b) =>
          b.classList.toggle("sirh-active", b.dataset.id === "align-" + cur),
        );
      }
      _syncInputs();
    }

    /* ── Repositionnement ── */
    function _reposition() {
      const tb = _toolbar;
      if (!tb || !_activeWrap || !tb.classList.contains("sirh-tb-visible"))
        return;
      const rect = _activeWrap.getBoundingClientRect();
      const tbR = tb.getBoundingClientRect();
      const tbW = tbR.width || 520,
        tbH = tbR.height || 44;
      let left = rect.left + rect.width / 2 - tbW / 2;
      let top = rect.top - tbH - 8;
      left = Math.max(6, Math.min(left, window.innerWidth - tbW - 6));
      if (top < 4) top = rect.bottom + 8;
      tb.style.left = left + "px";
      tb.style.top = top + "px";
      _syncInputs();
    }

    /* ── Appliquer taille px ── */
    function _setImgSize(wrap, img, wPx, hPx) {
      wPx = Math.max(MIN_W, Math.round(wPx));
      hPx = Math.max(MIN_H, Math.round(hPx));
      img.style.width = wPx + "px";
      img.style.height = hPx + "px";
      img.classList.add("sirh-sized");
      wrap.style.width = wPx + "px";
      wrap.dataset.sirhW = wPx;
      wrap.dataset.sirhH = hPx;
    }

    /* ── Alignement ── */
    function _applyAlign(wrap, align) {
      wrap.style.float = "none";
      wrap.style.marginLeft =
        wrap.style.marginRight =
        wrap.style.marginBottom =
          "";
      wrap.style.display = "";
      if (align === "left") {
        wrap.style.float = "left";
        wrap.style.marginRight = "10px";
        wrap.style.marginBottom = "6px";
      } else if (align === "right") {
        wrap.style.float = "right";
        wrap.style.marginLeft = "10px";
        wrap.style.marginBottom = "6px";
      } else {
        wrap.style.display = "block";
        wrap.style.marginLeft = wrap.style.marginRight = "auto";
      }
      wrap.dataset.sirhAlign = align;
    }

    /* ── Largeur % ── */
    function _applyWidthPct(wrap, img, pct) {
      wrap.style.float = "none";
      wrap.style.display = "block";
      wrap.style.marginLeft = wrap.style.marginRight = "auto";
      wrap.style.width = pct;
      img.style.width = "100%";
      img.style.height = "auto";
      img.classList.remove("sirh-sized");
      delete wrap.dataset.sirhW;
      delete wrap.dataset.sirhH;
    }

    /* ── Sélection ── */
    function _select(wrap, img) {
      if (_activeWrap && _activeWrap !== wrap)
        _activeWrap.classList.remove("sirh-selected");
      _activeWrap = wrap;
      _activeImg = img;
      global._activeResizeImg = wrap;
      global._activeResizeImgEl = img;
      wrap.classList.add("sirh-selected");
      if (wrap._lockAspect === undefined) wrap._lockAspect = true;
      const tb = _getToolbar();
      tb.classList.add("sirh-tb-visible");
      _syncToolbarState();
      requestAnimationFrame(() => {
        _reposition();
        requestAnimationFrame(_reposition);
      });
    }

    function _deselect() {
      if (_activeWrap) _activeWrap.classList.remove("sirh-selected");
      if (_toolbar) _toolbar.classList.remove("sirh-tb-visible");
      _activeWrap = _activeImg = null;
      global._activeResizeImg = global._activeResizeImgEl = null;
    }

    function _removeActive() {
      if (!_activeWrap) return;
      _activeWrap.remove();
      _deselect();
    }

    /* ── Redimensionnement — logique correcte ── */
    function _startResize(e, wrap, img, badge, dir, editor) {
      e.preventDefault();
      e.stopPropagation();
      _select(wrap, img);

      const sx = e.clientX,
        sy = e.clientY;
      /* IMPORTANT: lire offsetWidth/Height qui reflète le CSS déjà appliqué */
      const sw = img.offsetWidth || img.naturalWidth || 100;
      const sh = img.offsetHeight || img.naturalHeight || 100;
      const asp = sh > 0 ? sw / sh : 1;

      document.body.classList.add("sirh-cur-" + dir);
      wrap.classList.add("sirh-resizing");
      if (badge) badge.style.display = "block";
      if (_toolbar) _toolbar.classList.remove("sirh-tb-visible");

      function onMove(ev) {
        const dx = ev.clientX - sx;
        const dy = ev.clientY - sy;
        let nw = sw,
          nh = sh;

        /* Calcul des nouvelles dimensions selon la poignée active */
        if (dir.includes("e")) nw = Math.max(MIN_W, sw + dx);
        if (dir.includes("w")) nw = Math.max(MIN_W, sw - dx);
        if (dir.includes("s")) nh = Math.max(MIN_H, sh + dy);
        if (dir.includes("n")) nh = Math.max(MIN_H, sh - dy);

        /* Ratio lock — logique unifiée (pas de double switch) */
        if (wrap._lockAspect !== false) {
          const hasH = dir.includes("e") || dir.includes("w");
          const hasV = dir.includes("n") || dir.includes("s");
          if (hasH && hasV) {
            /* Coin diagonal : prendre le plus grand facteur d'échelle */
            const sc = Math.max(nw / sw, nh / sh);
            nw = Math.max(MIN_W, Math.round(sw * sc));
            nh = Math.max(MIN_H, Math.round(sh * sc));
          } else if (hasH) {
            /* Poignée latérale : hauteur calculée depuis la largeur */
            nh = Math.max(MIN_H, Math.round(nw / asp));
          } else {
            /* Poignée verticale : largeur calculée depuis la hauteur */
            nw = Math.max(MIN_W, Math.round(nh * asp));
          }
        }

        nw = Math.round(nw);
        nh = Math.round(nh);
        img.style.width = nw + "px";
        img.style.height = nh + "px";
        img.classList.add("sirh-sized");
        wrap.style.width = nw + "px";

        if (badge)
          badge.textContent = `${nw}×${nh} px  (${pxToMm(nw).toFixed(1)}×${pxToMm(nh).toFixed(1)} mm)`;
      }

      function onUp() {
        [
          "sirh-cur-nw",
          "sirh-cur-n",
          "sirh-cur-ne",
          "sirh-cur-e",
          "sirh-cur-se",
          "sirh-cur-s",
          "sirh-cur-sw",
          "sirh-cur-w",
        ].forEach((c) => document.body.classList.remove(c));
        wrap.classList.remove("sirh-resizing");
        if (badge) badge.style.display = "none";
        /* Sauvegarder dimensions finales */
        wrap.dataset.sirhW = parseInt(img.style.width) || img.offsetWidth;
        wrap.dataset.sirhH = parseInt(img.style.height) || img.offsetHeight;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        if (_toolbar) {
          _toolbar.classList.add("sirh-tb-visible");
          _syncToolbarState();
          requestAnimationFrame(_reposition);
        }
        try {
          editor?.commands.focus();
        } catch (_) {}
      }

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    }

    /* ── Menu contextuel ── */
    function _getCtxMenu() {
      if (_ctxMenu && document.body.contains(_ctxMenu)) return _ctxMenu;
      _ctxMenu = document.createElement("div");
      _ctxMenu.className = "sirh-ctx-menu";
      _ctxMenu.id = "sirhImgCtxMenu";
      document.body.appendChild(_ctxMenu);
      document.addEventListener("mousedown", (e) => {
        if (!e.target.closest("#sirhImgCtxMenu"))
          _ctxMenu.classList.remove("visible");
      });
      return _ctxMenu;
    }

    function _showCtxMenu(x, y, wrap, img) {
      const menu = _getCtxMenu();
      const align = wrap.dataset.sirhAlign || "left";
      const locked = wrap._lockAspect !== false;
      menu.innerHTML = `
        <div class="sirh-ctx-menu-title">Alignement</div>
        <div class="sirh-ctx-menu-item${align === "left" ? " checked" : ""}" data-a="align-left">◧ Gauche</div>
        <div class="sirh-ctx-menu-item${align === "center" ? " checked" : ""}" data-a="align-center">▣ Centré</div>
        <div class="sirh-ctx-menu-item${align === "right" ? " checked" : ""}" data-a="align-right">▧ Droite</div>
        <div class="sirh-ctx-menu-sep"></div>
        <div class="sirh-ctx-menu-title">Largeur rapide</div>
        <div class="sirh-ctx-menu-item" data-a="size-25">25% de la page</div>
        <div class="sirh-ctx-menu-item" data-a="size-50">50% de la page</div>
        <div class="sirh-ctx-menu-item" data-a="size-75">75% de la page</div>
        <div class="sirh-ctx-menu-item" data-a="size-100">Pleine largeur</div>
        <div class="sirh-ctx-menu-sep"></div>
        <div class="sirh-ctx-menu-item${locked ? " checked" : ""}" data-a="toggle-lock">${locked ? "🔒" : "🔓"} Ratio proportionnel</div>
        <div class="sirh-ctx-menu-sep"></div>
        <div class="sirh-ctx-menu-item danger" data-a="delete">Supprimer l'image</div>
      `;
      menu.querySelectorAll(".sirh-ctx-menu-item").forEach((item) => {
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          const a = item.dataset.a;
          if (a === "align-left") {
            _applyAlign(wrap, "left");
            _syncToolbarState();
          }
          if (a === "align-center") {
            _applyAlign(wrap, "center");
            _syncToolbarState();
          }
          if (a === "align-right") {
            _applyAlign(wrap, "right");
            _syncToolbarState();
          }
          if (a === "size-25") _applyWidthPct(wrap, img, "25%");
          if (a === "size-50") _applyWidthPct(wrap, img, "50%");
          if (a === "size-75") _applyWidthPct(wrap, img, "75%");
          if (a === "size-100") _applyWidthPct(wrap, img, "100%");
          if (a === "toggle-lock") {
            wrap._lockAspect = !wrap._lockAspect;
            _syncToolbarState();
          }
          if (a === "delete") {
            wrap.remove();
            _deselect();
          }
          menu.classList.remove("visible");
          _reposition();
        });
      });
      menu.style.left = x + "px";
      menu.style.top = y + "px";
      menu.classList.add("visible");
      requestAnimationFrame(() => {
        const r = menu.getBoundingClientRect();
        if (r.right > window.innerWidth - 8)
          menu.style.left = x - r.width + "px";
        if (r.bottom > window.innerHeight - 8)
          menu.style.top = y - r.height + "px";
      });
    }

    /* ── Wrapping ── */
    function wrapImage(img, editor) {
      if (img.dataset.sirhWrapped) return img.closest(".sirh-img-wrap") || null;
      if (img.closest(".sirh-img-wrap")) {
        img.dataset.sirhWrapped = "1";
        return img.closest(".sirh-img-wrap");
      }
      img.dataset.sirhWrapped = "1";

      const wrap = document.createElement("span");
      wrap.className = "sirh-img-wrap";
      wrap._lockAspect = true;

      /* Conserver la taille existante */
      const exW = img.style.width || img.getAttribute("width");
      const exH = img.style.height || img.getAttribute("height");
      if (exW) wrap.style.width = typeof exW === "number" ? exW + "px" : exW;

      img.parentNode.insertBefore(wrap, img);
      wrap.appendChild(img);
      img.style.display = "block";
      if (!exW) img.style.maxWidth = "100%";

      /* Cadre de sélection */
      const selFrame = document.createElement("div");
      selFrame.className = "sirh-sel-frame";
      wrap.appendChild(selFrame);

      /* Badge taille */
      const badge = document.createElement("div");
      badge.className = "sirh-size-badge";
      wrap.appendChild(badge);

      /* 8 poignées */
      ["nw", "n", "ne", "e", "se", "s", "sw", "w"].forEach((dir) => {
        const h = document.createElement("span");
        h.className = "sirh-handle";
        h.dataset.d = dir;
        h.addEventListener("mousedown", (e) =>
          _startResize(e, wrap, img, badge, dir, editor),
        );
        wrap.appendChild(h);
      });

      /* Clic → sélectionner */
      wrap.addEventListener("mousedown", (e) => {
        if (e.target.classList.contains("sirh-handle")) return;
        e.stopPropagation();
        _select(wrap, img);
      });

      /* Clic droit → menu contextuel */
      wrap.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        _select(wrap, img);
        _showCtxMenu(e.clientX, e.clientY, wrap, img);
      });

      return wrap;
    }

    return {
      wrap: wrapImage,
      select: _select,
      deselect: _deselect,
      reposition: _reposition,
      setSize: _setImgSize,
      applyAlign: _applyAlign,
      applyWidthPct: _applyWidthPct,
      removeActive: _removeActive,
      syncInputs: _syncInputs,
      get activeWrap() {
        return _activeWrap;
      },
      get activeImg() {
        return _activeImg;
      },
    };
  })();

  /* ──────────────────────────────────────────────────────────
     TABLE RESIZE CURSORS
  ────────────────────────────────────────────────────────── */
  const SirhTableResize = (function () {
    const COL_T = 7,
      ROW_T = 7;
    let _resizing = false;
    function onMove(e) {
      if (_resizing) return;
      if (e.target?.classList?.contains("column-resize-handle")) {
        document.body.classList.add("sirh-col-resize");
        return;
      }
      const td = e.target?.closest?.("td, th");
      if (!td) {
        document.body.classList.remove("sirh-col-resize", "sirh-row-resize");
        return;
      }
      const r = td.getBoundingClientRect();
      const x = e.clientX,
        y = e.clientY;
      if (Math.abs(x - r.right) <= COL_T || Math.abs(x - r.left) <= COL_T) {
        document.body.classList.add("sirh-col-resize");
        document.body.classList.remove("sirh-row-resize");
      } else if (
        Math.abs(y - r.bottom) <= ROW_T ||
        Math.abs(y - r.top) <= ROW_T
      ) {
        document.body.classList.add("sirh-row-resize");
        document.body.classList.remove("sirh-col-resize");
      } else {
        document.body.classList.remove("sirh-col-resize", "sirh-row-resize");
      }
    }
    function onDown(e) {
      if (e.target?.classList?.contains("column-resize-handle")) {
        _resizing = true;
        document.body.classList.add("sirh-col-resize");
        document.addEventListener(
          "mouseup",
          () => {
            _resizing = false;
            document.body.classList.remove("sirh-col-resize");
          },
          { once: true },
        );
      }
    }
    return {
      init() {
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mousedown", onDown);
      },
    };
  })();

  /* ──────────────────────────────────────────────────────────
     PATCH FONCTIONS GLOBALES admin.html
  ────────────────────────────────────────────────────────── */
  function _patchAdminFunctions() {
    global.activateImageResizers = function (ed) {
      if (!ed) return;
      ed.view.dom
        .querySelectorAll("img:not([data-sirh-wrapped])")
        .forEach((img) => {
          if (!img.closest(".sirh-img-wrap")) SirhImgResize.wrap(img, ed);
        });
    };

    global.wrapImgResize = function (img, ed) {
      SirhImgResize.wrap(img, ed);
    };
    global.positionImgToolbar = function () {
      SirhImgResize.reposition();
    };
    global.selectImg = function (wrap, img) {
      if (wrap && img) SirhImgResize.select(wrap, img);
    };

    global.setImgAlign = function (btn, align) {
      const wrap = SirhImgResize.activeWrap;
      if (wrap) SirhImgResize.applyAlign(wrap, align);
    };

    global.setImgWidthFixed = function (btn, pct) {
      const wrap = SirhImgResize.activeWrap;
      const img = SirhImgResize.activeImg;
      if (wrap && img) SirhImgResize.applyWidthPct(wrap, img, pct);
    };

    global.removeImgFixed = function () {
      SirhImgResize.removeActive();
    };

    /* _getImgAlign — simple assignation (pas d'Object.defineProperty non-writable) */
    global._getImgAlign = function () {
      const checked = document.querySelector(
        'input[name="img-align-r"]:checked',
      );
      if (checked) return checked.value;
      return document.getElementById("img-align")?.value || "center";
    };

    /* ══════════════════════════════════════════════
       doInsertImage — insertion complète avec taille
       Gère : px, mm, cm, %, pas de taille (natif)
    ══════════════════════════════════════════════ */
    global.doInsertImage = function () {
      const ed = global.__getActiveEditor
        ? global.__getActiveEditor()
        : global.activeEditor || null;
      if (!ed) {
        if (typeof toast === "function") toast("Aucun éditeur actif", "error");
        return;
      }

      const fileInput = document.getElementById("img-file");
      const urlInput = document.getElementById("img-url");
      const wInput = document.getElementById("img-w");
      const hInput = document.getElementById("img-h");
      const capInput = document.getElementById("img-caption");

      const rawW = (wInput?.value || "").trim();
      const rawH = (hInput?.value || "").trim();
      const align =
        typeof global._getImgAlign === "function"
          ? global._getImgAlign()
          : "center";
      const cap = (capInput?.value || "").trim();

      function _resetModal() {
        document.getElementById("modalImage")?.classList.remove("open");
        if (fileInput) fileInput.value = "";
        if (urlInput) urlInput.value = "";
        if (wInput) wInput.value = "";
        if (hInput) hInput.value = "";
        const pa = document.getElementById("img-preview-area");
        if (pa) pa.style.display = "none";
      }

      function _applyDimensions(wrap, img) {
        const containerW = ed.view.dom ? ed.view.dom.offsetWidth : 595;
        const wPx = parseSizeToPixels(rawW, containerW);
        const hPx = parseSizeToPixels(rawH, containerW);

        function _doSize() {
          const natW = img.naturalWidth || img.offsetWidth || 200;
          const natH = img.naturalHeight || img.offsetHeight || 150;
          const asp = natH > 0 ? natW / natH : 1;
          let fW, fH;

          if (wPx !== null && hPx !== null) {
            fW = wPx;
            fH = hPx;
          } else if (wPx !== null) {
            fW = wPx;
            fH = wPx / asp;
          } else if (hPx !== null) {
            fH = hPx;
            fW = hPx * asp;
          } else {
            /* Pas de taille : limiter à la largeur du conteneur si l'image est trop grande */
            if (natW > containerW) {
              fW = containerW;
              fH = containerW / asp;
            } else {
              fW = natW;
              fH = natH;
            }
          }

          SirhImgResize.setSize(wrap, img, fW, fH);
          SirhImgResize.select(wrap, img);
        }

        if (img.complete && img.naturalWidth > 0) {
          _doSize();
        } else {
          img.addEventListener("load", _doSize, { once: true });
          let att = 0;
          const iv = setInterval(() => {
            if (img.naturalWidth > 0 || img.offsetWidth > 0) {
              clearInterval(iv);
              _doSize();
            } else if (++att >= 20) {
              clearInterval(iv);
              _doSize();
            }
          }, 80);
        }

        SirhImgResize.applyAlign(wrap, align);
      }

      function _insertSrc(src) {
        const uid =
          "sirh-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);

        ed.chain()
          .focus()
          .setImage({ src, alt: uid, title: cap || "" })
          .run();

        function _findAndWrap(attempt) {
          const allImgs = ed.view.dom.querySelectorAll(
            "img:not([data-sirh-wrapped])",
          );
          let target = null;

          // 1) D'abord l'image nouvellement insérée via UID (unique)
          for (const img of allImgs) {
            if (img.alt === uid) {
              target = img;
              break;
            }
          }

          // 2) Ensuite, la même source si UID non trouvé
          if (!target) {
            for (const img of allImgs) {
              if (img.src === src || img.getAttribute("src") === src) {
                target = img;
                break;
              }
            }
          }

          // 3) Dernier recours : dernier élément non wrappé
          if (!target && allImgs.length > 0)
            target = allImgs[allImgs.length - 1];

          if (target) {
            const wrap = SirhImgResize.wrap(target, ed);
            if (wrap) _applyDimensions(wrap, target);
            if (cap) target.alt = cap;
            else if (target.alt === uid) target.alt = "";
          } else if (attempt < 12) {
            setTimeout(() => _findAndWrap(attempt + 1), 80);
          }
        }

        setTimeout(() => _findAndWrap(0), 60);
        _resetModal();
        if (typeof toast === "function") toast("Image insérée", "success");
      }

      if (fileInput?.files[0]) {
        const r = new FileReader();
        r.onload = (ev) => _insertSrc(ev.target.result);
        r.readAsDataURL(fileInput.files[0]);
      } else if (urlInput?.value?.trim()) {
        _insertSrc(urlInput.value.trim());
      } else {
        if (typeof toast === "function")
          toast("Sélectionnez un fichier ou entrez une URL", "error");
      }
    };
  }

  /* ──────────────────────────────────────────────────────────
     LISTENER GLOBAL
  ────────────────────────────────────────────────────────── */
  function _bindGlobalDeselect() {
    document.addEventListener("mousedown", (e) => {
      if (
        !e.target.closest(".sirh-img-wrap") &&
        !e.target.closest("#sirhImgToolbar") &&
        !e.target.closest("#sirhImgCtxMenu")
      ) {
        SirhImgResize.deselect();
      }
    });
    document.addEventListener("scroll", () => SirhImgResize.reposition(), {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", () => SirhImgResize.reposition());
  }

  /* ──────────────────────────────────────────────────────────
     INIT
  ────────────────────────────────────────────────────────── */
  function _init() {
    injectCSS();
    SirhTableResize.init();
    _patchAdminFunctions();
    _bindGlobalDeselect();
    global.SirhImgResize = SirhImgResize;
    global.parseSizeToPixels = parseSizeToPixels;
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", _init);
  else _init();
})(window);
