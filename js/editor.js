// Edytor poziomow, cofanie, poziomy graczy (warsztat, moje poziomy), speedruny, panel admina.
// Klasyczny skrypt (bez IIFE): wspolny zasieg globalny z pozostalymi plikami js/.
  // ---------- EDYTOR POZIOMÓW ----------
  let editorLevelW = 6000;   // dlugosc edytowanego poziomu (px), wybierana w pasku narzedzi
  const EDITOR_LENGTH_DEFAULT = 6000, EDITOR_LENGTH_MIN = 1500, EDITOR_LENGTH_MAX = 30000;
  const EDITOR_LEVEL_H = 720;
  const editorCanvas = document.getElementById('editorCanvas');
  const editorCtx = editorCanvas.getContext('2d');
  const editorScale = editorCanvas.height / EDITOR_LEVEL_H;
  const EDITOR_GROUND_Y = EDITOR_LEVEL_H - 60;
  const EDITOR_VIEW_W = editorCanvas.width / editorScale;

  let editorTool = 'ground';
  let editorTesting = false;
  let editorElements = []; // {kind, x, y, w, enemyType, axis}
  let editorSpawn = { x:40, y:EDITOR_GROUND_Y-54 };
  let editorFlag = { x:editorLevelW-150, y:EDITOR_GROUND_Y-220 };
  let editorCheckpoint = null; // edytowalny (x i y) - stawiany na wysokosci klikniecia, przeciagalny w obie osie
  let editorScrollX = 0;
  let editorEditingCode = null; // null = nowy poziom; ustawiony = edytujemy/nadpisujemy istniejacy zapisany poziom

  const editorScrollRange = document.getElementById('editorScrollRange');
  editorScrollRange.max = Math.max(0, editorLevelW - EDITOR_VIEW_W);
  function editorSetScroll(x){
    editorScrollX = Math.max(0, Math.min(editorLevelW - EDITOR_VIEW_W, x));
    editorScrollRange.value = editorScrollX;
    redrawEditor();
  }
  // ---- dlugosc poziomu ----
  const editorLengthSelect = document.getElementById('editorLengthSelect');
  function editorEnsureLengthOption(w){
    const opts = [...editorLengthSelect.options];
    if(opts.some(o => Number(o.value) === w)) return;
    const o = document.createElement('option');
    o.value = String(w); o.textContent = '📏 ' + w + ' px';
    const after = opts.find(x => Number(x.value) > w);
    editorLengthSelect.insertBefore(o, after || null);
  }
  function editorApplyLength(w){
    editorLevelW = w;
    editorEnsureLengthOption(w);
    editorLengthSelect.value = String(w);
    editorScrollRange.max = Math.max(0, w - EDITOR_VIEW_W);
  }
  // jak daleko siegaja elementy poziomu (bez flagi, jesli stoi na domyslnym koncu)
  function editorContentMaxX(excludeFlag){
    let m = editorSpawn.x + 40;
    if(editorFlag && !excludeFlag) m = Math.max(m, editorFlag.x + 20);
    if(editorCheckpoint) m = Math.max(m, editorCheckpoint.x + 20);
    editorElements.forEach(el => { m = Math.max(m, el.x + (el.w || 40) + (el.kind === 'mover' && el.axis !== 'y' ? (el.range || 60) : 0)); });
    return m;
  }
  editorLengthSelect.onchange = () => {
    const w = Number(editorLengthSelect.value), old = editorLevelW;
    const flagAtEnd = editorFlag && Math.abs(editorFlag.x - (old - 150)) < 1;
    const need = editorContentMaxX(flagAtEnd);
    if(w < need + 150){
      editorLengthSelect.value = String(old);
      editorFlashLimitWarning('Nie można skrócić poziomu - elementy sięgają do ' + Math.round(need) + ' px');
      return;
    }
    if(flagAtEnd) editorFlag.x = w - 150;   // flaga zostaje na koncu poziomu
    editorApplyLength(w);
    editorUndoStack = [];                   // zmiana dlugosci zeruje historie cofania
    editorSetScroll(editorScrollX);
  };
  editorScrollRange.oninput = () => editorSetScroll(Number(editorScrollRange.value));
  document.getElementById('btnEditorScrollLeft').onclick = () => editorSetScroll(editorScrollX - 300);
  document.getElementById('btnEditorScrollRight').onclick = () => editorSetScroll(editorScrollX + 300);
  editorCanvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    editorSetScroll(editorScrollX + (e.deltaY || e.deltaX));
  }, { passive:false });

  function editorSnap(v, grid){ return Math.round(v/grid)*grid; }

  function editorBgPreviewColors(bg){
    if(bg==='night') return {sky1:'#0b1233', sky2:'#1c2a5e', hill:'#152a4a'};
    if(bg==='dusk') return {sky1:'#8a4a8f', sky2:'#e0764f', hill:'#3d2352'};
    if(bg==='volcano') return {sky1:'#3a0e0e', sky2:'#b8451c', hill:'#2a0a0a'};
    if(bg==='ice') return {sky1:'#bfe9ff', sky2:'#eaf7ff', hill:'#6fb8d8'};
    if(bg==='desert') return {sky1:'#ffdca0', sky2:'#ffb877', hill:'#c9862f'};
    if(bg==='aurora') return {sky1:'#0a1a2e', sky2:'#123d3a', hill:'#0a2e28'};
    return {sky1:'#5c94fc', sky2:'#a8d8ff', hill:'#3fae4a'};
  }

  function redrawEditor(){
    const weightEl = document.getElementById('editorWeightHint');
    if(weightEl){
      const bytes = new Blob([JSON.stringify(collectEditorData())]).size;
      weightEl.textContent = 'Waga poziomu: ' + formatBytes(bytes);
    }
    const posEl = document.getElementById('editorPosHint');
    if(posEl) posEl.textContent = 'Widok: ' + Math.round(editorScrollX) + '–' + Math.round(Math.min(editorLevelW, editorScrollX + EDITOR_VIEW_W)) + ' / ' + editorLevelW + ' px';
    const c = editorBgPreviewColors(document.getElementById('editorBgSelect').value);
    const grad = editorCtx.createLinearGradient(0,0,0,editorCanvas.height);
    grad.addColorStop(0, c.sky1); grad.addColorStop(1, c.sky2);
    editorCtx.fillStyle = grad;
    editorCtx.fillRect(0,0,editorCanvas.width, editorCanvas.height);

    // linia gruntu (poziom, na ktorym stoja bloki ziemi)
    editorCtx.strokeStyle = 'rgba(255,255,255,.3)';
    editorCtx.setLineDash([6,4]);
    editorCtx.beginPath();
    editorCtx.moveTo(0, EDITOR_GROUND_Y*editorScale);
    editorCtx.lineTo(editorCanvas.width, EDITOR_GROUND_Y*editorScale);
    editorCtx.stroke();
    editorCtx.setLineDash([]);

    for(const el of editorElements){
      const ex = (el.x-editorScrollX)*editorScale;
      const refY = el.kind==='crusher' ? el.topY : el.y;
      const ey = refY*editorScale;
      if(ex < -100 || ex > editorCanvas.width+100) continue;
      editorCtx.save();
      if(el.kind==='ground'){
        editorCtx.fillStyle = '#8a5a2b';
        editorCtx.fillRect(ex, ey, el.w*editorScale, (editorCanvas.height-ey));
        editorCtx.fillStyle = '#3fae4a';
        editorCtx.fillRect(ex, ey, el.w*editorScale, 4);
      } else if(el.kind==='platform' && el.isTrampoline){
        const pw = el.w*editorScale;
        editorCtx.fillStyle = '#7a4a1e';
        editorCtx.fillRect(ex, ey+7, pw, 4);
        editorCtx.fillStyle = '#ff5f6d';
        editorCtx.fillRect(ex, ey, pw, 8);
        editorCtx.strokeStyle = '#c0392b'; editorCtx.lineWidth = 1.5;
        for(let sx=5; sx<pw-3; sx+=10){ editorCtx.beginPath(); editorCtx.moveTo(ex+sx, ey+8); editorCtx.lineTo(ex+sx+5, ey); editorCtx.stroke(); }
      } else if(el.kind==='platform' && el.isCrumbler){
        const pw = el.w*editorScale;
        editorCtx.fillStyle = '#a06a3e';
        editorCtx.fillRect(ex, ey, pw, 10);
        editorCtx.strokeStyle = '#5a3a1e'; editorCtx.lineWidth = 1.5;
        for(let cx2=0; cx2<pw; cx2+=16) editorCtx.strokeRect(ex+cx2, ey, Math.min(16, pw-cx2), 10);
      } else if(el.kind==='platform'){
        editorCtx.fillStyle = '#c96a2e';
        editorCtx.fillRect(ex, ey, el.w*editorScale, 10);
      } else if(el.kind==='pipe'){
        editorCtx.fillStyle = '#1e9e46';
        editorCtx.fillRect(ex, (EDITOR_GROUND_Y-60)*editorScale, el.w*editorScale, 60*editorScale);
      } else if(el.kind==='coin'){
        editorCtx.fillStyle = '#ffd23f';
        editorCtx.beginPath(); editorCtx.arc(ex, ey, 5, 0, Math.PI*2); editorCtx.fill();
      } else if(el.kind==='enemy'){
        editorCtx.fillStyle = el.enemyType==='flyer' ? '#4f9fe0' : el.enemyType==='jumper' ? '#4fc463' : '#a655d6';
        const rangeCol = 'rgba(255,110,110,.55)';
        editorCtx.strokeStyle = rangeCol;
        editorCtx.lineWidth = 2;
        editorCtx.setLineDash([4,3]);
        if(el.enemyType === 'flyer'){
          const rx = 100*editorScale, ry = 35*editorScale;
          editorCtx.beginPath();
          editorCtx.ellipse(ex, ey, rx, ry, 0, 0, Math.PI*2);
          editorCtx.stroke();
        } else if(el.enemyType === 'jumper'){
          editorCtx.beginPath();
          editorCtx.moveTo(ex, ey);
          editorCtx.lineTo(ex, ey - 70*editorScale);
          editorCtx.stroke();
        } else {
          const rx = 90*editorScale;
          editorCtx.beginPath();
          editorCtx.moveTo(ex-rx, ey);
          editorCtx.lineTo(ex+rx, ey);
          editorCtx.stroke();
        }
        editorCtx.setLineDash([]);
        editorCtx.fillStyle = el.enemyType==='flyer' ? '#4f9fe0' : el.enemyType==='jumper' ? '#4fc463' : '#a655d6';
        editorCtx.beginPath(); editorCtx.arc(ex, ey, 7, 0, Math.PI*2); editorCtx.fill();
      } else if(el.kind==='hazard'){
        editorCtx.fillStyle = '#c0c5cb';
        editorCtx.beginPath();
        editorCtx.moveTo(ex, EDITOR_GROUND_Y*editorScale);
        editorCtx.lineTo(ex+el.w*editorScale/2, EDITOR_GROUND_Y*editorScale-14);
        editorCtx.lineTo(ex+el.w*editorScale, EDITOR_GROUND_Y*editorScale);
        editorCtx.fill();
      } else if(el.kind==='mover'){
        const range = (el.range||60) * editorScale;
        editorCtx.strokeStyle = 'rgba(201,165,245,.7)';
        editorCtx.lineWidth = 2;
        editorCtx.setLineDash([4,3]);
        editorCtx.beginPath();
        if(el.axis === 'y'){
          editorCtx.moveTo(ex, ey-range);
          editorCtx.lineTo(ex, ey+range);
        } else {
          editorCtx.moveTo(ex-range, ey);
          editorCtx.lineTo(ex+range, ey);
        }
        editorCtx.stroke();
        editorCtx.setLineDash([]);
        // duchy skrajnych pozycji
        editorCtx.fillStyle = 'rgba(201,165,245,.35)';
        if(el.axis === 'y'){
          editorCtx.fillRect(ex-20, ey-range-4, 40, 8);
          editorCtx.fillRect(ex-20, ey+range-4, 40, 8);
        } else {
          editorCtx.fillRect(ex-range-20, ey-4, 40, 8);
          editorCtx.fillRect(ex+range-20, ey-4, 40, 8);
        }
        // platforma na pozycji startowej
        editorCtx.fillStyle = '#c9a5f5';
        editorCtx.fillRect(ex-20, ey-4, 40, 8);
        editorCtx.strokeStyle = '#6a3fae';
        editorCtx.lineWidth = 1;
        editorCtx.strokeRect(ex-20, ey-4, 40, 8);
        editorCtx.font = 'bold 11px sans-serif'; editorCtx.textAlign='center';
        editorCtx.fillStyle = '#fff';
        editorCtx.fillText(el.axis === 'y' ? '↕' : '↔', ex, ey+3);
        editorCtx.textAlign='left';
      } else if(el.kind==='crusher'){
        const bottomEy = (el.bottomY!==undefined ? el.bottomY : EDITOR_GROUND_Y-55) * editorScale;
        editorCtx.strokeStyle = 'rgba(80,60,30,.9)';
        editorCtx.lineWidth = 2;
        editorCtx.beginPath(); editorCtx.moveTo(ex,0); editorCtx.lineTo(ex,ey); editorCtx.stroke();
        editorCtx.strokeStyle = 'rgba(231,76,60,.6)';
        editorCtx.setLineDash([4,3]);
        editorCtx.beginPath(); editorCtx.moveTo(ex,ey); editorCtx.lineTo(ex,bottomEy); editorCtx.stroke();
        editorCtx.setLineDash([]);
        editorCtx.fillStyle = 'rgba(231,76,60,.3)';
        editorCtx.fillRect(ex-18, bottomEy-18, 36, 36);
        editorCtx.fillStyle = '#3a3f47';
        editorCtx.fillRect(ex-18, ey-18, 36, 36);
        editorCtx.strokeStyle = '#000';
        editorCtx.lineWidth = 2;
        editorCtx.strokeRect(ex-18, ey-18, 36, 36);
        editorCtx.fillStyle = '#e74c3c';
        editorCtx.fillRect(ex-18, ey+9, 36, 9);
        editorCtx.font = 'bold 16px sans-serif'; editorCtx.textAlign='center';
        editorCtx.fillStyle = '#fff';
        editorCtx.fillText('💥', ex, ey+6);
        editorCtx.textAlign='left';
      } else if(el.kind==='turret'){
        const dirSign = el.dir>=0 ? 1 : -1;
        const rangeLen = 420*editorScale;
        editorCtx.strokeStyle = 'rgba(255,204,77,.6)';
        editorCtx.lineWidth = 2;
        editorCtx.setLineDash([5,4]);
        editorCtx.beginPath();
        editorCtx.moveTo(ex, ey);
        editorCtx.lineTo(ex + dirSign*rangeLen, ey);
        editorCtx.stroke();
        editorCtx.setLineDash([]);
        editorCtx.beginPath();
        editorCtx.moveTo(ex+dirSign*rangeLen, ey-6);
        editorCtx.lineTo(ex+dirSign*rangeLen+dirSign*10, ey);
        editorCtx.lineTo(ex+dirSign*rangeLen, ey+6);
        editorCtx.fillStyle = 'rgba(255,204,77,.8)';
        editorCtx.fill();
        editorCtx.fillStyle = '#556070';
        editorCtx.fillRect(ex-11, ey-11, 22, 22);
        editorCtx.fillStyle = '#ffcc4d';
        editorCtx.fillRect(el.dir>=0 ? ex : ex-16, ey-3, 16, 6);
      } else if(el.kind==='boss'){
        const rx = 200*editorScale;
        editorCtx.strokeStyle = 'rgba(192,57,43,.6)';
        editorCtx.lineWidth = 2;
        editorCtx.setLineDash([4,3]);
        editorCtx.beginPath();
        editorCtx.moveTo(ex-rx, ey);
        editorCtx.lineTo(ex+rx, ey);
        editorCtx.stroke();
        editorCtx.setLineDash([]);
        editorCtx.fillStyle = 'rgba(192,57,43,.3)';
        editorCtx.fillRect(ex-rx-16, ey-16, 32, 32);
        editorCtx.fillRect(ex+rx-16, ey-16, 32, 32);
        editorCtx.fillStyle = '#c0392b';
        editorCtx.beginPath(); editorCtx.arc(ex, ey, 16, 0, Math.PI*2); editorCtx.fill();
        editorCtx.font = 'bold 14px sans-serif'; editorCtx.textAlign='center';
        editorCtx.fillText('👹', ex, ey+5);
        editorCtx.textAlign='left';
      }
      editorCtx.restore();
    }

    // start gracza
    editorCtx.fillStyle = '#e74c3c';
    editorCtx.beginPath(); editorCtx.arc((editorSpawn.x-editorScrollX)*editorScale, editorSpawn.y*editorScale, 8, 0, Math.PI*2); editorCtx.fill();
    editorCtx.fillStyle = '#fff'; editorCtx.font = 'bold 9px sans-serif';
    editorCtx.fillText('START', (editorSpawn.x-editorScrollX)*editorScale-14, editorSpawn.y*editorScale-12);

    // checkpoint (slupek stoi na y, wysokosc 220 - jak w grze)
    if(editorCheckpoint){
      const cpx = (editorCheckpoint.x-editorScrollX)*editorScale, cpy = editorCheckpoint.y*editorScale;
      editorCtx.fillStyle = '#b8bcc6';
      editorCtx.fillRect(cpx, cpy-220*editorScale, 2, 220*editorScale);
      editorCtx.fillStyle = '#2ecc71';
      editorCtx.beginPath();
      editorCtx.moveTo(cpx+2, cpy-220*editorScale+4); editorCtx.lineTo(cpx+16, cpy-220*editorScale+10); editorCtx.lineTo(cpx+2, cpy-220*editorScale+16);
      editorCtx.fill();
      editorCtx.fillStyle = '#fff'; editorCtx.font = 'bold 9px sans-serif';
      editorCtx.fillText('CHECKPOINT', cpx-22, cpy-220*editorScale-4);
    }

    // flaga
    if(editorFlag){
      editorCtx.fillStyle = '#e74c3c';
      const fx = (editorFlag.x-editorScrollX)*editorScale, fy = editorFlag.y*editorScale;
      editorCtx.fillRect(fx, fy, 2, 220*editorScale);
      editorCtx.beginPath();
      editorCtx.moveTo(fx+2, fy+4); editorCtx.lineTo(fx+16, fy+10); editorCtx.lineTo(fx+2, fy+16);
      editorCtx.fill();
    }
  }

  // ---------- COFANIE (Ctrl+Z, maks. 3 kroki) ----------
  const EDITOR_UNDO_MAX = 3;
  let editorUndoStack = [];   // zserializowane stany "przed zmiana"
  function editorSnapshotJSON(){
    return JSON.stringify({ els: editorElements, spawn: editorSpawn, flag: editorFlag, cp: editorCheckpoint });
  }
  function editorPushUndo(beforeJSON){
    editorUndoStack.push(beforeJSON);
    if(editorUndoStack.length > EDITOR_UNDO_MAX) editorUndoStack.shift();
  }
  function editorUndoFlash(msg, color){
    const el = document.getElementById('editorSaveResult');
    if(!el) return;
    el.textContent = msg;
    el.style.color = color || '';
    clearTimeout(editorLimitWarnTimeout);
    editorLimitWarnTimeout = setTimeout(() => { el.textContent = ''; el.style.color = ''; }, 1800);
  }
  function editorUndo(){
    if(editorUndoStack.length === 0){
      editorUndoFlash('↩ Nie ma czego cofać (maks. 3 cofnięcia)', '#ffd23f');
      return;
    }
    const st = JSON.parse(editorUndoStack.pop());
    editorElements = st.els;
    editorSpawn = st.spawn;
    editorFlag = st.flag;
    editorCheckpoint = st.cp;
    editorDrag = null;
    redrawEditor();
    editorUndoFlash('↩ Cofnięto (pozostało ' + editorUndoStack.length + ')', '#9be7a2');
  }
  window.addEventListener('keydown', (e) => {
    if(!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.code !== 'KeyZ') return;
    if(editorScreen.classList.contains('hidden')) return;
    const t = e.target && e.target.tagName;
    if(t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return; // w polach tekstowych zostaje zwykle cofanie tekstu
    e.preventDefault();
    editorUndo();
  });

  let editorLimitWarnTimeout = null;
  function editorFlashLimitWarning(msg){
    const el = document.getElementById('editorSaveResult');
    if(!el) return;
    el.textContent = '⚠ ' + msg;
    el.style.color = '#ff6b6b';
    clearTimeout(editorLimitWarnTimeout);
    editorLimitWarnTimeout = setTimeout(() => { el.textContent = ''; el.style.color = ''; }, 2000);
  }

  // odleglosc punktu od slupka checkpointa (odcinek od y-220 do y)
  function editorCheckpointDist(levelX, levelY){
    const top = editorCheckpoint.y - 220, bot = editorCheckpoint.y;
    const dy = levelY < top ? top - levelY : (levelY > bot ? levelY - bot : 0);
    return Math.hypot(editorCheckpoint.x - levelX, dy);
  }

  let editorShiftHeld = false;   // ustawiane przy kliknieciu (Shift + klik = dlugi odcinek gruntu)
  // odleglosc punktu od elementu; dla elementow o szerokosci liczymy do najblizszego punktu na ich dlugosci
  function editorEraseDist(el, levelX, levelY){
    const ey = el.y!==undefined ? el.y : (el.kind==='crusher' ? el.topY : levelY);
    let dx = el.x - levelX;
    if(el.w !== undefined && (el.kind==='ground' || el.kind==='platform' || el.kind==='pipe' || el.kind==='hazard')){
      dx = levelX < el.x ? el.x - levelX : (levelX > el.x + el.w ? levelX - (el.x + el.w) : 0);
    }
    return Math.hypot(dx, ey - levelY);
  }

  const EDITOR_BLOCK_MAX = 100; // maks. sztuk danego typu bloku na poziom (osobno dla kazdego narzedzia)
  function editorCountByTool(tool){
    switch(tool){
      case 'ground': return editorElements.filter(e=>e.kind==='ground').length;
      case 'platform': return editorElements.filter(e=>e.kind==='platform' && !e.isTrampoline && !e.isCrumbler).length;
      case 'trampoline': return editorElements.filter(e=>e.kind==='platform' && e.isTrampoline).length;
      case 'crumbler': return editorElements.filter(e=>e.kind==='platform' && e.isCrumbler).length;
      case 'pipe': return editorElements.filter(e=>e.kind==='pipe').length;
      case 'walker': return editorElements.filter(e=>e.kind==='enemy' && e.enemyType==='walker').length;
      case 'flyer': return editorElements.filter(e=>e.kind==='enemy' && e.enemyType==='flyer').length;
      case 'jumper': return editorElements.filter(e=>e.kind==='enemy' && e.enemyType==='jumper').length;
      case 'hazard': return editorElements.filter(e=>e.kind==='hazard').length;
      case 'mover': return editorElements.filter(e=>e.kind==='mover' && e.axis==='x').length;
      case 'mover_y': return editorElements.filter(e=>e.kind==='mover' && e.axis==='y').length;
      case 'crusher': return editorElements.filter(e=>e.kind==='crusher').length;
      case 'turret': return editorElements.filter(e=>e.kind==='turret').length;
      default: return 0;
    }
  }

  function editorPlaceAt(levelX, levelY){
    if(['ground','platform','trampoline','crumbler','pipe','walker','flyer','jumper','hazard','mover','mover_y','crusher','turret'].includes(editorTool)){
      if(editorCountByTool(editorTool) >= EDITOR_BLOCK_MAX){
        editorFlashLimitWarning('Maksymalnie ' + EDITOR_BLOCK_MAX + ' na poziom dla tego typu elementu!');
        return;
      }
    }
    if(editorTool === 'erase'){
      let bestIdx = -1, bestDist = 9999;
      editorElements.forEach((el,i) => {
        const d = editorEraseDist(el, levelX, levelY);
        if(d < bestDist){ bestDist = d; bestIdx = i; }
      });
      const dCp = editorCheckpoint ? editorCheckpointDist(levelX, levelY) : 9999;
      if(dCp < bestDist && dCp < 120){ editorCheckpoint = null; }
      else if(bestIdx >= 0 && bestDist < 120) editorElements.splice(bestIdx,1);
      redrawEditor();
      return;
    }
    if(editorTool === 'spawn'){ editorSpawn = {x:levelX, y:levelY}; redrawEditor(); return; }
    if(editorTool === 'flag'){ editorFlag = {x:levelX, y:levelY}; redrawEditor(); return; }
    if(editorTool === 'checkpoint'){ editorCheckpoint = {x:levelX, y:levelY}; redrawEditor(); return; }
    if(editorTool === 'ground'){ editorElements.push({kind:'ground', x:levelX, y:EDITOR_GROUND_Y, w: editorShiftHeld ? 1000 : 200}); }
    else if(editorTool === 'platform'){ editorElements.push({kind:'platform', x:levelX, y:levelY, w:MIN_PLATFORM_W, h:22}); }
    else if(editorTool === 'trampoline'){ editorElements.push({kind:'platform', x:levelX, y:levelY, w:MIN_PLATFORM_W, h:20, isTrampoline:true}); }
    else if(editorTool === 'crumbler'){ editorElements.push({kind:'platform', x:levelX, y:levelY, w:MIN_PLATFORM_W, h:20, isCrumbler:true}); }
    else if(editorTool === 'pipe'){ editorElements.push({kind:'pipe', x:levelX, w:46, h:60}); }
    else if(editorTool === 'coin'){
      const coinCount = editorElements.filter(e=>e.kind==='coin').length;
      if(coinCount >= 40){
        editorFlashLimitWarning('Maksymalnie 40 monet na poziom!');
        return;
      }
      editorElements.push({kind:'coin', x:levelX, y:levelY});
    }
    else if(editorTool === 'walker'){ editorElements.push({kind:'enemy', enemyType:'walker', x:levelX, y:levelY}); }
    else if(editorTool === 'flyer'){ editorElements.push({kind:'enemy', enemyType:'flyer', x:levelX, y:levelY}); }
    else if(editorTool === 'jumper'){ editorElements.push({kind:'enemy', enemyType:'jumper', x:levelX, y:levelY}); }
    else if(editorTool === 'hazard'){ editorElements.push({kind:'hazard', x:levelX, w:40}); }
    else if(editorTool === 'mover'){ editorElements.push({kind:'mover', x:levelX, y:levelY, axis:'x', range:60}); }
    else if(editorTool === 'mover_y'){ editorElements.push({kind:'mover', x:levelX, y:levelY, axis:'y', range:110}); }
    else if(editorTool === 'crusher'){ editorElements.push({kind:'crusher', x:levelX, w:50, h:50, topY:80, bottomY:EDITOR_GROUND_Y-55, speed:1.0, t:0}); }
    else if(editorTool === 'turret'){
      const dir = levelX < editorLevelW/2 ? 1 : -1;
      editorElements.push({kind:'turret', x:levelX, y:EDITOR_GROUND_Y-90, dir, interval:245});
    }
    else if(editorTool === 'boss'){
      const existing = editorElements.findIndex(e=>e.kind==='boss');
      if(existing >= 0) editorElements.splice(existing,1);
      editorElements.push({kind:'boss', x:levelX, y:EDITOR_GROUND_Y-90});
    }
    redrawEditor();
  }

  function editorPointFromEvent(e){
    const rect = editorCanvas.getBoundingClientRect();
    const cx = (e.clientX-rect.left) * (editorCanvas.width/rect.width);
    const cy = (e.clientY-rect.top) * (editorCanvas.height/rect.height);
    return { levelX: cx/editorScale + editorScrollX, levelY: cy/editorScale };
  }

  function editorFindDraggable(levelX, levelY){
    let best = null, bestDist = 90;
    const dSpawn = Math.hypot(editorSpawn.x-levelX, editorSpawn.y-levelY);
    if(dSpawn < bestDist){ bestDist = dSpawn; best = {kind:'spawn'}; }
    if(editorFlag){
      const dFlag = Math.hypot(editorFlag.x-levelX, editorFlag.y-levelY);
      if(dFlag < bestDist){ bestDist = dFlag; best = {kind:'flag'}; }
    }
    if(editorCheckpoint){
      const dCp = editorCheckpointDist(levelX, levelY);
      if(dCp < bestDist){ bestDist = dCp; best = {kind:'checkpoint'}; }
    }
    for(let i=editorElements.length-1;i>=0;i--){
      const el = editorElements[i];
      const ey = el.y!==undefined ? el.y : (el.kind==='crusher' ? el.topY : levelY);
      const d = Math.hypot(el.x-levelX, ey-levelY);
      if(d < bestDist){ bestDist = d; best = {kind:'element', el}; }
    }
    return best;
  }

  let editorDrag = null;
  let editorDragMoved = false;
  let editorSuppressClick = false;

  let editorDragBefore = null;
  editorCanvas.addEventListener('mousedown', (e) => {
    const {levelX, levelY} = editorPointFromEvent(e);
    editorDragMoved = false;
    editorDrag = editorFindDraggable(levelX, levelY);
    editorDragBefore = editorDrag ? editorSnapshotJSON() : null;
  });

  window.addEventListener('mousemove', (e) => {
    if(!editorDrag) return;
    editorDragMoved = true;
    const {levelX, levelY} = editorPointFromEvent(e);
    const sx = editorSnap(levelX, 20), sy = editorSnap(levelY, 20);
    if(editorDrag.kind === 'spawn'){ editorSpawn.x = Math.max(0, sx); editorSpawn.y = sy; }
    else if(editorDrag.kind === 'flag'){ editorFlag.x = Math.max(0, sx); editorFlag.y = sy; }
    else if(editorDrag.kind === 'checkpoint'){ editorCheckpoint.x = Math.max(0, sx); editorCheckpoint.y = sy; }
    else if(editorDrag.kind === 'element'){
      editorDrag.el.x = Math.max(0, sx);
      if(editorDrag.el.kind === 'crusher'){
        const range = editorDrag.el.bottomY - editorDrag.el.topY;
        editorDrag.el.topY = Math.max(20, sy);
        editorDrag.el.bottomY = editorDrag.el.topY + range;
      } else if(editorDrag.el.y !== undefined){
        editorDrag.el.y = sy;
      }
    }
    redrawEditor();
  });

  window.addEventListener('mouseup', () => {
    if(editorDrag && editorDragMoved){
      editorSuppressClick = true;
      if(editorDragBefore !== null && editorDragBefore !== editorSnapshotJSON()) editorPushUndo(editorDragBefore);
    }
    editorDrag = null;
    editorDragBefore = null;
  });

  editorCanvas.addEventListener('click', (e) => {
    if(editorSuppressClick){ editorSuppressClick = false; return; }
    const {levelX, levelY} = editorPointFromEvent(e);
    const before = editorSnapshotJSON();
    editorShiftHeld = !!e.shiftKey;
    editorPlaceAt(editorSnap(levelX, 20), editorSnap(levelY, 20));
    editorShiftHeld = false;
    if(editorSnapshotJSON() !== before) editorPushUndo(before);   // tylko gdy cos sie realnie zmienilo
  });
  document.getElementById('btnEditorUndo').onclick = editorUndo;

  document.querySelectorAll('.editor-tool').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.editor-tool').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      editorTool = btn.dataset.tool;
    };
  });

  document.getElementById('createLevelCorner').onclick = () => {
    showScreen('editor');
  };
  document.getElementById('btnEditorBack').onclick = () => showScreen('menu');
  function editorResetBlank(){
    editorUndoStack = [];
    editorEditingCode = null;
    editorElements = [];
    editorApplyLength(EDITOR_LENGTH_DEFAULT);
    editorSpawn = { x:40, y:EDITOR_GROUND_Y-54 };
    editorFlag = { x:editorLevelW-150, y:EDITOR_GROUND_Y-220 };
    editorCheckpoint = null;
    document.getElementById('editorLevelName').value = '';
    document.getElementById('editorSaveResult').textContent = '';
    editorSetScroll(0);
    redrawEditor();
  };
  document.getElementById('editorBgSelect').onchange = redrawEditor;
  document.getElementById('btnEditorClear').onclick = () => {
    if(!confirm('Wyczyścić cały poziom w edytorze? Niezapisane zmiany przepadną.')) return;
    editorResetBlank();
  };

  document.getElementById('myLevelsCorner').onclick = () => showScreen('myLevels');
  document.getElementById('btnMyLevelsBack').onclick = () => showScreen('menu');

  document.getElementById('workshopCorner').onclick = () => showScreen('workshop');
  document.getElementById('btnWorkshopBack').onclick = () => showScreen('menu');

  async function renderWorkshop(){
    const panel = document.getElementById('workshopPanel');
    if(!sb){
      panel.innerHTML = '<div class="my-levels-empty">Warsztat wymaga skonfigurowanego konta (Supabase).</div>';
      return;
    }
    panel.innerHTML = '<div class="my-levels-empty">Wczytywanie...</div>';
    const { data, error } = await sb.from('custom_levels')
      .select('code,creator_name,level_data,plays')
      .order('plays', { ascending:false })
      .limit(30);
    if(error){
      panel.innerHTML = '<div class="my-levels-empty">⚠ Błąd wczytywania: ' + escapeHtml(error.message) + '</div>';
      return;
    }
    if(!data || data.length === 0){
      panel.innerHTML = '<div class="my-levels-empty">Nikt jeszcze nie opublikował poziomu. Stwórz pierwszy w CREATE LEVEL!</div>';
      return;
    }
    panel.innerHTML = data.map((row,i) => {
      const medal = i===0 ? '🥇' : i===1 ? '🥈' : i===2 ? '🥉' : (i+1)+'.';
      const name = escapeHtml((row.level_data && row.level_data.name) || 'Poziom bez nazwy');
      const author = escapeHtml(row.creator_name || 'Nieznany gracz');
      return `
      <div class="my-level-row">
        <div class="my-level-info">
          <div class="my-level-name">${medal} ${name}</div>
          <div class="my-level-code">Autor: ${author} • ▶ ${row.plays||0} razy zagrany • KOD: ${row.code}</div>
        </div>
        <div class="my-level-actions">
          <button class="my-level-btn play" data-code="${row.code}">▶ GRAJ</button>
        </div>
      </div>
    `;
    }).join('');

    panel.querySelectorAll('.my-level-btn.play').forEach(btn => {
      btn.onclick = async () => {
        const res = await loadCustomLevelByCode(btn.dataset.code);
        if(res.error){ alert(res.error); return; }
        showScreen('game');
        startLevel('custom', res.data);
      };
    });
  }

  document.getElementById('btnSpeedrun').onclick = () => showScreen('speedrun');
  document.getElementById('btnSpeedrunBack').onclick = () => showScreen('menu');
  document.getElementById('speedrunLevelSelect').onchange = renderSpeedrunBoard;

  function ensureSpeedrunSelectOptions(){
    const sel = document.getElementById('speedrunLevelSelect');
    if(sel.options.length === LEVELS.length) return;
    sel.innerHTML = LEVELS.map((_,i) => `<option value="${i}">Poziom ${i+1}</option>`).join('');
  }

  async function renderSpeedrunBoard(){
    ensureSpeedrunSelectOptions();
    const sel = document.getElementById('speedrunLevelSelect');
    const levelIndex = Number(sel.value || 0);
    const panel = document.getElementById('speedrunPanel');
    if(!sb){
      panel.innerHTML = '<div class="my-levels-empty">Wymaga skonfigurowanego konta (Supabase).</div>';
      return;
    }
    panel.innerHTML = '<div class="my-levels-empty">Wczytywanie...</div>';
    const { data, error } = await sb.from('level_times')
      .select('display_name,time_ms')
      .eq('level_index', levelIndex)
      .order('time_ms', { ascending:true })
      .limit(10);
    if(error){
      panel.innerHTML = '<div class="my-levels-empty">⚠ Błąd wczytywania: ' + escapeHtml(error.message) + '</div>';
      return;
    }
    if(!data || data.length === 0){
      panel.innerHTML = '<div class="my-levels-empty">Nikt jeszcze nie ukończył tego poziomu na czas. Bądź pierwszy!</div>';
      return;
    }
    panel.innerHTML = data.map((row,i) => {
      const name = escapeHtml(row.display_name || 'Gracz');
      const isMe = currentUser && row.display_name === state.displayName;
      const medal = i===0 ? '🥇' : i===1 ? '🥈' : i===2 ? '🥉' : (i+1)+'.';
      return `<div class="my-level-row"${isMe ? ' style="color:#ffd23f;font-weight:bold;"' : ''}>
        <div class="my-level-info">
          <div class="my-level-name">${medal} ${name}</div>
        </div>
        <div class="my-level-actions"><span class="my-level-code">⏱ ${formatRunTime(row.time_ms)}</span></div>
      </div>`;
    }).join('');
  }

  async function saveSpeedrunTime(levelIndex, timeMs){
    if(!sb || !currentUser) return;
    try {
      const { data: existing } = await sb.from('level_times')
        .select('time_ms')
        .eq('user_id', currentUser.id)
        .eq('level_index', levelIndex)
        .maybeSingle();
      if(existing && existing.time_ms <= timeMs) return; // stary czas juz jest lepszy lub taki sam
      await sb.from('level_times').upsert({
        user_id: currentUser.id,
        level_index: levelIndex,
        display_name: state.displayName,
        time_ms: Math.round(timeMs),
      }, { onConflict: 'user_id,level_index' });
    } catch(e){ /* ciche niepowodzenie - nie przerywaj rozgrywki */ }
  }

  function formatBytes(n){
    if(n < 1024) return n + ' B';
    return (n/1024).toFixed(1) + ' KB';
  }

  function builtInLevelToEditorData(index){
    // jesli juz istnieje zapisana poprawka, jest ona JUZ w formacie edytora
    // (bo to dokladnie to, co zapisal collectEditorData przy poprzednim zapisie) -
    // uzywamy jej wprost, bez ponownej konwersji z formatu "surowego" poziomu gry,
    // bo to psulo m.in. grunt (ktory w formacie edytora jest osobnym polem "grounds",
    // a nie plaskim platforms z flaga isGround jak w surowym poziomie gry)
    if(builtInOverrides[index]) return JSON.parse(JSON.stringify(builtInOverrides[index]));

    const raw = (LEVELS[index])();
    const grounds = (raw.platforms||[]).filter(p=>p.isGround).map(p=>({x:p.x, y:p.y, w:p.w}));
    const plats = (raw.platforms||[]).filter(p=>!p.isGround).map(p=>({x:p.x, y:p.y, w:p.w, h:p.h, isTrampoline:p.isTrampoline, isCrumbler:p.isCrumbler}));
    const pipes = (raw.pipes||[]).map(p=>({x:p.x, w:p.w, h:p.h}));
    const coins = (raw.coins||[]).map(c=>({x:c.x, y:c.y}));
    const bossEnemy = (raw.enemies||[]).find(e=>e.type==='boss');
    const enemies = (raw.enemies||[]).filter(e=>e.type!=='boss').map(e=>({x:e.x, y:e.y, enemyType: e.type || 'walker'}));
    const hazards = (raw.hazards||[]).map(h=>({x:h.x, w:h.w}));
    const movers = (raw.movers||[]).map(m=>({x:m.baseX!==undefined?m.baseX:m.x, y:m.baseY!==undefined?m.baseY:m.y, axis:m.axis, range:m.range}));
    const crushers = (raw.crushers||[]).map(c=>({x:c.x, w:c.w, h:c.h, topY:c.topY, bottomY:c.bottomY, speed:c.speed, t:c.t}));
    const shooters = (raw.shooters||[]).map(s=>({x:s.x, y:s.y, dir:s.dir, interval:s.interval}));
    return {
      name: raw.name, bg: raw.bg || 'day', width: raw.width || 2000,
      grounds, platforms: plats, pipes, coins, enemies, hazards, movers, crushers, shooters,
      boss: bossEnemy ? {x:bossEnemy.x, y:bossEnemy.y} : null,
      flag: raw.flag ? {x:raw.flag.x, y:raw.flag.y} : null,
      checkpoint: raw.checkpoint ? {x:raw.checkpoint.x, y:raw.checkpoint.y} : null,
      spawn: {x:40, y:GROUND_Y-54},
    };
  }

  function loadLevelDataIntoEditor(code, data){
    editorUndoStack = [];
    editorEditingCode = code;
    editorElements = [];
    const loadedW = Math.round(Number(data.width));
    editorApplyLength((loadedW >= EDITOR_LENGTH_MIN && loadedW <= EDITOR_LENGTH_MAX) ? loadedW : EDITOR_LENGTH_DEFAULT);
    (data.grounds||[]).forEach(g => editorElements.push({kind:'ground', x:g.x, y: g.y!==undefined ? g.y : EDITOR_GROUND_Y, w:g.w}));
    const isBuiltinLoad = String(code).startsWith('BUILTIN:');
    (data.platforms||[]).forEach(p => {
      let px = p.x, pw = p.w;
      // wbudowane poziomy: waskie platformy poszerzamy do MIN_PLATFORM_W (jak w grze), zeby edytor pokazywal to samo
      if(isBuiltinLoad && p.h < 40 && pw < MIN_PLATFORM_W){ px -= (MIN_PLATFORM_W - pw)/2; pw = MIN_PLATFORM_W; }
      editorElements.push({kind:'platform', x:px, y:p.y, w:pw, h:p.h, isTrampoline:p.isTrampoline, isCrumbler:p.isCrumbler});
    });
    (data.pipes||[]).forEach(p => editorElements.push({kind:'pipe', x:p.x, w:p.w, h:p.h}));
    (data.coins||[]).forEach(c => editorElements.push({kind:'coin', x:c.x, y:c.y}));
    (data.enemies||[]).forEach(e => editorElements.push({kind:'enemy', x:e.x, y:e.y, enemyType:e.enemyType}));
    (data.hazards||[]).forEach(h => editorElements.push({kind:'hazard', x:h.x, w:h.w}));
    (data.movers||[]).forEach(m => editorElements.push({kind:'mover', x:m.x, y:m.y, axis:m.axis||'x', range:m.range || (m.axis==='y' ? 110 : 60)}));
    (data.crushers||[]).forEach(c => editorElements.push({kind:'crusher', x:c.x, w:c.w, h:c.h, topY:c.topY, bottomY:c.bottomY, speed:c.speed, t:c.t}));
    (data.shooters||[]).forEach(s => editorElements.push({kind:'turret', x:s.x, y:s.y, dir:s.dir, interval:s.interval}));
    if(data.boss) editorElements.push({kind:'boss', x:data.boss.x, y:data.boss.y});
    editorCheckpoint = data.checkpoint ? {x:data.checkpoint.x, y:data.checkpoint.y} : null;
    editorSpawn = data.spawn ? {x:data.spawn.x, y:data.spawn.y} : {x:40, y:EDITOR_GROUND_Y-54};
    editorFlag = data.flag ? {x:data.flag.x, y:data.flag.y} : {x:editorLevelW-150, y:EDITOR_GROUND_Y-220};
    document.getElementById('editorLevelName').value = data.name || '';
    document.getElementById('editorBgSelect').value = data.bg || 'day';
    document.getElementById('editorSaveResult').textContent = String(code).startsWith('BUILTIN:')
      ? `✏️ Edytujesz WBUDOWANY poziom ${Number(String(code).split(':')[1])+1}. Zapisz, żeby poprawka obowiązywała od razu wszystkich graczy.`
      : `✏️ Edytujesz istniejący poziom (kod ${code}). Zapisz, żeby nadpisać go zmianami.`;
    editorSetScroll(0);
    redrawEditor();
  }

  function renderAdminBuiltInLevels(){
    const panel = document.getElementById('adminLevelsPanel');
    if(!isTester()){ panel.innerHTML = ''; return; }
    panel.innerHTML = `<div class="my-levels-empty" style="padding:6px 20px;color:#ffd23f;font-weight:bold;">🛠️ ADMIN: EDYCJA WBUDOWANYCH POZIOMÓW</div>` +
      LEVELS.map((lvlFn, i) => {
        const overridden = !!builtInOverrides[i];
        const name = (builtInOverrides[i] ? builtInOverrides[i].name : lvlFn().name) || ('Poziom ' + (i+1));
        return `
        <div class="my-level-row">
          <div class="my-level-info">
            <div class="my-level-name">${i+1}. ${escapeHtml(name)}${overridden ? ' <span style="color:#2ecc71;">(poprawiony)</span>' : ''}</div>
          </div>
          <div class="my-level-actions">
            <button class="my-level-btn edit" data-idx="${i}">✏️ EDYTUJ</button>
          </div>
        </div>`;
      }).join('');
    panel.querySelectorAll('.my-level-btn.edit').forEach(btn => {
      btn.onclick = () => {
        const idx = Number(btn.dataset.idx);
        const data = builtInLevelToEditorData(idx);
        loadLevelDataIntoEditor('BUILTIN:' + idx, data);
        showScreen('editor');
      };
    });
  }

  async function renderMyLevels(){
    const panel = document.getElementById('myLevelsPanel');
    if(!sb){
      panel.innerHTML = '<div class="my-levels-empty">Wymaga skonfigurowanego konta (Supabase).</div>';
      return;
    }
    if(!currentUser){
      panel.innerHTML = '<div class="my-levels-empty">Zaloguj się przez Google, żeby zobaczyć swoje poziomy.</div>';
      return;
    }
    panel.innerHTML = '<div class="my-levels-empty">Wczytywanie...</div>';
    const { data, error } = await sb.from('custom_levels')
      .select('code, level_data, created_at')
      .eq('creator_id', currentUser.id)
      .order('created_at', { ascending:false });
    if(error){
      panel.innerHTML = '<div class="my-levels-empty">⚠ Błąd wczytywania: ' + escapeHtml(error.message) + '</div>';
      return;
    }
    if(!data || data.length === 0){
      panel.innerHTML = '<div class="my-levels-empty">Nie masz jeszcze żadnych poziomów. Kliknij 🛠️ CREATE LEVEL, żeby stworzyć pierwszy!</div>';
      return;
    }
    panel.innerHTML = data.map(row => {
      const sizeBytes = new Blob([JSON.stringify(row.level_data)]).size;
      return `
      <div class="my-level-row">
        <div class="my-level-info">
          <div class="my-level-name">${escapeHtml(row.level_data.name || 'Poziom bez nazwy')}</div>
          <div class="my-level-code">KOD: ${row.code} • Waga: ${formatBytes(sizeBytes)}</div>
        </div>
        <div class="my-level-actions">
          <button class="my-level-btn play" data-code="${row.code}">▶ GRAJ</button>
          <button class="my-level-btn edit" data-code="${row.code}">✏️ EDYTUJ</button>
          <button class="my-level-btn delete" data-code="${row.code}">🗑 USUŃ</button>
        </div>
      </div>
    `;
    }).join('');

    panel.querySelectorAll('.my-level-btn.play').forEach(btn => {
      btn.onclick = async () => {
        const res = await loadCustomLevelByCode(btn.dataset.code);
        if(res.error){ alert(res.error); return; }
        showScreen('game');
        startLevel('custom', res.data);
      };
    });
    panel.querySelectorAll('.my-level-btn.edit').forEach(btn => {
      btn.onclick = () => {
        const row = data.find(r => r.code === btn.dataset.code);
        if(!row) return;
        loadLevelDataIntoEditor(row.code, row.level_data);
        showScreen('editor');
      };
    });
    panel.querySelectorAll('.my-level-btn.delete').forEach(btn => {
      btn.onclick = async () => {
        if(!confirm('Na pewno usunąć ten poziom? Tej operacji nie da się cofnąć.')) return;
        const { error } = await sb.from('custom_levels').delete().eq('code', btn.dataset.code).eq('creator_id', currentUser.id);
        if(error){ alert('Błąd usuwania: ' + error.message); return; }
        renderMyLevels();
      };
    });
  }

  function collectEditorData(){
    const grounds = editorElements.filter(e=>e.kind==='ground').map(e=>({x:e.x,y:e.y,w:e.w}));
    const platforms = editorElements.filter(e=>e.kind==='platform').map(e=>({x:e.x,y:e.y,w:e.w,h:e.h,isTrampoline:e.isTrampoline,isCrumbler:e.isCrumbler}));
    const pipes = editorElements.filter(e=>e.kind==='pipe').map(e=>({x:e.x,w:e.w,h:e.h}));
    const coins = editorElements.filter(e=>e.kind==='coin').map(e=>({x:e.x,y:e.y}));
    const enemies = editorElements.filter(e=>e.kind==='enemy').map(e=>({x:e.x,y:e.y,enemyType:e.enemyType}));
    const hazards = editorElements.filter(e=>e.kind==='hazard').map(e=>({x:e.x,w:e.w}));
    const movers = editorElements.filter(e=>e.kind==='mover').map(e=>({x:e.x,y:e.y,axis:e.axis,range:e.range}));
    const crushers = editorElements.filter(e=>e.kind==='crusher').map(e=>({x:e.x,w:e.w,h:e.h,topY:e.topY,bottomY:e.bottomY,speed:e.speed,t:e.t}));
    const shooters = editorElements.filter(e=>e.kind==='turret').map(e=>({x:e.x,y:e.y,dir:e.dir,interval:e.interval}));
    const bossEl = editorElements.find(e=>e.kind==='boss');
    return {
      name: document.getElementById('editorLevelName').value.trim() || 'Poziom bez nazwy',
      bg: document.getElementById('editorBgSelect').value,
      width: editorLevelW,
      grounds, platforms, pipes, coins, enemies, hazards, movers, crushers, shooters,
      boss: bossEl ? {x:bossEl.x, y:bossEl.y} : null,
      flag: editorFlag, spawn: editorSpawn, checkpoint: editorCheckpoint,
    };
  }

  document.getElementById('btnEditorTest').onclick = () => {
    const data = collectEditorData();
    if(data.grounds.length === 0){
      document.getElementById('editorSaveResult').textContent = '⚠ Dodaj chociaż jeden kawałek gruntu!';
      return;
    }
    editorTesting = true;
    showScreen('game');
    startLevel('custom', data);
  };

  document.getElementById('btnEditorSave').onclick = async () => {
    const resultEl = document.getElementById('editorSaveResult');
    if(!sb){ resultEl.textContent = '⚠ Zapis wymaga konta (Supabase).'; return; }
    if(!currentUser){ resultEl.textContent = '⚠ Zaloguj się przez Google, żeby zapisywać poziomy.'; return; }
    const data = collectEditorData();
    if(data.grounds.length === 0){
      resultEl.textContent = '⚠ Dodaj chociaż jeden kawałek gruntu, zanim zapiszesz!';
      return;
    }
    if(editorEditingCode && String(editorEditingCode).startsWith('BUILTIN:')){
      if(!isTester()){ resultEl.textContent = '⚠ Tylko admin może edytować wbudowane poziomy.'; return; }
      const levelIndex = Number(String(editorEditingCode).split(':')[1]);
      resultEl.textContent = 'Zapisywanie poprawki do wbudowanego poziomu...';
      const { error } = await sb.from('level_overrides').upsert({
        level_index: levelIndex, level_data: data, updated_by: currentUser.id,
      }, { onConflict: 'level_index' });
      if(error){
        resultEl.textContent = '⚠ Błąd zapisu poprawki: ' + error.message;
        return;
      }
      builtInOverrides[levelIndex] = data;
      resultEl.innerHTML = `✅ Zapisano poprawkę do wbudowanego poziomu ${levelIndex+1}! Zmiana obowiązuje od razu dla wszystkich graczy.`;
      return;
    }
    if(editorEditingCode){
      resultEl.textContent = 'Aktualizowanie...';
      const { error } = await sb.from('custom_levels')
        .update({ level_data: data })
        .eq('code', editorEditingCode)
        .eq('creator_id', currentUser.id);
      if(error){
        resultEl.textContent = '⚠ Błąd aktualizacji: ' + error.message;
        return;
      }
      resultEl.innerHTML = `✅ Zaktualizowano poziom! Kod pozostaje taki sam: <b style="font-size:20px;letter-spacing:4px;">${editorEditingCode}</b>`;
      return;
    }
    resultEl.textContent = 'Sprawdzanie limitu...';
    const { count, error: countError } = await sb.from('custom_levels')
      .select('*', { count:'exact', head:true })
      .eq('creator_id', currentUser.id);
    if(countError){ resultEl.textContent = '⚠ Błąd sprawdzania limitu: ' + countError.message; return; }
    if((count||0) >= MAX_CUSTOM_LEVELS){
      resultEl.textContent = `⚠ Masz już maksymalną liczbę poziomów (${MAX_CUSTOM_LEVELS}/${MAX_CUSTOM_LEVELS}). Usuń jakiś w "MOJE POZIOMY", żeby zapisać nowy.`;
      return;
    }
    resultEl.textContent = 'Zapisywanie...';
    const code = generateLobbyCode();
    const { error } = await sb.from('custom_levels').insert({
      code, creator_name: state.displayName || 'Gracz', creator_id: currentUser.id, level_data: data
    });
    if(error){
      resultEl.textContent = '⚠ Błąd zapisu: ' + error.message;
      return;
    }
    editorEditingCode = code;
    resultEl.innerHTML = `✅ Zapisano! Kod poziomu: <b style="font-size:20px;letter-spacing:4px;">${code}</b> — podaj go znajomemu, żeby zagrał na tym samym poziomie (też w multiplayer). Znajdziesz go też w "MOJE POZIOMY".`;
  };

  async function loadCustomLevelByCode(code){
    if(!sb) return { error: 'Multiplayer/poziomy własne wymagają konta (Supabase).' };
    const { data, error } = await sb.from('custom_levels').select('level_data').eq('code', code).single();
    if(error || !data) return { error: 'Nie znaleziono poziomu o tym kodzie.' };
    sb.rpc('increment_level_plays', { p_code: code }).then(()=>{}, ()=>{}); // licznik popularnosci - "fire and forget"
    return { data: data.level_data };
  }

  document.getElementById('btnEditorLoadCode').onclick = async () => {
    const code = document.getElementById('editorLoadCodeInput').value.trim().toUpperCase();
    const errEl = document.getElementById('editorLoadError');
    if(code.length !== 5){ errEl.textContent = 'Kod ma 5 znaków.'; return; }
    errEl.textContent = 'Wczytywanie...';
    const res = await loadCustomLevelByCode(code);
    if(res.error){ errEl.textContent = '⚠ ' + res.error; return; }
    errEl.textContent = '';
    showScreen('game');
    startLevel('custom', res.data);
  };
