// Rysowanie postaci: sprite, czapki, zarost, poswiata, drawPlayer.
// Klasyczny skrypt (bez IIFE): wspolny zasieg globalny z pozostalymi plikami js/.
  function skinColors(){
    const sk = SKINS.find(s => s.id === state.equippedSkin) || SKINS[0];
    return getEffectiveColors(sk.colors, state.equippedHat, state.equippedSkinTone);
  }

  function getEffectiveColors(baseColors, hatId, skinToneId){
    const hat = HATS.find(h=>h.id===hatId);
    const tone = SKIN_TONES.find(s=>s.id===skinToneId);
    return {
      hat: (hat && hat.color) ? hat.color : baseColors.hat,
      shirt: baseColors.shirt,
      overalls: baseColors.overalls,
      skin: (tone && tone.color) ? tone.color : baseColors.skin,
    };
  }

  function drawCharacterSprite(targetCtx, c, bob, airborne, flat, shine, sparkle, facialHair, hatStyle){
    const tctx = targetCtx;
    // ---- cien pod stopami ----
    if(!flat){
      tctx.fillStyle = 'rgba(0,0,0,.22)';
      tctx.beginPath();
      tctx.ellipse(20, 57, 15, 4, 0, 0, Math.PI*2);
      tctx.fill();
    }

    if(airborne){
      // ---- buty (podkurczone, skok) ----
      if(flat){ tctx.fillStyle = '#6b4118'; }
      else {
        const shoeGrad = tctx.createRadialGradient(13,44,2,13,46,10);
        shoeGrad.addColorStop(0,'#a9713a'); shoeGrad.addColorStop(1,'#6b4118');
        tctx.fillStyle = shoeGrad;
      }
      tctx.beginPath(); tctx.ellipse(13, 46, 8, 5.5, -0.3, 0, Math.PI*2); tctx.fill();
      tctx.beginPath(); tctx.ellipse(27, 46, 8, 5.5, 0.3, 0, Math.PI*2); tctx.fill();

      // ---- nogi podkurczone ----
      tctx.fillStyle = flat ? c.overalls : shade(c.overalls, -18);
      roundRectOn(tctx, 7, 36, 12, 12, 4); tctx.fill();
      roundRectOn(tctx, 21, 36, 12, 12, 4); tctx.fill();
    } else {
      // ---- buty ----
      if(flat){ tctx.fillStyle = '#6b4118'; }
      else {
        const shoeGrad = tctx.createRadialGradient(13,50,2,13,52,10);
        shoeGrad.addColorStop(0,'#a9713a'); shoeGrad.addColorStop(1,'#6b4118');
        tctx.fillStyle = shoeGrad;
      }
      tctx.beginPath(); tctx.ellipse(12, 52+bob, 9, 6, 0, 0, Math.PI*2); tctx.fill();
      tctx.beginPath(); tctx.ellipse(28, 52-bob, 9, 6, 0, 0, Math.PI*2); tctx.fill();

      // ---- nogi (overall) ----
      tctx.fillStyle = flat ? c.overalls : shade(c.overalls, -18);
      roundRectOn(tctx, 6, 38, 12, 16+bob, 4); tctx.fill();
      roundRectOn(tctx, 22, 38, 12, 16-bob, 4); tctx.fill();
    }

    // ---- tulow / kombinezon ----
    if(flat){ tctx.fillStyle = c.overalls; }
    else {
      const bodyGrad = tctx.createLinearGradient(4,20,36,44);
      bodyGrad.addColorStop(0, shade(c.overalls, 18));
      bodyGrad.addColorStop(1, shade(c.overalls, -12));
      tctx.fillStyle = bodyGrad;
    }
    roundRectOn(tctx, 4, 22, 32, 22, 8); tctx.fill();

    // szelki
    tctx.fillStyle = shade(c.overalls, -12);
    roundRectOn(tctx, 10, 15, 7, 10, 3); tctx.fill();
    roundRectOn(tctx, 23, 15, 7, 10, 3); tctx.fill();

    // guziki
    tctx.fillStyle = '#ffd23f';
    tctx.beginPath(); tctx.arc(13, 26, 2.6, 0, Math.PI*2); tctx.fill();
    tctx.beginPath(); tctx.arc(27, 26, 2.6, 0, Math.PI*2); tctx.fill();

    if(airborne){
      // ---- rece uniesione w gore (skok) ----
      tctx.fillStyle = flat ? c.shirt : (() => {
        const g = tctx.createLinearGradient(-4,0,4,20);
        g.addColorStop(0, shade(c.shirt,16)); g.addColorStop(1, shade(c.shirt,-10));
        return g;
      })();
      tctx.save();
      tctx.translate(3, 20); tctx.rotate(-0.55);
      roundRectOn(tctx, -5, -18, 10, 20, 5); tctx.fill();
      tctx.restore();
      tctx.save();
      tctx.translate(37, 20); tctx.rotate(0.55);
      roundRectOn(tctx, -5, -18, 10, 20, 5); tctx.fill();
      tctx.restore();

      // rekawiczki uniesione
      if(flat){ tctx.fillStyle = '#e8e8e8'; }
      else {
        const gloveGrad = tctx.createRadialGradient(1,0,1,1,0,7);
        gloveGrad.addColorStop(0,'#ffffff'); gloveGrad.addColorStop(1,'#d8d8d8');
        tctx.fillStyle = gloveGrad;
      }
      tctx.beginPath(); tctx.arc(-3, -1, 6.5, 0, Math.PI*2); tctx.fill();
      tctx.beginPath(); tctx.arc(43, -1, 6.5, 0, Math.PI*2); tctx.fill();
    } else {
      // ---- rece / rekawy ----
      if(flat){ tctx.fillStyle = c.shirt; }
      else {
        const sleeveGrad = tctx.createLinearGradient(-4,16,4,34);
        sleeveGrad.addColorStop(0, shade(c.shirt,16));
        sleeveGrad.addColorStop(1, shade(c.shirt,-10));
        tctx.fillStyle = sleeveGrad;
      }
      roundRectOn(tctx, -3, 17, 10, 20, 5); tctx.fill();
      roundRectOn(tctx, 33, 17, 10, 20, 5); tctx.fill();

      // rekawiczki
      if(flat){ tctx.fillStyle = '#e8e8e8'; }
      else {
        const gloveGrad = tctx.createRadialGradient(1,36,1,1,36,7);
        gloveGrad.addColorStop(0,'#ffffff'); gloveGrad.addColorStop(1,'#d8d8d8');
        tctx.fillStyle = gloveGrad;
      }
      tctx.beginPath(); tctx.arc(2, 36-bob*1.5, 6.5, 0, Math.PI*2); tctx.fill();
      tctx.beginPath(); tctx.arc(38, 36+bob*1.5, 6.5, 0, Math.PI*2); tctx.fill();
    }

    // ---- koszula pod szyja ----
    tctx.fillStyle = flat ? c.shirt : shade(c.shirt, 6);
    roundRectOn(tctx, 6, 16, 28, 9, 4); tctx.fill();

    // ---- glowa ----
    if(flat){ tctx.fillStyle = c.skin; }
    else {
      const headGrad = tctx.createRadialGradient(15,10,2,20,14,16);
      headGrad.addColorStop(0, shade(c.skin, 20));
      headGrad.addColorStop(1, shade(c.skin, -8));
      tctx.fillStyle = headGrad;
    }
    tctx.beginPath(); tctx.ellipse(20, 12, 13, 12, 0, 0, Math.PI*2); tctx.fill();

    // uszy
    tctx.fillStyle = shade(c.skin, -6);
    tctx.beginPath(); tctx.ellipse(8, 13, 3, 4, 0, 0, Math.PI*2); tctx.fill();

    // brwi - osobna nad kazdym okiem, lekko opadajace ku nosowi (przyjazny wyraz)
    tctx.strokeStyle = '#3a2a1a';
    tctx.lineWidth = 2;
    tctx.lineCap = 'round';
    if(airborne){
      tctx.beginPath(); tctx.moveTo(17.5, 3.6); tctx.quadraticCurveTo(21, 1.8, 25, 2.6); tctx.stroke();
      tctx.beginPath(); tctx.moveTo(26.5, 2.4); tctx.quadraticCurveTo(29.5, 1.8, 32, 3.4); tctx.stroke();
    } else {
      tctx.beginPath(); tctx.moveTo(17.5, 5.2); tctx.quadraticCurveTo(21, 3.6, 25, 4.6); tctx.stroke();
      tctx.beginPath(); tctx.moveTo(26.5, 4.4); tctx.quadraticCurveTo(29.5, 3.6, 32, 5.2); tctx.stroke();
    }

    // oczy - dwa, male i blisko siebie (widok lekko z ukosa); zrenice patrza w prawo, w skoku szerzej otwarte
    const eyeY = airborne ? 9.6 : 10.4;
    const eyeH = airborne ? 3.6 : 3.0;
    // blizsze oko
    tctx.fillStyle = '#fff';
    tctx.beginPath(); tctx.ellipse(21.8, eyeY, 2.5, eyeH, 0, 0, Math.PI*2); tctx.fill();
    tctx.fillStyle = '#2e6bd6';
    tctx.beginPath(); tctx.arc(22.5, eyeY + 0.3, 1.5, 0, Math.PI*2); tctx.fill();
    tctx.fillStyle = '#111';
    tctx.beginPath(); tctx.arc(22.9, eyeY + 0.3, 0.8, 0, Math.PI*2); tctx.fill();
    // dalsze oko (troche mniejsze)
    tctx.fillStyle = '#fff';
    tctx.beginPath(); tctx.ellipse(28.4, eyeY, 2.2, eyeH - 0.2, 0, 0, Math.PI*2); tctx.fill();
    tctx.fillStyle = '#2e6bd6';
    tctx.beginPath(); tctx.arc(29.0, eyeY + 0.3, 1.3, 0, Math.PI*2); tctx.fill();
    tctx.fillStyle = '#111';
    tctx.beginPath(); tctx.arc(29.4, eyeY + 0.3, 0.7, 0, Math.PI*2); tctx.fill();

    // nos: maly, w kolorze skory, z lekkim cieniem od dolu (bez rozowej poswiaty)
    if(!flat){
      tctx.fillStyle = shade(c.skin, -14);
      tctx.beginPath(); tctx.ellipse(25.3, 16.5, 3.1, 2.5, 0, 0, Math.PI*2); tctx.fill();
    }
    tctx.fillStyle = c.skin;
    tctx.beginPath(); tctx.ellipse(25.3, 15.7, 3.1, 2.5, 0, 0, Math.PI*2); tctx.fill();

    // ---- zarost (wasy / broda / kozia brodka / brak) ----
    const fh = facialHair || 'mustache';
    tctx.fillStyle = '#3a2a1a';
    if(fh === 'mustache'){
      tctx.beginPath();
      tctx.moveTo(18, 17);
      tctx.quadraticCurveTo(24, 14, 30, 17.5);
      tctx.quadraticCurveTo(24, 20.5, 18, 17);
      tctx.fill();
    } else if(fh === 'beard'){
      tctx.beginPath();
      tctx.moveTo(8.5, 11.5); tctx.quadraticCurveTo(12, 15, 19, 16.6); tctx.quadraticCurveTo(24.5, 14.6, 30.3, 16.8); tctx.quadraticCurveTo(33, 15.2, 33, 11.5);
      tctx.bezierCurveTo(34, 21, 28.5, 27.5, 20.7, 27.5); tctx.bezierCurveTo(12.5, 27.5, 7.5, 21, 8.5, 11.5);
      tctx.closePath(); tctx.fill();
    } else if(fh === 'goatee'){
      tctx.beginPath();
      tctx.moveTo(18, 17);
      tctx.quadraticCurveTo(24, 14, 30, 17.5);
      tctx.quadraticCurveTo(24, 20.5, 18, 17);
      tctx.fill();
      tctx.beginPath();
      tctx.ellipse(24, 21, 4, 4.5, 0, 0, Math.PI*2);
      tctx.fill();
    }
    else if(fh === 'pencil'){
      tctx.strokeStyle = '#3a2a1a'; tctx.lineWidth = 1.4; tctx.lineCap = 'round';
      tctx.beginPath(); tctx.moveTo(19, 17.4); tctx.quadraticCurveTo(24, 15.7, 30, 17.7); tctx.stroke();
    } else if(fh === 'stubble'){
      tctx.fillStyle = 'rgba(58,42,26,.5)';
      for(let i = 0; i < 130; i++){
        const r1 = Math.abs((Math.sin(i*12.9898)*43758.5453) % 1), r2 = Math.abs((Math.sin(i*78.233)*12345.6789) % 1);
        const dx = 11.5 + r1*20.5, dy = 15.5 + r2*9;
        if(((dx-20)/13)**2 + ((dy-12)/12)**2 <= 0.85){ tctx.beginPath(); tctx.arc(dx, dy, 0.5, 0, Math.PI*2); tctx.fill(); }
      }
    } else if(fh === 'sideburns'){
      // baki: waski pas od ucha wzdluz szczeki + wasy
      tctx.beginPath();
      tctx.moveTo(8.8, 8.5); tctx.quadraticCurveTo(9, 17, 14.5, 20.2); tctx.lineTo(15.2, 18.2); tctx.quadraticCurveTo(12, 16, 12.2, 8.5);
      tctx.closePath(); tctx.fill();
      tctx.beginPath();
      tctx.moveTo(18, 17); tctx.quadraticCurveTo(24, 14, 30, 17.5); tctx.quadraticCurveTo(24, 20.5, 18, 17);
      tctx.fill();
    } else if(fh === 'handlebar'){
      tctx.strokeStyle = '#3a2a1a'; tctx.lineWidth = 3; tctx.lineCap = 'round';
      tctx.beginPath(); tctx.moveTo(18.5, 17.6); tctx.quadraticCurveTo(24, 15, 29.5, 17.6); tctx.stroke();
      tctx.beginPath(); tctx.moveTo(18.5, 17.6); tctx.quadraticCurveTo(15, 19.5, 14.5, 15.5); tctx.stroke();
      tctx.beginPath(); tctx.moveTo(29.5, 17.6); tctx.quadraticCurveTo(33.5, 19.5, 33.5, 15.5); tctx.stroke();
    } else if(fh === 'walrus'){
      tctx.beginPath();
      tctx.moveTo(16.5, 16.5); tctx.quadraticCurveTo(24, 12.5, 31.5, 16.5);
      tctx.quadraticCurveTo(33.5, 21.5, 28, 21.5); tctx.quadraticCurveTo(24, 18.5, 20, 21.5);
      tctx.quadraticCurveTo(14.5, 21.5, 16.5, 16.5);
      tctx.fill();
    } else if(fh === 'vandyke'){
      tctx.beginPath();
      tctx.moveTo(18.5, 17); tctx.quadraticCurveTo(24, 14.5, 29.5, 17.3); tctx.quadraticCurveTo(24, 19.6, 18.5, 17);
      tctx.fill();
      tctx.beginPath();
      tctx.moveTo(21, 19.8); tctx.quadraticCurveTo(24, 21.5, 27, 19.8); tctx.lineTo(24, 28); tctx.closePath();
      tctx.fill();
    } else if(fh === 'fullbeard' || fh === 'santa'){
      const santa = (fh === 'santa');
      tctx.fillStyle = santa ? '#f4f4f4' : '#3a2a1a';
      tctx.beginPath();
      tctx.moveTo(8.5, 11.5); tctx.quadraticCurveTo(12, 15, 19, 16.6); tctx.quadraticCurveTo(24.5, 14.6, 30.3, 16.8); tctx.quadraticCurveTo(33, 15.2, 33, 11.5);
      if(santa){
        tctx.bezierCurveTo(35, 26, 29, 35, 20.7, 35); tctx.bezierCurveTo(12.5, 35, 6.5, 26, 8.5, 11.5);
      } else {
        tctx.bezierCurveTo(34.5, 24, 28, 31, 20.7, 37); tctx.bezierCurveTo(13.5, 31, 7, 24, 8.5, 11.5);
      }
      tctx.closePath(); tctx.fill();
      if(santa){ tctx.strokeStyle = 'rgba(0,0,0,.3)'; tctx.lineWidth = 0.9; tctx.stroke(); }
    }
    // 'none' - nic nie rysujemy (gladko ogolony)

    // ---- czapka (fason wybierany w personalizacji) ----
    drawHatStyle(tctx, c, hatStyle || 'cap', flat);

    // HIGH+: polysk na czapce i kombinezonie (dodaje "blasku")
    if(shine && !flat){
      tctx.save();
      tctx.globalAlpha = 0.25;
      tctx.fillStyle = '#ffffff';
      tctx.beginPath();
      tctx.ellipse(11, 0, 7, 3, -0.4, 0, Math.PI*2);
      tctx.fill();
      tctx.beginPath();
      tctx.ellipse(11, 28, 6, 10, -0.3, 0, Math.PI*2);
      tctx.fill();
      tctx.restore();
      // delikatna obwodka wokol glowy (rim light)
      tctx.strokeStyle = 'rgba(255,255,255,.35)';
      tctx.lineWidth = 1;
      tctx.beginPath(); tctx.ellipse(20, 12, 13, 12, 0, -2.4, -0.6); tctx.stroke();
    }

    // ULTRA: iskierki
    if(sparkle){
      const t = (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.004;
      drawSparkle(tctx, 34, -2, 4.5 + Math.sin(t)*1.8, t);
      drawSparkle(tctx, -1, 30, 3.6 + Math.cos(t*1.3)*1.5, t*1.4);
      drawSparkle(tctx, 39, 30, 3.2 + Math.sin(t*1.6)*1.4, t*1.7);
    }
  }

  function drawHatStyle(t, c, style, flat){
    const raised = (style === 'tophat' || style === 'cowboy' || style === 'wizard' || style === 'helmet' || style === 'sombrero' || style === 'bucket');
    if(raised){ t.save(); t.translate(0, -2); }   // szerokie rondo siedzi wyzej na czole, oczy zostaja widoczne
    const grad = (x0, y0, x1, y1) => {
      if(flat) return c.hat;
      const g = t.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, shade(c.hat, 22)); g.addColorStop(1, shade(c.hat, -10));
      return g;
    };
    if(style === 'tophat'){
      t.fillStyle = shade(c.hat, -16);
      t.beginPath(); t.ellipse(20, 2.5, 18.5, 3.4, 0, 0, Math.PI*2); t.fill();
      t.fillStyle = grad(9, -20, 31, 3); roundRectOn(t, 9, -20, 22, 23, 3); t.fill();
      t.fillStyle = shade(c.hat, -48); t.fillRect(9, -3, 22, 5.5);
    } else if(style === 'beanie'){
      t.fillStyle = grad(6, -10, 34, 4);
      t.beginPath(); t.ellipse(20, 3, 14.5, 13, 0, Math.PI, 0); t.fill();
      t.fillStyle = shade(c.hat, -18); roundRectOn(t, 5.5, 0, 29, 6, 3); t.fill();
      t.strokeStyle = 'rgba(0,0,0,.2)'; t.lineWidth = 1;
      for(let x = 8; x < 34; x += 4){ t.beginPath(); t.moveTo(x, 0.8); t.lineTo(x, 5.2); t.stroke(); }
      t.fillStyle = '#fff'; t.beginPath(); t.arc(20, -10.5, 4.6, 0, Math.PI*2); t.fill();
      t.fillStyle = 'rgba(0,0,0,.12)'; t.beginPath(); t.arc(21.4, -9.4, 2.6, 0, Math.PI*2); t.fill();
    } else if(style === 'cowboy'){
      t.fillStyle = shade(c.hat, -16);
      t.beginPath(); t.ellipse(20, 2.5, 20, 4.2, 0, 0, Math.PI*2); t.fill();
      t.fillStyle = grad(10, -12, 30, 3);
      t.beginPath();
      t.moveTo(10, 2.5); t.lineTo(11, -8); t.quadraticCurveTo(15, -13, 20, -7.5);
      t.quadraticCurveTo(25, -13, 29, -8); t.lineTo(30, 2.5); t.closePath(); t.fill();
      t.fillStyle = '#4a2f16'; t.fillRect(10.4, -2, 19.2, 3.6);
    } else if(style === 'crown'){
      const g = flat ? '#ffd23f' : (() => { const q = t.createLinearGradient(8, -13, 32, 5); q.addColorStop(0, '#ffe680'); q.addColorStop(1, '#d9a000'); return q; })();
      t.fillStyle = g;
      t.beginPath();
      t.moveTo(8, 4); t.lineTo(8, -10); t.lineTo(14, -3); t.lineTo(20, -13); t.lineTo(26, -3); t.lineTo(32, -10); t.lineTo(32, 4); t.closePath(); t.fill();
      t.fillStyle = '#e0a800'; t.fillRect(8, -1, 24, 5.5);
      t.fillStyle = c.hat;
      [14, 20, 26].forEach(x => { t.beginPath(); t.arc(x, 1.6, 1.7, 0, Math.PI*2); t.fill(); });
      t.fillStyle = '#fff';
      [[8, -10], [20, -13], [32, -10]].forEach(p => { t.beginPath(); t.arc(p[0], p[1], 1.7, 0, Math.PI*2); t.fill(); });
    } else if(style === 'wizard'){
      t.fillStyle = shade(c.hat, -16);
      t.beginPath(); t.ellipse(20, 3, 19.5, 3.7, 0, 0, Math.PI*2); t.fill();
      t.fillStyle = grad(5, -24, 35, 3);
      t.beginPath(); t.moveTo(5, 3); t.quadraticCurveTo(16, -3, 19, -24); t.quadraticCurveTo(30, -15, 35, 3); t.closePath(); t.fill();
      t.fillStyle = shade(c.hat, -40); t.fillRect(7.5, -1.2, 25, 3.2);
      drawSparkle(t, 17, -9, 2.6, 0.3);
      drawSparkle(t, 25, -3, 2.0, 0.6);
    } else if(style === 'helmet'){
      t.fillStyle = grad(5, -9, 35, 4);
      t.beginPath(); t.ellipse(20, 4, 15, 12.5, 0, Math.PI, 0); t.fill();
      t.fillStyle = shade(c.hat, -16); roundRectOn(t, 3, 3, 34, 4.4, 2); t.fill();
      t.fillStyle = shade(c.hat, 12); roundRectOn(t, 17, -9, 6, 12, 2); t.fill();
    } else if(style === 'headband'){
      t.fillStyle = shade(c.hat, -10);
      t.beginPath(); t.moveTo(7.5, 3); t.lineTo(-1, -0.5); t.lineTo(2.5, 4.6); t.closePath(); t.fill();
      t.beginPath(); t.moveTo(7.5, 5); t.lineTo(-2, 8.5); t.lineTo(3.5, 9); t.closePath(); t.fill();
      t.fillStyle = grad(6, 1, 34, 7); roundRectOn(t, 6.5, 1, 27, 5.6, 2.8); t.fill();
      t.fillStyle = '#cfd6df'; roundRectOn(t, 22, 1.8, 8, 4, 1); t.fill();
    } else if(style === 'flatcap'){
      t.fillStyle = grad(6, -8, 34, 4);
      t.beginPath(); t.moveTo(6, 3); t.quadraticCurveTo(5, -9, 20, -9); t.quadraticCurveTo(35, -9, 34.5, 1.5); t.quadraticCurveTo(20, 4.5, 6, 3); t.closePath(); t.fill();
      t.fillStyle = shade(c.hat, -18);
      t.beginPath(); t.ellipse(31.5, 3.2, 7.5, 2.6, 0.12, 0, Math.PI*2); t.fill();
      t.fillStyle = shade(c.hat, -28); t.beginPath(); t.arc(20, -8.6, 1.4, 0, Math.PI*2); t.fill();
    } else if(style === 'bucket'){
      t.fillStyle = shade(c.hat, -16);
      t.beginPath(); t.ellipse(20, 3.5, 17.5, 3.4, 0, 0, Math.PI*2); t.fill();
      t.fillStyle = grad(8, -9, 32, 3);
      t.beginPath(); t.moveTo(8, 3.5); t.lineTo(10, -8); t.quadraticCurveTo(20, -11.5, 30, -8); t.lineTo(32, 3.5); t.closePath(); t.fill();
      t.fillStyle = shade(c.hat, -32); t.fillRect(8.5, -1.5, 23, 2.6);
      t.strokeStyle = 'rgba(0,0,0,.18)'; t.lineWidth = 0.8;
      t.beginPath(); t.moveTo(9.4, -4.5); t.lineTo(30.6, -4.5); t.stroke();
    } else if(style === 'beret'){
      t.save(); t.translate(19, -1.5); t.rotate(-0.16);
      t.fillStyle = grad(-15, -7, 15, 7);
      t.beginPath(); t.ellipse(0, 0, 15.5, 7.2, 0, 0, Math.PI*2); t.fill();
      t.restore();
      t.fillStyle = shade(c.hat, -32); t.beginPath(); t.arc(20.2, -8, 1.5, 0, Math.PI*2); t.fill();
    } else if(style === 'party'){
      t.fillStyle = grad(11, -20, 29, 2);
      t.beginPath(); t.moveTo(11, 2); t.lineTo(20, -20); t.lineTo(29, 2); t.closePath(); t.fill();
      [['#fff', 17.2, -3], ['#ffd23f', 22.4, -7.5], ['#5ec8ff', 19.6, -12.4], ['#fff', 23.4, -1.2]].forEach(d => { t.fillStyle = d[0]; t.beginPath(); t.arc(d[1], d[2], 1.15, 0, Math.PI*2); t.fill(); });
      t.fillStyle = '#ffd23f'; t.beginPath(); t.arc(20, -20.5, 2.6, 0, Math.PI*2); t.fill();
    } else if(style === 'propeller'){
      t.fillStyle = grad(6, -10, 34, 4);
      t.beginPath(); t.ellipse(20, 3, 14.5, 13, 0, Math.PI, 0); t.fill();
      t.fillStyle = shade(c.hat, -18); roundRectOn(t, 5.5, 0, 29, 5, 2.5); t.fill();
      t.strokeStyle = 'rgba(0,0,0,.2)'; t.lineWidth = 0.9;
      [[10, 0], [20, 0], [30, 0]].forEach(q => { t.beginPath(); t.moveTo(20, -9.8); t.quadraticCurveTo((20 + q[0]) / 2 + (q[0] < 20 ? -2 : q[0] > 20 ? 2 : 0), -4, q[0], q[1]); t.stroke(); });
      t.fillStyle = '#555'; t.fillRect(19, -12.5, 2, 3.2);
      t.save(); t.translate(20, -13.4); t.rotate(-0.12);
      t.fillStyle = '#ffd23f'; t.beginPath(); t.ellipse(-6, 0, 6, 1.6, 0, 0, Math.PI*2); t.fill();
      t.fillStyle = '#5ec8ff'; t.beginPath(); t.ellipse(6, 0, 6, 1.6, 0, 0, Math.PI*2); t.fill();
      t.fillStyle = '#333'; t.beginPath(); t.arc(0, 0, 1.7, 0, Math.PI*2); t.fill();
      t.restore();
    } else if(style === 'catears'){
      t.fillStyle = c.hat;
      t.beginPath(); t.moveTo(8.5, 3.5); t.lineTo(7.5, -9.5); t.lineTo(17.5, 1); t.closePath(); t.fill();
      t.beginPath(); t.moveTo(31.5, 3.5); t.lineTo(32.5, -9.5); t.lineTo(22.5, 1); t.closePath(); t.fill();
      t.fillStyle = '#ffb3c7';
      t.beginPath(); t.moveTo(10, 1.4); t.lineTo(9.4, -5.6); t.lineTo(14.4, 0); t.closePath(); t.fill();
      t.beginPath(); t.moveTo(30, 1.4); t.lineTo(30.6, -5.6); t.lineTo(25.6, 0); t.closePath(); t.fill();
      t.fillStyle = grad(6, 0, 34, 6); roundRectOn(t, 6.5, 0.6, 27, 3.6, 1.8); t.fill();
    } else if(style === 'fez'){
      t.fillStyle = grad(10, -12, 30, 3);
      t.beginPath(); t.moveTo(9.5, 3); t.lineTo(12, -11); t.lineTo(28, -11); t.lineTo(30.5, 3); t.closePath(); t.fill();
      t.fillStyle = shade(c.hat, -22); t.beginPath(); t.ellipse(20, -11, 8, 1.9, 0, 0, Math.PI*2); t.fill();
      t.strokeStyle = '#ffd23f'; t.lineWidth = 1.4; t.lineCap = 'round';
      t.beginPath(); t.moveTo(22, -11); t.quadraticCurveTo(32, -13, 31.5, -3.5); t.stroke();
      t.fillStyle = '#ffd23f'; t.beginPath(); t.arc(31.5, -2.4, 1.7, 0, Math.PI*2); t.fill();
    } else if(style === 'santa'){
      t.fillStyle = grad(6, -15, 34, 4);
      t.beginPath(); t.moveTo(6, 3); t.quadraticCurveTo(9, -14, 24, -14); t.quadraticCurveTo(34, -13, 37, -1); t.lineTo(33, 3); t.closePath(); t.fill();
      t.fillStyle = '#f7f7f7'; roundRectOn(t, 5, 0, 30, 6, 3); t.fill();
      t.beginPath(); t.arc(37.5, -0.5, 3.6, 0, Math.PI*2); t.fill();
    } else if(style === 'chef'){
      t.fillStyle = flat ? '#f4f4f4' : (() => { const q = t.createLinearGradient(8, -16, 32, 4); q.addColorStop(0, '#ffffff'); q.addColorStop(1, '#dcdfe6'); return q; })();
      [[12.5, -8, 6.6], [20, -11.5, 7.8], [27.5, -8, 6.6]].forEach(q => { t.beginPath(); t.arc(q[0], q[1], q[2], 0, Math.PI*2); t.fill(); });
      roundRectOn(t, 9, -8, 22, 12, 3); t.fill();
      t.fillStyle = c.hat; t.fillRect(9, 0, 22, 4.6);
    } else if(style === 'pirate'){
      t.fillStyle = grad(2, -9, 38, 4);
      t.beginPath(); t.moveTo(1.5, 4.5); t.quadraticCurveTo(5, -8, 20, -9.5); t.quadraticCurveTo(35, -8, 38.5, 4.5);
      t.quadraticCurveTo(30, 0.6, 20, 2.4); t.quadraticCurveTo(10, 0.6, 1.5, 4.5); t.closePath(); t.fill();
      t.strokeStyle = '#e0b030'; t.lineWidth = 1.3;
      t.beginPath(); t.moveTo(2.4, 3.6); t.quadraticCurveTo(10, 0.4, 20, 2); t.quadraticCurveTo(30, 0.4, 37.6, 3.6); t.stroke();
      t.fillStyle = '#f2f2f2'; t.beginPath(); t.arc(20, -4.2, 2.6, 0, Math.PI*2); t.fill();
      t.fillRect(18.6, -2.4, 2.8, 2);
      t.fillStyle = shade(c.hat, -60);
      t.beginPath(); t.arc(18.9, -4.6, 0.65, 0, Math.PI*2); t.fill(); t.beginPath(); t.arc(21.1, -4.6, 0.65, 0, Math.PI*2); t.fill();
    } else if(style === 'sombrero'){
      t.fillStyle = shade(c.hat, -16);
      t.beginPath(); t.ellipse(20, 2.5, 24.5, 4.7, 0, 0, Math.PI*2); t.fill();
      t.fillStyle = grad(11, -14, 29, 3);
      t.beginPath(); t.moveTo(11, 2.5); t.quadraticCurveTo(11.5, -12, 20, -14.5); t.quadraticCurveTo(28.5, -12, 29, 2.5); t.closePath(); t.fill();
      t.fillStyle = '#ffd23f'; t.fillRect(11, -1.6, 18, 3.4);
      t.fillStyle = shade(c.hat, -40);
      for(let x = 13; x < 29; x += 4){ t.beginPath(); t.arc(x, 0.1, 0.9, 0, Math.PI*2); t.fill(); }
    } else if(style === 'viking'){
      t.fillStyle = '#f2e6c8'; t.strokeStyle = 'rgba(0,0,0,.35)'; t.lineWidth = 0.8;
      t.beginPath(); t.moveTo(7, -1); t.quadraticCurveTo(-4, -3, -3.5, -16); t.quadraticCurveTo(0, -8.5, 10, -4.5); t.closePath(); t.fill(); t.stroke();
      t.beginPath(); t.moveTo(33, -1); t.quadraticCurveTo(44, -3, 43.5, -16); t.quadraticCurveTo(40, -8.5, 30, -4.5); t.closePath(); t.fill(); t.stroke();
      t.fillStyle = flat ? '#aab2bd' : (() => { const q = t.createLinearGradient(6, -9, 34, 4); q.addColorStop(0, '#dfe4ea'); q.addColorStop(1, '#8f98a4'); return q; })();
      t.beginPath(); t.ellipse(20, 3, 14.5, 12.5, 0, Math.PI, 0); t.fill();
      t.fillStyle = c.hat; roundRectOn(t, 5.5, 0, 29, 5, 2); t.fill();
      t.fillStyle = '#eee';
      [9.5, 15, 20, 25, 30.5].forEach(x => { t.beginPath(); t.arc(x, 2.5, 0.8, 0, Math.PI*2); t.fill(); });
    } else if(style === 'horns'){
      t.fillStyle = grad(6, 0, 34, 6); roundRectOn(t, 6.5, 0.6, 27, 3.8, 1.9); t.fill();
      t.fillStyle = c.hat; t.strokeStyle = 'rgba(0,0,0,.32)'; t.lineWidth = 0.8;
      t.beginPath(); t.moveTo(9, 1.5); t.quadraticCurveTo(2, -4, 6.5, -15); t.quadraticCurveTo(11, -6.5, 15.5, 0.5); t.closePath(); t.fill(); t.stroke();
      t.beginPath(); t.moveTo(31, 1.5); t.quadraticCurveTo(38, -4, 33.5, -15); t.quadraticCurveTo(29, -6.5, 24.5, 0.5); t.closePath(); t.fill(); t.stroke();
      t.fillStyle = 'rgba(255,255,255,.28)';
      t.beginPath(); t.ellipse(8.4, -6, 0.9, 3.6, 0.35, 0, Math.PI*2); t.fill();
      t.beginPath(); t.ellipse(31.6, -6, 0.9, 3.6, -0.35, 0, Math.PI*2); t.fill();
    } else if(style === 'halo'){
      t.lineCap = 'round';
      t.strokeStyle = 'rgba(255,225,120,.35)'; t.lineWidth = 5.4;
      t.beginPath(); t.ellipse(20, -8.5, 10.5, 3.2, 0, 0, Math.PI*2); t.stroke();
      t.strokeStyle = flat ? '#ffd23f' : '#ffe680'; t.lineWidth = 2.4;
      t.beginPath(); t.ellipse(20, -8.5, 10.5, 3.2, 0, 0, Math.PI*2); t.stroke();
      t.strokeStyle = c.hat; t.lineWidth = 0.9;
      t.beginPath(); t.ellipse(20, -8.5, 10.5, 3.2, 0, Math.PI*0.15, Math.PI*0.85); t.stroke();
    } else if(style === 'antlers'){
      t.fillStyle = grad(6, 0, 34, 6); roundRectOn(t, 6.5, 0.6, 27, 3.8, 1.9); t.fill();
      t.strokeStyle = '#8a5a2e'; t.lineWidth = 2; t.lineCap = 'round'; t.lineJoin = 'round';
      const antler = (m) => {
        const X = x => m ? 40 - x : x;
        t.beginPath(); t.moveTo(X(12), 1); t.lineTo(X(9.5), -6); t.lineTo(X(7), -15); t.stroke();
        t.beginPath(); t.moveTo(X(9.5), -6); t.lineTo(X(4), -9.5); t.stroke();
        t.beginPath(); t.moveTo(X(8.3), -10.5); t.lineTo(X(12), -14.5); t.stroke();
      };
      antler(false); antler(true);
      t.fillStyle = c.hat; t.beginPath(); t.arc(20, 2.5, 1.7, 0, Math.PI*2); t.fill();
    } else if(style === 'unicorn'){
      t.fillStyle = grad(6, 0, 34, 6); roundRectOn(t, 6.5, 0.6, 27, 3.8, 1.9); t.fill();
      t.fillStyle = c.hat;
      t.beginPath(); t.moveTo(9, 1); t.lineTo(9.5, -7); t.lineTo(15.5, 0); t.closePath(); t.fill();
      t.beginPath(); t.moveTo(31, 1); t.lineTo(30.5, -7); t.lineTo(24.5, 0); t.closePath(); t.fill();
      t.fillStyle = flat ? '#fff3c8' : (() => { const q = t.createLinearGradient(17, -21, 23, 1); q.addColorStop(0, '#ffffff'); q.addColorStop(1, '#ffe08a'); return q; })();
      t.beginPath(); t.moveTo(16.5, 1.5); t.lineTo(20, -22); t.lineTo(23.5, 1.5); t.closePath(); t.fill();
      t.strokeStyle = shade(c.hat, 10); t.lineWidth = 1.1;
      [[-3, 0.3], [-8, -0.1], [-13, -0.5]].forEach(q => { t.beginPath(); t.moveTo(17.6 + q[1]*4, q[0]+3.5); t.lineTo(22.4 - q[1]*4, q[0]-0.5); t.stroke(); });
    } else if(style === 'flame'){
      const flame = (x, w, h, col) => {
        t.fillStyle = col; t.beginPath();
        t.moveTo(x - w, 3); t.quadraticCurveTo(x - w*1.15, -h*0.45, x - w*0.15, -h);
        t.quadraticCurveTo(x + w*0.05, -h*0.45, x + w*0.5, -h*0.62);
        t.quadraticCurveTo(x + w*1.2, -h*0.2, x + w, 3); t.closePath(); t.fill();
      };
      flame(20, 13, 23, c.hat);
      flame(12.5, 6.5, 13, shade(c.hat, 18));
      flame(28, 6.5, 12, shade(c.hat, 18));
      flame(20, 7.5, 14, shade(c.hat, 62));
      flame(20, 3.6, 7.5, '#fff6d0');
    } else if(style === 'pumpkin'){
      t.fillStyle = flat ? '#ff8a1f' : (() => { const q = t.createLinearGradient(6, -10, 34, 4); q.addColorStop(0, '#ffb04a'); q.addColorStop(1, '#e0650a'); return q; })();
      t.beginPath(); t.ellipse(20, -1.5, 15, 10.5, 0, 0, Math.PI*2); t.fill();
      t.strokeStyle = 'rgba(120,45,0,.35)'; t.lineWidth = 1;
      [-6.5, 0, 6.5].forEach(dx => { t.beginPath(); t.ellipse(20 + dx*0.5, -1.5, Math.abs(dx) + 4, 10.4, 0, -1.2, 1.2); t.stroke(); });
      t.fillStyle = c.hat; t.fillRect(18.4, -14, 3.6, 5.6);
      t.fillStyle = '#2f8a3a'; t.beginPath(); t.ellipse(24.5, -10.5, 4.3, 1.6, -0.5, 0, Math.PI*2); t.fill();
      t.fillStyle = '#ffe36a';
      t.beginPath(); t.moveTo(11.5, -4); t.lineTo(15.5, -4); t.lineTo(13.5, -7.6); t.closePath(); t.fill();
      t.beginPath(); t.moveTo(24.5, -4); t.lineTo(28.5, -4); t.lineTo(26.5, -7.6); t.closePath(); t.fill();
    } else if(style === 'wings'){
      t.fillStyle = grad(6, 0, 34, 6); roundRectOn(t, 6.5, 0.6, 27, 3.8, 1.9); t.fill();
      const wing = (m) => {
        const X = x => m ? 40 - x : x;
        t.fillStyle = flat ? '#f4f4f4' : (() => { const q = t.createLinearGradient(X(0), -14, X(10), 3); q.addColorStop(0, '#ffffff'); q.addColorStop(1, '#cfd8e6'); return q; })();
        t.strokeStyle = 'rgba(0,0,0,.22)'; t.lineWidth = 0.7;
        [[-3.5, -16, 9.5, 2], [-1, -11.5, 10.5, 0.8], [1.5, -7, 10, 0]].forEach(f => {
          t.beginPath(); t.moveTo(X(10), f[3] + 1); t.quadraticCurveTo(X(f[0]), f[1] + 2, X(f[0] - 1), f[1]); t.quadraticCurveTo(X(f[0] + 6), f[1] + 1, X(f[2] + 2), f[3] - 2); t.closePath(); t.fill(); t.stroke();
        });
      };
      wing(false); wing(true);
    } else if(style === 'astro'){
      t.fillStyle = flat ? '#f2f5fa' : (() => { const q = t.createLinearGradient(6, -12, 34, 5); q.addColorStop(0, '#ffffff'); q.addColorStop(1, '#bcc7d8'); return q; })();
      t.beginPath(); t.ellipse(20, 3.5, 16, 14, 0, Math.PI, 0); t.fill();
      t.fillStyle = c.hat; roundRectOn(t, 3.5, 2, 33, 4.4, 2); t.fill();
      t.fillStyle = 'rgba(120,200,255,.55)';
      t.beginPath(); t.ellipse(20, -3.5, 9.5, 5.2, 0, Math.PI*1.06, Math.PI*1.94); t.lineTo(20, -3); t.closePath(); t.fill();
      t.strokeStyle = 'rgba(255,255,255,.7)'; t.lineWidth = 1.2; t.lineCap = 'round';
      t.beginPath(); t.arc(20, 3.5, 11.5, Math.PI*1.12, Math.PI*1.34); t.stroke();
      t.strokeStyle = '#8b96a8'; t.lineWidth = 1.3;
      t.beginPath(); t.moveTo(29, -6); t.lineTo(32, -15); t.stroke();
      t.fillStyle = '#ff5a5a'; t.beginPath(); t.arc(32.2, -15.6, 1.7, 0, Math.PI*2); t.fill();
    } else if(style === 'kabuto'){
      t.fillStyle = shade(c.hat, -30);
      t.beginPath(); t.moveTo(3.5, 3); t.lineTo(9, 3); t.lineTo(9, 9); t.lineTo(2, 8); t.closePath(); t.fill();
      t.beginPath(); t.moveTo(36.5, 3); t.lineTo(31, 3); t.lineTo(31, 9); t.lineTo(38, 8); t.closePath(); t.fill();
      t.fillStyle = grad(5, -9, 35, 4);
      t.beginPath(); t.ellipse(20, 3.5, 15.5, 12.5, 0, Math.PI, 0); t.fill();
      t.fillStyle = shade(c.hat, -16); roundRectOn(t, 3.5, 2.6, 33, 4.4, 2); t.fill();
      t.strokeStyle = 'rgba(0,0,0,.22)'; t.lineWidth = 0.8;
      [12, 20, 28].forEach(x => { t.beginPath(); t.moveTo(x, 2.6); t.lineTo(20 + (x - 20) * 0.32, -8.6); t.stroke(); });
      t.strokeStyle = '#ffd23f'; t.lineWidth = 2; t.lineCap = 'round';
      t.beginPath(); t.arc(20, -7, 9.5, Math.PI*1.16, Math.PI*1.84); t.stroke();
      t.fillStyle = '#ffd23f'; t.beginPath(); t.arc(20, -6.5, 1.8, 0, Math.PI*2); t.fill();
    } else if(style === 'grandcrown'){
      const g = flat ? '#ffd23f' : (() => { const q = t.createLinearGradient(3, -22, 37, 6); q.addColorStop(0, '#fff0a0'); q.addColorStop(0.5, '#ffd23f'); q.addColorStop(1, '#c48a00'); return q; })();
      t.fillStyle = shade(c.hat, -20);
      t.beginPath(); t.moveTo(9, 2); t.lineTo(10, -8); t.quadraticCurveTo(20, -13, 30, -8); t.lineTo(31, 2); t.closePath(); t.fill();
      t.fillStyle = g;
      t.beginPath();
      t.moveTo(4, 5); t.lineTo(2.5, -14); t.lineTo(11, -5); t.lineTo(14.5, -18); t.lineTo(20, -6); t.lineTo(25.5, -18); t.lineTo(29, -5); t.lineTo(37.5, -14); t.lineTo(36, 5); t.closePath(); t.fill();
      t.fillStyle = '#c48a00'; t.fillRect(4, 0.5, 32, 4.8);
      [[2.5, -14], [14.5, -18], [25.5, -18], [37.5, -14]].forEach(q => { t.fillStyle = '#fff'; t.beginPath(); t.arc(q[0], q[1], 2, 0, Math.PI*2); t.fill(); });
      [[10, 3], [20, 3], [30, 3]].forEach((q, i) => { t.fillStyle = i === 1 ? '#3fa9ff' : c.hat; t.beginPath(); t.arc(q[0], q[1], 1.9, 0, Math.PI*2); t.fill(); });
      t.fillStyle = '#e8362a'; t.beginPath(); t.moveTo(20, -13); t.lineTo(22.6, -9); t.lineTo(20, -5); t.lineTo(17.4, -9); t.closePath(); t.fill();
    } else {
      // 'cap' - klasyczna czapka z daszkiem
      t.fillStyle = grad(4, -6, 34, 10);
      roundRectOn(t, 5, -5, 28, 13, 7); t.fill();
      t.fillStyle = shade(c.hat, -14);
      t.beginPath(); t.ellipse(11, 8, 9, 3.4, -0.15, 0, Math.PI*2); t.fill();
      t.fillStyle = '#fff';
      t.beginPath(); t.arc(19, 1, 4.6, 0, Math.PI*2); t.fill();
    }
    if(raised) t.restore();
  }

  function drawSparkle(tctx, x, y, r, rot){
    tctx.save();
    tctx.translate(x,y);
    tctx.rotate(rot);
    tctx.fillStyle = 'rgba(255,255,255,.85)';
    tctx.beginPath();
    tctx.moveTo(0,-r); tctx.lineTo(r*0.25,-r*0.25);
    tctx.lineTo(r,0); tctx.lineTo(r*0.25,r*0.25);
    tctx.lineTo(0,r); tctx.lineTo(-r*0.25,r*0.25);
    tctx.lineTo(-r,0); tctx.lineTo(-r*0.25,-r*0.25);
    tctx.closePath();
    tctx.fill();
    tctx.restore();
  }

  function roundRectOn(tctx, x,y,w,h,r){
    tctx.beginPath();
    tctx.moveTo(x+r,y);
    tctx.arcTo(x+w,y,x+w,y+h,r);
    tctx.arcTo(x+w,y+h,x,y+h,r);
    tctx.arcTo(x,y+h,x,y,r);
    tctx.arcTo(x,y,x+w,y,r);
    tctx.closePath();
  }
  function roundRect(x,y,w,h,r){ roundRectOn(ctx,x,y,w,h,r); }

  function drawPlayer(){
    const c = skinColors();
    const px = player.x - camera.x;
    const py = player.y;
    // sprite zaprojektowany w lokalnym ukladzie: szer ~40, wys ~56 (0,0 = czubek czapki)
    const scale = player.w/40;
    const airborne = !player.onGround;
    const bob = player.onGround ? Math.sin(player.animT)*1.5 : 0;
    const flat = gfxQuality === 0;
    const running = player.onGround && Math.abs(player.vx) > 3.5;
    const shine = gfxQuality >= 2;
    const sparkle = gfxQuality >= 3;
    // brak obrotu w powietrzu - postac ma wlasna, zaprojektowana poze skoku
    // (podkurczone nogi + uniesione rece w drawCharacterSprite), bez kolowrotka

    // HIGH/ULTRA: wyrazna, zawsze widoczna aura wokol postaci (latwo widoczna roznica vs LOW)
    if(gfxQuality >= 2){
      ctx.save();
      const auraR = gfxQuality >= 3 ? 34 : 22;
      const pulse = gfxQuality >= 3 ? (0.75 + Math.sin((timeAlive||0)*0.08)*0.25) : 1;
      const aura = ctx.createRadialGradient(px+player.w/2, py+player.h/2, 4, px+player.w/2, py+player.h/2, auraR*pulse);
      aura.addColorStop(0, gfxQuality>=3 ? 'rgba(255,225,120,.45)' : 'rgba(255,255,255,.18)');
      aura.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = aura;
      ctx.beginPath(); ctx.arc(px+player.w/2, py+player.h/2, auraR*pulse, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    // ULTRA: smugi predkosci przy biegu
    if(gfxQuality >= 3 && running){
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#ffffff';
      for(let i=1;i<=3;i++){
        const trailX = px + player.w/2 - player.facing*i*10;
        ctx.beginPath();
        ctx.ellipse(trailX, py+player.h*0.6, 10-i*2, 5, 0, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.restore();
    }
    // (usunieto smuge wirowania - byla powiazana z kolowrotkiem, ktorego juz nie ma)

    // TARCZA: pulsujacy niebieski babelek ochronny (widoczny niezaleznie od jakosci grafiki)
    if(player.shieldActive){
      ctx.save();
      const pulse = 0.6 + Math.sin((timeAlive||0)*0.3)*0.4;
      ctx.strokeStyle = `rgba(120,210,255,${0.5+pulse*0.4})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(px+player.w/2, py+player.h/2, player.w*0.85+pulse*3, player.h*0.62+pulse*3, 0, 0, Math.PI*2);
      ctx.stroke();
      ctx.fillStyle = `rgba(120,210,255,${0.08+pulse*0.08})`;
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    // HIGH+: miekki cien/poswiata pod postacia
    if(gfxQuality >= 2){
      ctx.shadowColor = airborne && gfxQuality>=3 ? 'rgba(255,230,120,.75)' : 'rgba(0,0,0,.35)';
      ctx.shadowBlur = airborne && gfxQuality>=3 ? 22 : 10;
      ctx.shadowOffsetY = 3;
    }
    ctx.translate(px + player.w/2, py + 28*scale);
    ctx.scale(player.facing*scale, scale);
    ctx.translate(-20, -28);
    drawCharacterSprite(ctx, c, bob, airborne, flat, shine, sparkle, state.equippedFacialHair, state.equippedHatStyle);
    ctx.restore();
  }
