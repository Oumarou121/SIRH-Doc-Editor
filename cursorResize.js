// ═══════════════════════════════════════════════════════════════
//  SIRH-Doc  cursor-resize.js  v1
//  Module d'amélioration des curseurs et du redimensionnement
//  Compatible avec admin.html sans casser la logique existante.
//
//  INCLURE après shared.js :
//    <script src="shared.js"></script>
//    <script src="cursor-resize.js"></script>
//
//  Ce module :
//  1. Injecte les curseurs contextuels (SirhCursor)
//  2. Améliore le redimensionnement d'images (SirhImgResize)
//  3. Gère les curseurs col/row resize des tableaux (SirhTableResize)
//  4. Expose window.SirhImgResize pour usage dans le module Tiptap
// ═══════════════════════════════════════════════════════════════

(function (global) {
  "use strict";

  // ─────────────────────────────────────────────────────────────
  //  SirhCursor — gestion globale des curseurs contextuels
  // ─────────────────────────────────────────────────────────────
  const SirhCursor = (function () {
    const CSS_ID = "sirh-cursor-css";

    function _inject() {
      if (document.getElementById(CSS_ID)) return;
      const s = document.createElement("style");
      s.id = CSS_ID;
      s.textContent = `
        /* ── Éditeur texte ── */
        .ProseMirror { cursor: text !important; }

        /* ── Image wrap : grab/grabbing ── */
        .img-resize-wrap             { cursor: grab    !important; }
        .img-resize-wrap:active      { cursor: grabbing!important; }
        .img-resize-wrap.selected    { cursor: grab    !important; }
        .img-resize-wrap.selected:active { cursor: grabbing !important; }

        /* ── Poignées de redimensionnement ── */
        .img-handle.nw { cursor: nw-resize !important; }
        .img-handle.n  { cursor: n-resize  !important; }
        .img-handle.ne { cursor: ne-resize !important; }
        .img-handle.e  { cursor: e-resize  !important; }
        .img-handle.se { cursor: se-resize !important; }
        .img-handle.s  { cursor: s-resize  !important; }
        .img-handle.sw { cursor: sw-resize !important; }
        .img-handle.w  { cursor: w-resize  !important; }

        /* ── Resize actif : override tout ── */
        body.sirh-resizing      { cursor: default  !important; }
        body.sirh-resizing *    { cursor: inherit  !important; }
        body.sirh-cur-nw,  body.sirh-cur-nw  * { cursor: nw-resize !important; }
        body.sirh-cur-n,   body.sirh-cur-n   * { cursor: n-resize  !important; }
        body.sirh-cur-ne,  body.sirh-cur-ne  * { cursor: ne-resize !important; }
        body.sirh-cur-e,   body.sirh-cur-e   * { cursor: e-resize  !important; }
        body.sirh-cur-se,  body.sirh-cur-se  * { cursor: se-resize !important; }
        body.sirh-cur-s,   body.sirh-cur-s   * { cursor: s-resize  !important; }
        body.sirh-cur-sw,  body.sirh-cur-sw  * { cursor: sw-resize !important; }
        body.sirh-cur-w,   body.sirh-cur-w   * { cursor: w-resize  !important; }

        /* ── Drag image ── */
        body.sirh-dragging   { cursor: grabbing !important; }
        body.sirh-dragging * { cursor: grabbing !important; }

        /* ── Redimensionnement colonnes/lignes tableau ── */
        body.sirh-col-resize,  body.sirh-col-resize  * { cursor: col-resize !important; }
        body.sirh-row-resize,  body.sirh-row-resize  * { cursor: row-resize !important; }

        /* ── Tiptap table handles ── */
        .column-resize-handle   { cursor: col-resize !important; }
        .ProseMirror td,
        .ProseMirror th         { cursor: cell !important; }

        /* ── Toolbar ── */
        .tb-btn                 { cursor: pointer    !important; }
        .tb-btn:disabled        { cursor: not-allowed!important; }
        .tbl-tb-btn             { cursor: pointer    !important; }

        /* ── Sidebar ── */
        .vchip                  { cursor: copy       !important; }
        .tpl-item               { cursor: pointer    !important; }
        .tpl-add                { cursor: pointer    !important; }
        .tpl-del                { cursor: pointer    !important; }

        /* ── Selects ── */
        .famsel, .tb-sel, select { cursor: pointer   !important; }

        /* ── Swatches ── */
        .cswatch, .tbl-clr-sw   { cursor: pointer    !important; }

        /* ── Panning canvas ── */
        .pcanvas.panning        { cursor: grabbing   !important; }

        /* ── Modal fermeture ── */
        .mclose                 { cursor: pointer    !important; }

        /* ── Toolbar image flottante ── */
        .sirh-img-floattb       { user-select: none; }
        .sirh-img-floattb button { cursor: pointer   !important; }
        .sirh-img-floattb input  { cursor: text      !important; }

        /* ── Handles visibles seulement quand sélectionné ── */
        .img-resize-wrap .img-handle { opacity: 0; transition: opacity .1s; }
        .img-resize-wrap.selected .img-handle { opacity: 1; }

        /* ── Cadre de sélection ── */
        .sirh-sel-frame {
          position: absolute;
          inset: -2px;
          border: 2px solid #2563eb;
          border-radius: 1px;
          pointer-events: none;
          display: none;
          z-index: 5;
          box-shadow: 0 0 0 1px rgba(37,99,235,.2);
        }
        .img-resize-wrap.selected .sirh-sel-frame { display: block; }

        /* ── Taille badge pendant resize ── */
        .sirh-size-badge {
          position: absolute;
          bottom: 8px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0,0,0,.78);
          color: #fff;
          font-size: 9px;
          font-family: 'IBM Plex Mono', monospace;
          padding: 3px 9px;
          border-radius: 4px;
          white-space: nowrap;
          pointer-events: none;
          display: none;
          z-index: 30;
          letter-spacing: .02em;
        }
        .img-resize-wrap.resizing .sirh-size-badge { display: block; }
      `;
      document.head.appendChild(s);
    }

    const _clear = () => {
      const cls = [
        "sirh-resizing",
        "sirh-dragging",
        "sirh-col-resize",
        "sirh-row-resize",
        "sirh-cur-nw",
        "sirh-cur-n",
        "sirh-cur-ne",
        "sirh-cur-e",
        "sirh-cur-se",
        "sirh-cur-s",
        "sirh-cur-sw",
        "sirh-cur-w",
      ];
      cls.forEach((c) => document.body.classList.remove(c));
    };

    return {
      init: _inject,
      startResize(dir) {
        _clear();
        document.body.classList.add("sirh-resizing", "sirh-cur-" + dir);
      },
      stopResize: _clear,
      startDrag() {
        _clear();
        document.body.classList.add("sirh-dragging");
      },
      stopDrag() {
        document.body.classList.remove("sirh-dragging");
      },
      startColResize() {
        _clear();
        document.body.classList.add("sirh-col-resize");
      },
      startRowResize() {
        _clear();
        document.body.classList.add("sirh-row-resize");
      },
      stopTableResize() {
        document.body.classList.remove("sirh-col-resize", "sirh-row-resize");
      },
    };
  })();

  // ─────────────────────────────────────────────────────────────
  //  SirhImgResize — redimensionnement images style Word
  // ─────────────────────────────────────────────────────────────
  const SirhImgResize = (function () {
    let _activeWrap = null;
    let _activeImg = null;

    // ── Barre d'outils flottante ──────────────────────────────
    function _createToolbar(wrapEl, img) {
      const tb = document.createElement("div");
      tb.className = "sirh-img-floattb";
      tb.style.cssText = [
        "position:fixed",
        "z-index:3500",
        "background:#1a1d2e",
        "border-radius:10px",
        "display:none",
        "align-items:center",
        "gap:1px",
        "padding:4px 7px",
        "box-shadow:0 8px 32px rgba(0,0,0,.4),0 0 0 1px rgba(255,255,255,.06)",
        "pointer-events:auto",
        "white-space:nowrap",
        "font-family:'IBM Plex Sans',sans-serif",
      ].join(";");

      const mkBtn = (html, tip, onClick, danger) => {
        const b = document.createElement("button");
        b.title = tip || "";
        b.style.cssText = [
          "display:flex",
          "align-items:center",
          "justify-content:center",
          "height:28px",
          "padding:0 8px",
          "border:none",
          "background:transparent",
          "border-radius:5px",
          "cursor:pointer",
          `color:${danger ? "#f87171" : "rgba(255,255,255,.82)"}`,
          "font-size:11px",
          "font-weight:600",
          "gap:3px",
          "transition:background .1s,color .1s",
          "flex-shrink:0",
        ].join(";");
        b.innerHTML = html;
        b.addEventListener("mouseenter", () => {
          b.style.background = danger
            ? "rgba(220,38,38,.45)"
            : "rgba(255,255,255,.14)";
          if (!danger) b.style.color = "#fff";
        });
        b.addEventListener("mouseleave", () => {
          if (!b._active) {
            b.style.background = "transparent";
            b.style.color = danger ? "#f87171" : "rgba(255,255,255,.82)";
          }
        });
        b.addEventListener("mousedown", (e) => {
          e.stopPropagation();
          e.preventDefault();
        });
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          onClick(b);
        });
        return b;
      };

      const sep = () => {
        const d = document.createElement("div");
        d.style.cssText =
          "width:1px;height:18px;background:rgba(255,255,255,.15);margin:0 3px;flex-shrink:0";
        return d;
      };

      const setActive = (btn, group) => {
        group.querySelectorAll("button").forEach((b) => {
          b.style.background = "transparent";
          b.style.color = "rgba(255,255,255,.82)";
          b._active = false;
        });
        btn.style.background = "rgba(37,99,235,.6)";
        btn.style.color = "#fff";
        btn._active = true;
      };

      // ── Alignement ──
      const alignGrp = document.createElement("div");
      alignGrp.style.cssText = "display:flex;gap:1px";
      const alignMap = [
        { v: "left", icon: "◧", tip: "Aligner à gauche" },
        { v: "center", icon: "▣", tip: "Centrer" },
        { v: "right", icon: "▧", tip: "Aligner à droite" },
      ];
      alignMap.forEach(({ v, icon, tip }) => {
        const b = mkBtn(icon, tip, (el) => {
          _applyAlign(wrapEl, v);
          setActive(el, alignGrp);
          _reposition(wrapEl, img);
        });
        alignGrp.appendChild(b);
      });
      tb.appendChild(alignGrp);
      tb.appendChild(sep());

      // ── Largeurs prédéfinies ──
      const widthGrp = document.createElement("div");
      widthGrp.style.cssText = "display:flex;gap:1px";
      ["25%", "50%", "75%", "100%"].forEach((pct) => {
        const b = mkBtn(pct, "Largeur " + pct, (el) => {
          _applyWidth(wrapEl, img, pct);
          setActive(el, widthGrp);
          _reposition(wrapEl, img);
        });
        widthGrp.appendChild(b);
      });
      tb.appendChild(widthGrp);
      tb.appendChild(sep());

      // ── Verrou ratio ──
      const lockSvgLocked = `<svg viewBox="0 0 14 14" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="8" height="7" rx="1"/><path d="M5 6V4.5a2 2 0 014 0V6"/></svg>`;
      const lockSvgUnlocked = `<svg viewBox="0 0 14 14" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="8" height="7" rx="1"/><path d="M5 6V4.5a2 2 0 014 0" stroke-dasharray="2 1.5"/></svg>`;
      const lockBtn = mkBtn(
        lockSvgLocked + "<span style='font-size:9px'>ratio</span>",
        "Verrouiller le ratio d'aspect",
        (b) => {
          wrapEl._lockAspect = !wrapEl._lockAspect;
          b.innerHTML =
            (wrapEl._lockAspect ? lockSvgLocked : lockSvgUnlocked) +
            "<span style='font-size:9px'>ratio</span>";
          b.style.background = wrapEl._lockAspect
            ? "rgba(37,99,235,.55)"
            : "transparent";
          b.style.color = wrapEl._lockAspect ? "#fff" : "rgba(255,255,255,.82)";
          b._active = wrapEl._lockAspect;
          if (typeof toast === "function")
            toast(
              wrapEl._lockAspect ? "Ratio verrouillé" : "Ratio libre",
              "info",
            );
        },
      );
      wrapEl._lockAspect = true;
      lockBtn.style.background = "rgba(37,99,235,.55)";
      lockBtn.style.color = "#fff";
      lockBtn._active = true;
      tb.appendChild(lockBtn);
      tb.appendChild(sep());

      // ── Inputs taille exacte ──
      const sizeGrp = document.createElement("div");
      sizeGrp.style.cssText = "display:flex;align-items:center;gap:4px";

      const mkLbl = (t) => {
        const l = document.createElement("span");
        l.style.cssText =
          "font-size:9px;color:rgba(255,255,255,.4);font-weight:700;letter-spacing:.08em";
        l.textContent = t;
        return l;
      };

      const mkSizeInput = (onChangeVal) => {
        const inp = document.createElement("input");
        inp.type = "number";
        inp.min = 10;
        inp.max = 9999;
        inp.style.cssText = [
          "width:56px",
          "height:22px",
          "padding:0 5px",
          "border:1px solid rgba(255,255,255,.2)",
          "border-radius:4px",
          "background:rgba(255,255,255,.08)",
          "color:#fff",
          "font-size:11px",
          "outline:none",
          "font-family:inherit",
        ].join(";");
        inp.addEventListener("focus", () => {
          inp.style.borderColor = "rgba(37,99,235,.8)";
          inp.style.background = "rgba(37,99,235,.2)";
        });
        inp.addEventListener("blur", () => {
          inp.style.borderColor = "rgba(255,255,255,.2)";
          inp.style.background = "rgba(255,255,255,.08)";
        });
        inp.addEventListener("mousedown", (e) => e.stopPropagation());
        inp.addEventListener("keydown", (e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            onChangeVal(parseInt(inp.value));
          }
        });
        inp.addEventListener("change", () => onChangeVal(parseInt(inp.value)));
        return inp;
      };

      const wInp = mkSizeInput((val) => {
        if (!val || isNaN(val) || val < 10) return;
        const asp =
          img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : 1;
        img.style.width = val + "px";
        wrapEl.style.width = val + "px";
        if (wrapEl._lockAspect) {
          const nh = Math.round(val / asp);
          img.style.height = nh + "px";
          hInp.value = nh;
        } else {
          img.style.height = "auto";
        }
        _reposition(wrapEl, img);
      });
      const hInp = mkSizeInput((val) => {
        if (!val || isNaN(val) || val < 10) return;
        const asp =
          img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : 1;
        img.style.height = val + "px";
        if (wrapEl._lockAspect) {
          const nw = Math.round(val * asp);
          img.style.width = nw + "px";
          wrapEl.style.width = nw + "px";
          wInp.value = nw;
        }
        _reposition(wrapEl, img);
      });

      tb._wInp = wInp;
      tb._hInp = hInp;

      const xSep = document.createElement("span");
      xSep.style.cssText =
        "font-size:10px;color:rgba(255,255,255,.3);font-weight:400";
      xSep.textContent = "×";

      sizeGrp.appendChild(mkLbl("L"));
      sizeGrp.appendChild(wInp);
      sizeGrp.appendChild(xSep);
      sizeGrp.appendChild(mkLbl("H"));
      sizeGrp.appendChild(hInp);
      tb.appendChild(sizeGrp);
      tb.appendChild(sep());

      // ── Supprimer image ──
      const delBtn = mkBtn(
        `<svg viewBox="0 0 14 14" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="2" y1="2" x2="12" y2="12"/><line x1="12" y1="2" x2="2" y2="12"/></svg>`,
        "Supprimer l'image",
        () => {
          if (img._floatTb) img._floatTb.remove();
          wrapEl.remove();
          if (_activeWrap === wrapEl) {
            _activeWrap = null;
            _activeImg = null;
          }
          // Sync avec les variables globales admin.html
          if (global._activeResizeImg === wrapEl) {
            global._activeResizeImg = null;
            global._activeResizeImgEl = null;
          }
        },
        true,
      );
      tb.appendChild(delBtn);

      document.body.appendChild(tb);
      return tb;
    }

    // ── Repositionnement toolbar ──
    function _reposition(wrapEl, img) {
      const tb = img?._floatTb;
      if (!tb || tb.style.display === "none") return;
      const rect = wrapEl.getBoundingClientRect();
      // Force layout pour avoir offsetWidth correct
      const tbW = tb.getBoundingClientRect().width || 440;
      const left = Math.max(
        8,
        Math.min(
          rect.left + rect.width / 2 - tbW / 2,
          window.innerWidth - tbW - 8,
        ),
      );
      const top = Math.max(4, rect.top - 46);
      tb.style.left = left + "px";
      tb.style.top = top + "px";
      // Mettre à jour inputs
      if (tb._wInp) tb._wInp.value = Math.round(img.offsetWidth) || "";
      if (tb._hInp) tb._hInp.value = Math.round(img.offsetHeight) || "";
    }

    // ── Alignement ──
    function _applyAlign(wrapEl, align) {
      wrapEl.style.float = "none";
      wrapEl.style.marginLeft = "";
      wrapEl.style.marginRight = "";
      wrapEl.style.marginBottom = "";
      wrapEl.style.display = "";
      if (align === "left") {
        wrapEl.style.float = "left";
        wrapEl.style.marginRight = "12px";
        wrapEl.style.marginBottom = "6px";
      } else if (align === "right") {
        wrapEl.style.float = "right";
        wrapEl.style.marginLeft = "12px";
        wrapEl.style.marginBottom = "6px";
      } else {
        wrapEl.style.display = "block";
        wrapEl.style.marginLeft = "auto";
        wrapEl.style.marginRight = "auto";
      }
    }

    // ── Largeur ──
    function _applyWidth(wrapEl, img, pct) {
      wrapEl.style.width = pct;
      img.style.width = "100%";
      img.style.height = "auto";
    }

    // ── Sélection ──
    function _select(wrapEl, img) {
      if (_activeWrap && _activeWrap !== wrapEl) {
        _activeWrap.classList.remove("selected");
        if (_activeImg?._floatTb) _activeImg._floatTb.style.display = "none";
      }
      _activeWrap = wrapEl;
      _activeImg = img;
      // Sync variables globales admin.html
      global._activeResizeImg = wrapEl;
      global._activeResizeImgEl = img;

      wrapEl.classList.add("selected");
      if (img._floatTb) {
        img._floatTb.style.display = "flex";
        // Attendre le layout pour repositionner correctement
        requestAnimationFrame(() => _reposition(wrapEl, img));
      }
    }

    // ── Désélection ──
    function _deselect() {
      if (_activeWrap) _activeWrap.classList.remove("selected");
      if (_activeImg?._floatTb) _activeImg._floatTb.style.display = "none";
      _activeWrap = null;
      _activeImg = null;
      global._activeResizeImg = null;
      global._activeResizeImgEl = null;
    }

    // ── Démarrage redimensionnement ──
    function _startResize(e, wrapEl, img, badge, dir, editor) {
      const sx = e.clientX,
        sy = e.clientY;
      const sw = img.offsetWidth,
        sh = img.offsetHeight;
      const asp = sh > 0 ? sw / sh : 1;

      SirhCursor.startResize(dir);
      wrapEl.classList.add("resizing");
      badge.style.display = "block";
      if (img._floatTb) img._floatTb.style.display = "none";

      function onMove(ev) {
        let dx = ev.clientX - sx,
          dy = ev.clientY - sy;
        let nw = sw,
          nh = sh;

        if (dir.includes("e")) nw = Math.max(24, sw + dx);
        if (dir.includes("w")) nw = Math.max(24, sw - dx);
        if (dir.includes("s")) nh = Math.max(18, sh + dy);
        if (dir.includes("n")) nh = Math.max(18, sh - dy);

        if (wrapEl._lockAspect) {
          if (dir === "n" || dir === "s") {
            nw = Math.round(nh * asp);
          } else if (dir === "e" || dir === "w") {
            nh = Math.round(nw / asp);
          } else {
            const scaleW = nw / sw,
              scaleH = nh / sh;
            const scale = Math.max(scaleW, scaleH);
            nw = Math.max(24, Math.round(sw * scale));
            nh = Math.max(18, Math.round(sh * scale));
          }
        }

        img.style.width = nw + "px";
        img.style.height = nh + "px";
        wrapEl.style.width = nw + "px";
        badge.textContent = nw + " × " + nh + " px";
      }

      function onUp() {
        SirhCursor.stopResize();
        wrapEl.classList.remove("resizing");
        badge.style.display = "none";
        if (img._floatTb) {
          img._floatTb.style.display = "flex";
          requestAnimationFrame(() => _reposition(wrapEl, img));
        }
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        try {
          editor?.commands.focus();
        } catch (_) {}
      }

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    }

    // ── Enveloppe une image : FONCTION PRINCIPALE ──
    function wrapImage(img, editor) {
      if (img.dataset.rw) return;
      img.dataset.rw = "1";

      const wrapEl = document.createElement("span");
      wrapEl.className = "img-resize-wrap";
      wrapEl.contentEditable = "false";
      wrapEl.style.cssText =
        "display:inline-block;position:relative;line-height:0;user-select:none;vertical-align:middle;";
      if (img.style.width) wrapEl.style.width = img.style.width;
      wrapEl._lockAspect = true;

      img.style.display = "block";
      img.style.maxWidth = "100%";

      img.parentNode.insertBefore(wrapEl, img);
      wrapEl.appendChild(img);

      // Cadre de sélection
      const selFrame = document.createElement("div");
      selFrame.className = "sirh-sel-frame";
      wrapEl.appendChild(selFrame);

      // Badge taille
      const badge = document.createElement("div");
      badge.className = "sirh-size-badge";
      wrapEl.appendChild(badge);

      // 8 poignées
      const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
      const HANDLE_POS = {
        nw: "top:-5px;left:-5px",
        n: "top:-5px;left:calc(50% - 4.5px)",
        ne: "top:-5px;right:-5px",
        e: "top:calc(50% - 4.5px);right:-5px",
        se: "bottom:-5px;right:-5px",
        s: "bottom:-5px;left:calc(50% - 4.5px)",
        sw: "bottom:-5px;left:-5px",
        w: "top:calc(50% - 4.5px);left:-5px",
      };

      HANDLES.forEach((dir) => {
        const h = document.createElement("span");
        h.className = "img-handle " + dir;
        h.dataset.dir = dir;
        h.style.cssText = [
          "position:absolute",
          "width:9px",
          "height:9px",
          "background:#fff",
          "border:1.5px solid #2563eb",
          "border-radius:2px",
          "z-index:20",
          "box-shadow:0 0 0 1.5px rgba(37,99,235,.25),0 1px 3px rgba(0,0,0,.18)",
          "transition:transform .1s,background .1s",
          HANDLE_POS[dir],
        ].join(";");
        h.addEventListener("mouseenter", () => {
          h.style.transform = "scale(1.4)";
          h.style.background = "#2563eb";
        });
        h.addEventListener("mouseleave", () => {
          h.style.transform = "";
          h.style.background = "#fff";
        });
        h.addEventListener("mousedown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          _select(wrapEl, img);
          _startResize(e, wrapEl, img, badge, dir, editor);
        });
        wrapEl.appendChild(h);
      });

      // Toolbar flottante
      const tb = _createToolbar(wrapEl, img);
      img._floatTb = tb;

      // Clic sur le wrap ou l'image → sélection
      wrapEl.addEventListener("mousedown", (e) => {
        e.stopPropagation();
        _select(wrapEl, img);
      });
      img.addEventListener("click", (e) => {
        e.stopPropagation();
        _select(wrapEl, img);
      });
    }

    // ── Écoute globale pour désélection ──
    document.addEventListener("mousedown", (e) => {
      if (
        !e.target.closest(".img-resize-wrap") &&
        !e.target.closest(".sirh-img-floattb")
      ) {
        _deselect();
      }
    });

    // ── Mise à jour position lors du scroll ──
    document.addEventListener(
      "scroll",
      () => {
        if (_activeWrap && _activeImg?._floatTb) {
          _reposition(_activeWrap, _activeImg);
        }
      },
      true,
    );

    // ── API publique ──
    return {
      wrap: wrapImage,
      select: _select,
      deselect: _deselect,
      reposition: _reposition,
      applyAlign: _applyAlign,
      applyWidth: _applyWidth,
    };
  })();

  // ─────────────────────────────────────────────────────────────
  //  SirhTableResize — curseurs sur bordures tableau
  // ─────────────────────────────────────────────────────────────
  const SirhTableResize = (function () {
    const COL_T = 7,
      ROW_T = 7;
    let _resizing = false;

    function onMove(e) {
      if (_resizing) return;
      if (e.target?.classList?.contains("column-resize-handle")) {
        SirhCursor.startColResize();
        return;
      }
      const td = e.target?.closest?.("td, th");
      if (!td) {
        SirhCursor.stopTableResize();
        return;
      }
      const r = td.getBoundingClientRect();
      const x = e.clientX,
        y = e.clientY;
      if (Math.abs(x - r.right) <= COL_T || Math.abs(x - r.left) <= COL_T) {
        SirhCursor.startColResize();
      } else if (
        Math.abs(y - r.bottom) <= ROW_T ||
        Math.abs(y - r.top) <= ROW_T
      ) {
        SirhCursor.startRowResize();
      } else {
        SirhCursor.stopTableResize();
      }
    }

    function onDown(e) {
      if (e.target?.classList?.contains("column-resize-handle")) {
        _resizing = true;
        SirhCursor.startColResize();
        document.addEventListener(
          "mouseup",
          () => {
            _resizing = false;
            SirhCursor.stopTableResize();
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

  // ─────────────────────────────────────────────────────────────
  //  PATCH des fonctions globales admin.html
  //  On remplace les fonctions image resize par les nouvelles
  //  sans toucher à la logique tblCmd, toolbar, etc.
  // ─────────────────────────────────────────────────────────────
  function _patchAdminFunctions() {
    // activateImageResizers → utilise SirhImgResize.wrap
    global.activateImageResizers = function (ed) {
      if (!ed) return;
      ed.view.dom.querySelectorAll("img:not([data-rw])").forEach((img) => {
        if (!img.closest(".img-resize-wrap")) {
          SirhImgResize.wrap(img, ed);
        }
      });
    };

    // wrapImgResize → délègue
    global.wrapImgResize = function (img, ed) {
      SirhImgResize.wrap(img, ed);
    };

    // positionImgToolbar → délègue
    global.positionImgToolbar = function (wrap, img) {
      SirhImgResize.reposition(wrap, img);
    };

    // selectImg → délègue
    global.selectImg = function (wrap, img) {
      const imgEl = img || wrap?.querySelector("img");
      if (wrap && imgEl) SirhImgResize.select(wrap, imgEl);
    };

    // setImgAlign → délègue
    global.setImgAlign = function (btn, align) {
      const wrap = global._activeResizeImg;
      if (!wrap) return;
      SirhImgResize.applyAlign(wrap, align);
      if (btn) {
        btn.parentElement
          ?.querySelectorAll("button")
          .forEach((b) => (b.style.background = ""));
        btn.style.background = "rgba(37,99,235,.5)";
      }
      if (global._activeResizeImgEl)
        requestAnimationFrame(() =>
          SirhImgResize.reposition(wrap, global._activeResizeImgEl),
        );
    };

    // setImgWidthFixed → délègue
    global.setImgWidthFixed = function (btn, pct) {
      const wrap = global._activeResizeImg;
      const img = global._activeResizeImgEl || wrap?.querySelector("img");
      if (!wrap || !img) return;
      SirhImgResize.applyWidth(wrap, img, pct);
      if (btn) {
        btn.parentElement?.querySelectorAll("button").forEach((b) => {
          b.style.color = "rgba(255,255,255,.75)";
          b.style.fontWeight = "";
        });
        btn.style.color = "#fff";
        btn.style.fontWeight = "700";
      }
      requestAnimationFrame(() => SirhImgResize.reposition(wrap, img));
    };

    // removeImgFixed → délègue
    global.removeImgFixed = function () {
      const img = global._activeResizeImgEl;
      const wrap = global._activeResizeImg;
      if (img?._floatTb) img._floatTb.remove();
      if (wrap) wrap.remove();
      global._activeResizeImg = null;
      global._activeResizeImgEl = null;
    };
  }

  // ─────────────────────────────────────────────────────────────
  //  INIT
  // ─────────────────────────────────────────────────────────────
  function _init() {
    SirhCursor.init();
    SirhTableResize.init();
    _patchAdminFunctions();
    // Exposer sur global pour usage dans le module Tiptap
    global.SirhCursor = SirhCursor;
    global.SirhImgResize = SirhImgResize;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", _init);
  } else {
    _init();
  }
})(window);
