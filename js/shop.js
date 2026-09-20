// Sklep: skiny, trails (flagi), personalizacja (czapki, skora, zarost), podglad postaci.
// Klasyczny skrypt (bez IIFE): wspolny zasieg globalny z pozostalymi plikami js/.
  let previewSkinId = state.equippedSkin;
  let previewFacing = 1;
  let previewRaf = null;
  let previewT = 0;

  function drawThumb(canvas, colors){
    const tctx = canvas.getContext('2d');
    tctx.clearRect(0,0,canvas.width,canvas.height);
    const scale = canvas.width/50;
    tctx.save();
    tctx.translate(canvas.width/2, 4);
    tctx.scale(scale, scale);
    tctx.translate(-20, 0);
    drawCharacterSprite(tctx, colors, 0, false, false, true, false);
    tctx.restore();
  }

  function renderPreviewFrame(){
    const canvas = document.getElementById('previewCanvas');
    if(!canvas) return;
    const pctx = canvas.getContext('2d');
    pctx.clearRect(0,0,canvas.width,canvas.height);
    const sk = SKINS.find(s => s.id === previewSkinId) || SKINS[0];
    const bob = Math.sin(previewT) * 2;
    previewT += 0.06;
    const scale = 3.0;
    pctx.save();
    pctx.translate(canvas.width/2, 72);
    pctx.scale(previewFacing*scale, scale);
    pctx.translate(-20, 0);
    drawCharacterSprite(pctx, getEffectiveColors(sk.colors, state.equippedHat, state.equippedSkinTone), bob, false, false, true, true, state.equippedFacialHair, state.equippedHatStyle);
    pctx.restore();
    const cc = document.getElementById('customPreviewCanvas');
    const cSec = document.getElementById('customizeSection');
    if(cc && cSec && !cSec.classList.contains('hidden')){
      const cctx = cc.getContext('2d');
      cctx.clearRect(0,0,cc.width,cc.height);
      const csk = SKINS.find(s => s.id === state.equippedSkin) || SKINS[0];
      const cs = 4.2;
      cctx.save();
      cctx.translate(cc.width/2, 108);
      cctx.scale(previewFacing*cs, cs);
      cctx.translate(-20, 0);
      drawCharacterSprite(cctx, getEffectiveColors(csk.colors, state.equippedHat, state.equippedSkinTone), bob, false, false, true, true, state.equippedFacialHair, state.equippedHatStyle);
      cctx.restore();
    }
    previewRaf = requestAnimationFrame(renderPreviewFrame);
  }
  function startPreviewLoop(){
    cancelAnimationFrame(previewRaf);
    renderPreviewFrame();
  }
  function stopPreviewLoop(){
    cancelAnimationFrame(previewRaf);
  }

  document.getElementById('btnRotate').onclick = () => { previewFacing *= -1; };
  document.getElementById('btnRotate2').onclick = () => { previewFacing *= -1; };

  function updateBuyEquipButton(){
    const sk = SKINS.find(s => s.id === previewSkinId) || SKINS[0];
    const owned = state.ownedSkins.includes(sk.id);
    const equipped = state.equippedSkin === sk.id;
    const btn = document.getElementById('btnBuyEquip');
    if(!btn) return;
    if(equipped){
      btn.textContent = '✅ ZAŁOŻONE';
      btn.disabled = true;
    } else if(owned){
      btn.textContent = '👕 ZAŁÓŻ';
      btn.disabled = false;
    } else {
      btn.textContent = `🪙 KUP ZA ${sk.price}`;
      btn.disabled = state.wallet < sk.price;
    }
  }

  document.getElementById('btnBuyEquip').onclick = () => {
    const sk = SKINS.find(s => s.id === previewSkinId) || SKINS[0];
    const owned = state.ownedSkins.includes(sk.id);
    if(owned){
      state.equippedSkin = sk.id;
      renderShop();
      saveProfile();
    } else if(state.wallet >= sk.price){
      state.wallet -= sk.price;
      state.totalSpent += sk.price;
      state.ownedSkins.push(sk.id);
      state.equippedSkin = sk.id;
      renderShop();
      saveProfile();
    }
  };

  function isTester(){
    return !!(currentUser && currentUser.email === 'tymurr427@gmail.com');
  }

  document.getElementById('btnBuyLife').onclick = () => {
    if(isTester()){
      state.extraLives += 1;
      renderShop();
      saveProfile();
      AudioEngine.sfxCoin();
    } else if(state.wallet >= 100){
      state.wallet -= 100;
      state.totalSpent += 100;
      state.extraLives += 1;
      renderShop();
      saveProfile();
      AudioEngine.sfxCoin();
    }
  };

  document.getElementById('btnBuyShield').onclick = () => {
    if(isTester()){
      state.shields += 1;
      renderShop();
      saveProfile();
      AudioEngine.sfxCoin();
    } else if(state.wallet >= 150){
      state.wallet -= 150;
      state.totalSpent += 150;
      state.shields += 1;
      renderShop();
      saveProfile();
      AudioEngine.sfxCoin();
    }
  };

  function renderShop(){
    const grid = document.getElementById('shopGrid');
    grid.innerHTML = '';
    SKINS.forEach(sk => {
      const owned = state.ownedSkins.includes(sk.id);
      const equipped = state.equippedSkin === sk.id;
      const previewed = previewSkinId === sk.id;
      const card = document.createElement('div');
      card.className = 'skin-card' + (equipped ? ' selected':'') + (previewed && !equipped ? ' previewed':'') + (!owned && state.wallet < sk.price ? ' locked':'');
      card.innerHTML = `
        <canvas class="skin-thumb" width="70" height="90"></canvas>
        <div class="skin-name">${sk.name}</div>
        ${owned ? `<div class="buy-tag">${equipped ? 'ZAŁOŻONE' : 'POSIADASZ'}</div>` : `<div class="skin-price">🪙 ${sk.price}</div>`}
      `;
      card.onclick = () => {
        previewSkinId = sk.id;
        document.getElementById('previewName').textContent = sk.name;
        renderShop();
      };
      grid.appendChild(card);
      drawThumb(card.querySelector('.skin-thumb'), sk.colors);
    });
    document.getElementById('shopCoins').textContent = state.wallet;
    const previewSk = SKINS.find(s => s.id === previewSkinId) || SKINS[0];
    document.getElementById('previewName').textContent = previewSk.name;
    updateBuyEquipButton();
    startPreviewLoop();
    document.getElementById('extraLivesCount').textContent = state.extraLives;
    const buyLifeBtn = document.getElementById('btnBuyLife');
    document.getElementById('shieldsCount').textContent = state.shields;
    const buyShieldBtn = document.getElementById('btnBuyShield');
    if(isTester()){
      buyLifeBtn.disabled = false;
      buyLifeBtn.textContent = '🆓 KUP ŻYCIE (DARMOWE)';
      buyShieldBtn.disabled = false;
      buyShieldBtn.textContent = '🆓 KUP TARCZĘ (DARMOWE)';
    } else {
      buyLifeBtn.disabled = state.wallet < 100;
      buyLifeBtn.textContent = '🪙 KUP ŻYCIE (100)';
      buyShieldBtn.disabled = state.wallet < 150;
      buyShieldBtn.textContent = '🪙 KUP TARCZĘ (150)';
    }
    renderTrails();
  }

  function renderTrails(){
    const grid = document.getElementById('trailsGrid');
    if(!grid) return;
    grid.innerHTML = '';
    TRAILS.forEach(tr => {
      const owned = state.ownedTrails.includes(tr.id);
      const equipped = state.equippedTrail === tr.id;
      const afford = isTester() || state.wallet >= tr.price;
      const card = document.createElement('div');
      card.className = 'trail-card' + (equipped ? ' selected':'') + (!owned && !afford ? ' locked':'');
      card.innerHTML = `
        <div class="trail-preview-strip"></div>
        <div class="trail-name">${tr.name}</div>
        ${owned ? `<div class="buy-tag">${equipped ? 'ZAŁOŻONE' : 'POSIADASZ'}</div>` : `<div class="trail-price">${isTester() ? '🆓 DARMOWE' : '🪙 ' + tr.price}</div>`}
      `;
      const strip = card.querySelector('.trail-preview-strip');
      if(tr.id === 'none'){
        strip.style.background = 'rgba(255,255,255,.06)';
      } else {
        const cv = document.createElement('canvas');
        cv.width = 160; cv.height = 56;
        cv.style.cssText = 'width:100%;height:100%;display:block;';
        strip.appendChild(cv);
        const tg = cv.getContext('2d');
        tg.scale(2, 2);
        drawMiniFlag(40, 14, 80, 28, tr.id, tr.colors, tg);   // ta sama funkcja co w grze
      }
      card.onclick = () => {
        if(owned){
          state.equippedTrail = tr.id;
          renderTrails();
          saveProfile();
        } else if(afford){
          if(!isTester()){
            state.wallet -= tr.price;
            state.totalSpent += tr.price;
          }
          state.ownedTrails.push(tr.id);
          state.equippedTrail = tr.id;
          renderTrails();
          saveProfile();
          AudioEngine.sfxCoin();
        }
      };
      grid.appendChild(card);
    });
    document.getElementById('shopCoins').textContent = state.wallet;
  }

  function renderCustomizeGrid(gridId, items, ownedArrName, equippedFieldName, previewFn, compact){
    const grid = document.getElementById(gridId);
    if(!grid) return;
    grid.innerHTML = '';
    grid.classList.toggle('compact', !!compact);
    items.forEach(it => {
      const owned = state[ownedArrName].includes(it.id);
      const equipped = state[equippedFieldName] === it.id;
      const afford = isTester() || state.wallet >= it.price;
      const card = document.createElement('div');
      card.className = 'trail-card' + (compact ? ' compact' : '') + (equipped ? ' selected':'') + (!owned && !afford ? ' locked':'');
      if(compact) card.title = it.name;
      card.innerHTML = `
        ${previewFn(it)}
        <div class="trail-name">${it.name}</div>
        ${owned ? `<div class="buy-tag">${equipped ? 'ZAŁOŻONE' : 'POSIADASZ'}</div>` : `<div class="trail-price">${isTester() ? '🆓 DARMOWE' : '🪙 ' + it.price}</div>`}
      `;
      card.onclick = () => {
        if(owned){
          state[equippedFieldName] = it.id;
          renderCustomize();
          saveProfile();
        } else if(afford){
          if(!isTester()){ state.wallet -= it.price; state.totalSpent += it.price; }
          state[ownedArrName].push(it.id);
          state[equippedFieldName] = it.id;
          renderCustomize();
          saveProfile();
          AudioEngine.sfxCoin();
        }
      };
      grid.appendChild(card);
    });
    document.getElementById('shopCoins').textContent = state.wallet;
  }

  function renderCustomize(){
    renderCustomizeGrid('hatStylesGrid', HAT_STYLES, 'ownedHatStyles', 'equippedHatStyle',
      (it) => `<canvas class="facial-thumb" data-hat="${it.id}" width="96" height="96"></canvas>`, true);
    document.querySelectorAll('#hatStylesGrid canvas.facial-thumb').forEach(cv => drawHatThumb(cv, cv.dataset.hat));
    renderCustomizeGrid('hatsGrid', HATS, 'ownedHats', 'equippedHat',
      (it) => `<div class="customize-swatch" style="background:${it.color || 'linear-gradient(45deg,#999,#ccc)'};"></div>`, true);
    renderCustomizeGrid('skinTonesGrid', SKIN_TONES, 'ownedSkinTones', 'equippedSkinTone',
      (it) => `<div class="customize-swatch" style="background:${it.color || 'linear-gradient(45deg,#999,#ccc)'};"></div>`, true);
    renderCustomizeGrid('facialHairGrid', FACIAL_HAIR, 'ownedFacialHair', 'equippedFacialHair',
      (it) => `<canvas class="facial-thumb" data-fh="${it.id}" width="96" height="96"></canvas>`, true);
    document.querySelectorAll('#facialHairGrid canvas.facial-thumb').forEach(cv => drawFacialThumb(cv, cv.dataset.fh));
  }

  // miniaturka czapki: wycinek postaci z glowa (ten sam rysunek co w grze)
  function drawHatThumb(canvas, styleId){
    const c = canvas.getContext('2d');
    c.clearRect(0,0,canvas.width,canvas.height);
    const sk = SKINS.find(s => s.id === state.equippedSkin) || SKINS[0];
    const colors = getEffectiveColors(sk.colors, state.equippedHat, state.equippedSkinTone);
    const sc = canvas.width / 40;
    c.save();
    c.translate(canvas.width/2, canvas.height/2);
    c.scale(sc, sc);
    c.translate(-20, 7);
    drawCharacterSprite(c, colors, 0, false, true, false, false, state.equippedFacialHair, styleId);
    c.restore();
  }

  // miniaturka twarzy z prawdziwym zarostem (ten sam rysunek co w grze)
  function drawFacialThumb(canvas, fh){
    const c = canvas.getContext('2d');
    c.clearRect(0,0,canvas.width,canvas.height);
    const sk = SKINS.find(s => s.id === state.equippedSkin) || SKINS[0];
    const colors = getEffectiveColors(sk.colors, state.equippedHat, state.equippedSkinTone);
    const sc = canvas.width / 34;
    c.save();
    c.translate(canvas.width/2, canvas.height/2);
    c.scale(sc, sc);
    c.translate(-21, -17);
    drawCharacterSprite(c, colors, 0, false, true, false, false, fh, state.equippedHatStyle);
    c.restore();
  }

  function showShopTab(tab){
    const tabs = { skins:'tabSkins', trails:'tabTrails', customize:'tabCustomize' };
    const sections = { skins:'skinsSection', trails:'trailsSection', customize:'customizeSection' };
    Object.keys(tabs).forEach(k => {
      document.getElementById(tabs[k]).classList.toggle('active', k===tab);
      document.getElementById(sections[k]).classList.toggle('hidden', k!==tab);
    });
    if(tab === 'customize') renderCustomize();
  }
  document.getElementById('tabSkins').onclick = () => showShopTab('skins');
  document.getElementById('tabTrails').onclick = () => showShopTab('trails');
  document.getElementById('tabCustomize').onclick = () => showShopTab('customize');
