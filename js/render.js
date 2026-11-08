// Rysowanie swiata: tlo, platformy, monety, boss, przeszkody, wrogowie.
// Klasyczny skrypt (bez IIFE): wspolny zasieg globalny z pozostalymi plikami js/.
  function shade(hex, percent){
    const num = parseInt(hex.replace('#',''),16);
    let r = (num>>16) + Math.round(255*percent/100);
    let g = ((num>>8)&0xff) + Math.round(255*percent/100);
    let b = (num&0xff) + Math.round(255*percent/100);
    r = Math.max(0,Math.min(255,r));
    g = Math.max(0,Math.min(255,g));
    b = Math.max(0,Math.min(255,b));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function bgColors(){
    if(level.bg==='night') return {sky1:'#0b1233', sky2:'#1c2a5e', hill:'#152a4a', sun:'#dfe7ff'};
    if(level.bg==='dusk') return {sky1:'#8a4a8f', sky2:'#e0764f', hill:'#3d2352', sun:'#ffdca0'};
    if(level.bg==='volcano') return {sky1:'#3a0e0e', sky2:'#b8451c', hill:'#2a0a0a', sun:'#ff8a3d'};
    if(level.bg==='ice') return {sky1:'#bfe9ff', sky2:'#eaf7ff', hill:'#6fb8d8', sun:'#ffffff'};
    if(level.bg==='desert') return {sky1:'#ffdca0', sky2:'#ffb877', hill:'#c9862f', sun:'#fff2c9'};
    if(level.bg==='aurora') return {sky1:'#0a1a2e', sky2:'#123d3a', hill:'#0a2e28', sun:'#9dffcf'};
    if(level.bg==='forest') return {sky1:'#bfe3c9', sky2:'#eaffe0', hill:'#2f7d32', sun:'#fff7c2'};
    if(level.bg==='cave') return {sky1:'#1a1522', sky2:'#2e2438', hill:'#120d18', sun:'#b98cff'};
    if(level.bg==='beach') return {sky1:'#7fd8ff', sky2:'#ffe9b3', hill:'#e8c07d', sun:'#fff7c2'};
    if(level.bg==='candy') return {sky1:'#ffb3e6', sky2:'#fff0fa', hill:'#ff6fae', sun:'#fff7c2'};
    if(level.bg==='space') return {sky1:'#05030f', sky2:'#16103a', hill:'#0a0620', sun:'#9dd1ff'};
    if(level.bg==='autumn') return {sky1:'#ffcf8c', sky2:'#ffe9c2', hill:'#b5651d', sun:'#fff2c9'};
    if(level.bg==='underwater') return {sky1:'#013a63', sky2:'#2a6f97', hill:'#012a4a', sun:'#8ecae6'};
    return {sky1:'#5c94fc', sky2:'#a8d8ff', hill:'#3fae4a', sun:'#fff7c2'};
  }

  function drawBackground(){
    const bc = bgColors();

    if(gfxQuality === 0){
      // LOW: plaskie tlo, bez gradientu, bez chmur/slonca, minimalne wzgorza
      ctx.fillStyle = bc.sky2;
      ctx.fillRect(0,0,W,H);
      ctx.fillStyle = bc.hill;
      for(let i=0;i<3;i++){
        const hx = ((i*420 - camera.x*0.5) % (level.width+420) + level.width+420) % (level.width+420) - 210;
        ctx.beginPath();
        ctx.arc(hx, GROUND_Y+30, 90, Math.PI, 0);
        ctx.fill();
      }
      return;
    }

    const grad = ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0, bc.sky1);
    grad.addColorStop(1, bc.sky2);
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,W,H);

    // HIGH+: gwiazdki na niebie nocnym
    if(gfxQuality >= 2 && (level.bg==='night' || level.bg==='volcano' || level.bg==='aurora' || level.bg==='cave' || level.bg==='space')){
      for(let i=0;i<40;i++){
        const sx = (i*137) % W;
        const sy = (i*71) % (H*0.5);
        const twinkle = 0.4 + 0.4*Math.abs(Math.sin((timeAlive||0)*0.03 + i));
        ctx.fillStyle = `rgba(255,255,255,${twinkle.toFixed(2)})`;
        ctx.fillRect(sx, sy, 2, 2);
      }
    }

    // ULTRA: falujaca zorza polarna na niebie (tylko motyw 'aurora')
    if(gfxQuality >= 2 && level.bg==='aurora'){
      ctx.save();
      ctx.globalAlpha = 0.25;
      for(let band=0; band<2; band++){
        ctx.beginPath();
        const baseY = 60 + band*50;
        ctx.moveTo(0, baseY);
        for(let bx=0; bx<=W; bx+=40){
          const wy = baseY + Math.sin((timeAlive||0)*0.02 + bx*0.01 + band*2) * 22;
          ctx.lineTo(bx, wy);
        }
        ctx.lineTo(W, baseY+90); ctx.lineTo(0, baseY+90);
        ctx.closePath();
        ctx.fillStyle = band===0 ? '#3dffb0' : '#8a5cff';
        ctx.fill();
      }
      ctx.restore();
    }

    // HIGH+: aureola wokol slonca
    if(gfxQuality >= 2){
      ctx.save();
      ctx.globalAlpha = 0.35;
      const sunGlow = ctx.createRadialGradient(W*0.82,H*0.16,10,W*0.82,H*0.16,60);
      sunGlow.addColorStop(0, bc.sun);
      sunGlow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sunGlow;
      ctx.beginPath(); ctx.arc(W*0.82, H*0.16, 60, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
    // ULTRA: delikatne promienie slonca (obracajace sie powoli)
    if(gfxQuality >= 3){
      ctx.save();
      ctx.translate(W*0.82, H*0.16);
      ctx.rotate((timeAlive||0)*0.002);
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = '#fff';
      for(let i=0;i<8;i++){
        ctx.rotate(Math.PI/4);
        ctx.fillRect(-3, 0, 6, 140);
      }
      ctx.restore();
    }

    // dalekie gory - najwolniejsza warstwa parallaksy, z tylu za chmurami
    ctx.fillStyle = shade(bc.hill, -16);
    for(let i=0;i<6;i++){
      const hx = ((i*360 - camera.x*0.15) % (level.width+360) + level.width+360) % (level.width+360) - 180;
      ctx.beginPath();
      ctx.moveTo(hx-120, GROUND_Y+25);
      ctx.lineTo(hx-20, GROUND_Y-110);
      ctx.lineTo(hx+20, GROUND_Y-110);
      ctx.lineTo(hx+120, GROUND_Y+25);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = bc.sun;
    ctx.beginPath(); ctx.arc(W*0.82, H*0.16, 34, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,.9)';
    const cloudCount = gfxQuality >= 2 ? 8 : 6;
    for(let i=0;i<cloudCount;i++){
      const cx = ((i*300 - camera.x*0.3) % (level.width+300) + level.width+300) % (level.width+300) - 150;
      const bob = gfxQuality >= 2 ? Math.sin((timeAlive||0)*0.01 + i)*4 : 0;
      drawCloud(cx, H*0.15 + (i%2)*30 + bob);
    }
    ctx.fillStyle = bc.hill;
    for(let i=0;i<8;i++){
      const hx = ((i*260 - camera.x*0.5) % (level.width+260) + level.width+260) % (level.width+260) - 130;
      ctx.beginPath();
      ctx.arc(hx, GROUND_Y+30, 90, Math.PI, 0);
      ctx.fill();
    }

    // bliskie krzaki - szybsza warstwa parallaksy, tuz przed gruntem
    if(gfxQuality >= 1){
      ctx.fillStyle = shade(bc.hill, -28);
      for(let i=0;i<14;i++){
        const bx = ((i*170 - camera.x*0.75) % (level.width+170) + level.width+170) % (level.width+170) - 85;
        ctx.beginPath();
        ctx.ellipse(bx, GROUND_Y+8, 34, 15, 0, Math.PI, 0);
        ctx.fill();
      }
    }

    // ULTRA: delikatna winieta po brzegach ekranu
    if(gfxQuality >= 3){
      const vg = ctx.createRadialGradient(W/2,H/2,H*0.4,W/2,H/2,H*0.9);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,.35)');
      ctx.fillStyle = vg;
      ctx.fillRect(0,0,W,H);
    }
  }
  function drawCloud(x,y){
    ctx.beginPath();
    ctx.arc(x,y,18,0,Math.PI*2);
    ctx.arc(x+20,y-8,14,0,Math.PI*2);
    ctx.arc(x+36,y,18,0,Math.PI*2);
    ctx.fill();
  }

  // zabkowana (nierowna) gorna krawedz bloku-gruntu - wspolna dla zwyklego/lodowego/piaskowego gruntu
  function jaggedTopEdge(xx, topY, w, toothH, color){
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(xx, topY+toothH);
    const teeth = Math.max(2, Math.round(w/14));
    for(let i=0;i<=teeth;i++){
      const tx = xx + (w*i/teeth);
      const ty = topY + (i%2===0 ? 0 : -4);
      ctx.lineTo(tx, ty);
    }
    ctx.lineTo(xx+w, topY+toothH);
    ctx.closePath();
    ctx.fill();
    return teeth;
  }

  function drawPlatforms(){
    for(const p of level.platforms){
      const x = p.x - camera.x;
      if(x+p.w < 0 || x > W) continue;
      if(p.isTrampoline){
        if(p.bounceAnim > 0) p.bounceAnim--;
        const squash = p.bounceAnim > 0 ? p.bounceAnim/10 : 0;
        ctx.save();
        if(gfxQuality >= 1){
          ctx.fillStyle = 'rgba(0,0,0,.2)';
          ctx.beginPath(); ctx.ellipse(x+p.w/2, p.y+p.h+5, p.w/2.2, 4, 0, 0, Math.PI*2); ctx.fill();
        }
        // metalowa baza - gradient zamiast plaskiego brazu
        if(gfxQuality === 0){ ctx.fillStyle = '#7a4a1e'; }
        else { const bg = ctx.createLinearGradient(x,0,x+p.w,0); bg.addColorStop(0,'#5a3613'); bg.addColorStop(0.5,'#8a5a2e'); bg.addColorStop(1,'#5a3613'); ctx.fillStyle = bg; }
        ctx.fillRect(x, p.y+p.h-6, p.w, 6);
        // powierzchnia - gradient czerwieni
        const topY = p.y + squash*6, surfH = p.h-6-squash*6;
        if(gfxQuality === 0){ ctx.fillStyle = '#ff5f6d'; }
        else { const rg = ctx.createLinearGradient(x,topY,x,topY+surfH); rg.addColorStop(0,'#ff8a93'); rg.addColorStop(0.5,'#ff5f6d'); rg.addColorStop(1,'#d8343f'); ctx.fillStyle = rg; }
        ctx.fillRect(x, topY, p.w, surfH);
        ctx.strokeStyle = '#c0392b';
        ctx.lineWidth = 2;
        for(let sx=6; sx<p.w-3; sx+=12) { ctx.beginPath(); ctx.moveTo(x+sx, p.y+p.h-6); ctx.lineTo(x+sx+6, topY); ctx.stroke(); }
        if(gfxQuality >= 1){
          ctx.fillStyle = 'rgba(255,255,255,.3)';
          ctx.fillRect(x, topY, p.w, 2);
        }
        // pierscien "pop" przy odbiciu
        if(gfxQuality >= 1 && p.bounceAnim > 6){
          const ringA = (p.bounceAnim-6)/4;
          ctx.save(); ctx.globalAlpha = ringA*0.6;
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(x+p.w/2, p.y, p.w*0.4*(1.3-ringA*0.3), 6, 0, 0, Math.PI*2); ctx.stroke();
          ctx.restore();
        }
        ctx.restore();
        continue;
      }
      if(p.isCrumbler){
        if(p.state === 'gone') continue;
        const shaking = p.state === 'shaking';
        const shakeX = shaking ? (Math.random()*4-2) : 0;
        ctx.save();
        if(gfxQuality === 0){
          ctx.globalAlpha = shaking ? (0.5 + Math.sin((p.timer||0)*0.9)*0.3) : 1;
          ctx.fillStyle = shaking ? '#8a5a3a' : '#a06a3e';
        } else {
          const g = ctx.createLinearGradient(x,p.y,x,p.y+p.h);
          if(shaking){ g.addColorStop(0,'#a06a3e'); g.addColorStop(1,'#6e4327'); }
          else { g.addColorStop(0,'#b87d48'); g.addColorStop(1,'#7a4e28'); }
          ctx.fillStyle = g;
        }
        ctx.fillRect(x+shakeX, p.y, p.w, p.h);
        ctx.strokeStyle = '#5a3a1e';
        ctx.lineWidth = 2;
        for(let cx=0; cx<p.w; cx+=18) ctx.strokeRect(x+shakeX+cx, p.y, Math.min(18,p.w-cx), p.h);
        // peknieicia - wyraznie pokazuja ze blok zaraz spadnie (zamiast samego migotania)
        if(shaking && gfxQuality >= 1){
          const crackA = 0.4 + Math.sin((p.timer||0)*0.9)*0.3;
          ctx.strokeStyle = `rgba(40,20,5,${crackA})`;
          ctx.lineWidth = 1.5;
          const wx = Math.floor(p.x);
          for(let cx=8; cx<p.w-8; cx+=18){
            const seed = (wx+cx*7)%10;
            ctx.beginPath();
            ctx.moveTo(x+shakeX+cx, p.y+3);
            ctx.lineTo(x+shakeX+cx+3+(seed%3), p.y+p.h*0.5);
            ctx.lineTo(x+shakeX+cx-2+(seed%2), p.y+p.h-3);
            ctx.stroke();
          }
        }
        ctx.restore();
        continue;
      }
      if(p.isGround && p.isIce){
        ctx.fillStyle = '#7fc4dd';
        ctx.fillRect(x, p.y, p.w, H-p.y+10);
        const teeth = jaggedTopEdge(x, p.y, p.w, 10, '#eaf9ff');
        if(gfxQuality >= 2){
          ctx.fillStyle = 'rgba(255,255,255,.5)';
          for(let i=0;i<teeth;i++){
            const tx = x + (p.w*(i+0.5)/teeth);
            if(i%2!==0) ctx.fillRect(tx-1, p.y-4, 2, 4);
          }
          ctx.fillStyle = 'rgba(255,255,255,.25)';
          for(let cx=14; cx<p.w; cx+=34) ctx.fillRect(x+cx, p.y+10, 2, 10);
        }
      } else if(p.isGround && p.isSand){
        ctx.fillStyle = '#d9b26a';
        ctx.fillRect(x, p.y, p.w, H-p.y+10);
        const teeth = jaggedTopEdge(x, p.y, p.w, 10, '#e8cd8f');
        if(gfxQuality >= 2){
          ctx.fillStyle = 'rgba(255,255,255,.22)';
          for(let i=0;i<teeth;i++){
            const tx = x + (p.w*(i+0.5)/teeth);
            if(i%2!==0) ctx.fillRect(tx-1, p.y-4, 2, 4);
          }
        }
        if(gfxQuality >= 1){
          ctx.fillStyle = 'rgba(120,85,30,.35)';
          for(let cx=10; cx<p.w; cx+=22){
            ctx.beginPath();
            ctx.ellipse(x+cx, p.y+18+((cx*7)%14), 5, 2, 0, 0, Math.PI*2);
            ctx.fill();
          }
        }
      } else if(p.isGround){
        ctx.fillStyle = '#8a5a2b';
        ctx.fillRect(x, p.y, p.w, H-p.y+10);
        // tekstura ziemi: plamki/zyly, deterministyczne wg pozycji w swiecie (bez migotania przy scrollu)
        if(gfxQuality >= 1){
          ctx.fillStyle = 'rgba(0,0,0,.14)';
          for(let cx=10; cx<p.w; cx+=24){
            const wx = p.x+cx;
            const dy = 16 + ((wx*53)%38);
            ctx.fillRect(x+cx, p.y+dy, 9, 3);
          }
        }
        const teeth = jaggedTopEdge(x, p.y, p.w, 10, '#3fae4a');
        if(gfxQuality >= 2){
          ctx.fillStyle = 'rgba(255,255,255,.18)';
          for(let i=0;i<teeth;i++){
            const tx = x + (p.w*(i+0.5)/teeth);
            if(i%2!==0) ctx.fillRect(tx-1, p.y-4, 2, 4);
          }
        }
      } else {
        if(gfxQuality >= 2){
          ctx.fillStyle = 'rgba(0,0,0,.2)';
          ctx.beginPath(); ctx.ellipse(x+p.w/2, p.y+p.h+5, p.w/2.2, 4, 0, 0, Math.PI*2); ctx.fill();
        }
        if(p.isOneWay){
          if(gfxQuality === 0){ ctx.fillStyle = '#c9a25a'; }
          else { const g=ctx.createLinearGradient(x,p.y,x,p.y+p.h); g.addColorStop(0,'#e8cf95'); g.addColorStop(1,'#a9803c'); ctx.fillStyle=g; }
          ctx.fillRect(x, p.y, p.w, p.h);
          ctx.strokeStyle = '#6e4e1c'; ctx.lineWidth = 1.5; ctx.strokeRect(x, p.y, p.w, p.h);
          if(gfxQuality >= 1){
            ctx.strokeStyle = '#8a6a2e';
            ctx.lineWidth = 2;
            for(let bx=6; bx<p.w; bx+=16) { ctx.beginPath(); ctx.moveTo(x+bx, p.y+4); ctx.lineTo(x+bx, p.y+p.h-2); ctx.stroke(); }
          }
          if(gfxQuality >= 2){
            // strzalka na srodku - sugeruje przejscie "od spodu"
            ctx.fillStyle = 'rgba(255,255,255,.55)';
            const mx = x+p.w/2;
            ctx.beginPath(); ctx.moveTo(mx-4, p.y+p.h-1); ctx.lineTo(mx, p.y+p.h-6); ctx.lineTo(mx+4, p.y+p.h-1); ctx.fill();
          }
        } else if(p.isIce){
          if(gfxQuality === 0){ ctx.fillStyle = '#bfe6f2'; }
          else { const g=ctx.createLinearGradient(x,p.y,x,p.y+p.h); g.addColorStop(0,'#e9f9ff'); g.addColorStop(1,'#8fd3ea'); ctx.fillStyle=g; }
          ctx.fillRect(x, p.y, p.w, p.h);
          ctx.strokeStyle = '#5a9cb8'; ctx.lineWidth = 1.5; ctx.strokeRect(x, p.y, p.w, p.h);
          ctx.fillStyle = 'rgba(255,255,255,.6)';
          ctx.fillRect(x, p.y, p.w, 3);
          if(gfxQuality >= 1){
            ctx.strokeStyle = 'rgba(90,170,200,.6)';
            ctx.lineWidth = 1.5;
            for(let bx=8; bx<p.w; bx+=20) { ctx.beginPath(); ctx.moveTo(x+bx, p.y+3); ctx.lineTo(x+bx-5, p.y+p.h); ctx.stroke(); }
          }
          if(gfxQuality >= 2){
            ctx.fillStyle = 'rgba(255,255,255,.85)';
            ctx.beginPath(); ctx.arc(x+p.w*0.72, p.y+p.h*0.4, 1.6, 0, Math.PI*2); ctx.fill();
          }
        } else {
          if(gfxQuality === 0){ ctx.fillStyle = '#c96a2e'; }
          else { const g=ctx.createLinearGradient(x,p.y,x,p.y+p.h); g.addColorStop(0,'#e0924a'); g.addColorStop(0.35,'#c96a2e'); g.addColorStop(1,'#8a4718'); ctx.fillStyle=g; }
          ctx.fillRect(x, p.y, p.w, p.h);
          // obrys tylko po bokach i na dole (gora ma jasna krawedz, nie ciemna - zeby nie wygladalo na "podwojny cien")
          ctx.strokeStyle = '#5c2c0c'; ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x, p.y); ctx.lineTo(x, p.y+p.h); ctx.lineTo(x+p.w, p.y+p.h); ctx.lineTo(x+p.w, p.y);
          ctx.stroke();
          if(gfxQuality >= 1){
            // podzial na deski - pionowe linie
            ctx.strokeStyle = '#7a3d15';
            ctx.lineWidth = 1.5;
            for(let bx=22; bx<p.w; bx+=22){ ctx.beginPath(); ctx.moveTo(x+bx, p.y+1); ctx.lineTo(x+bx, p.y+p.h-1); ctx.stroke(); }
            // pojedynczy sek na srodku kazdej deski, zawsze na tej samej wysokosci (bez losowego "krzywego" rozrzutu)
            ctx.fillStyle = 'rgba(90,45,10,.35)';
            for(let bx=0; bx<p.w; bx+=22){
              ctx.beginPath(); ctx.ellipse(x+bx+11, p.y+p.h*0.55, 2.3, 1.5, 0, 0, Math.PI*2); ctx.fill();
            }
          }
          // jasna krawedz na gorze (deska oswietlona z gory)
          ctx.fillStyle = 'rgba(255,255,255,.28)';
          ctx.fillRect(x, p.y, p.w, 2);
        }
      }
    }
    for(const tp of (level.teleporters||[])){
      const x = tp.x - camera.x;
      if(x+tp.w < 0 || x > W) continue;
      const t = Date.now()*0.001;
      const pulse = 0.5 + Math.sin(t*5 + tp.x*0.05) * 0.3;
      const ccx = x+tp.w/2, ccy = tp.y+tp.h/2, rx = tp.w/2, ry = tp.h/2;
      ctx.save();
      if(gfxQuality >= 2){ ctx.shadowColor = 'rgba(160,90,255,.9)'; ctx.shadowBlur = 14; }
      // wir portalu - gradient radialny zamiast plaskiego fioletu
      if(gfxQuality === 0){
        ctx.fillStyle = `rgba(160,90,255,${0.55+pulse*0.2})`;
      } else {
        const grad = ctx.createRadialGradient(ccx, ccy, 1, ccx, ccy, Math.max(rx,ry));
        grad.addColorStop(0, `rgba(235,215,255,${0.7+pulse*0.25})`);
        grad.addColorStop(0.55, `rgba(160,90,255,${0.55+pulse*0.2})`);
        grad.addColorStop(1, 'rgba(90,30,160,.35)');
        ctx.fillStyle = grad;
      }
      ctx.beginPath(); ctx.ellipse(ccx, ccy, rx, ry, 0, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;

      // obracajace sie pierscienie (efekt wiru)
      if(gfxQuality >= 1){
        ctx.strokeStyle = '#c9a8ff'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(ccx, ccy, rx-4, ry-4, t*2 % Math.PI, 0, Math.PI*2); ctx.stroke();
        ctx.strokeStyle = 'rgba(235,215,255,.7)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(ccx, ccy, rx*0.55, ry*0.55, -t*3 % Math.PI, 0, Math.PI*2); ctx.stroke();
      } else {
        ctx.strokeStyle = '#c9a8ff'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(ccx, ccy, rx-4, ry-4, 0, 0, Math.PI*2); ctx.stroke();
      }

      // iskierki wirujace wokol portalu
      if(gfxQuality >= 2){
        for(let i=0;i<4;i++){
          const ang = t*2.2 + i*(Math.PI/2);
          const sx = ccx + Math.cos(ang)*(rx+6);
          const sy = ccy + Math.sin(ang)*(ry+6);
          ctx.fillStyle = 'rgba(235,215,255,.9)';
          ctx.beginPath(); ctx.arc(sx, sy, 2, 0, Math.PI*2); ctx.fill();
        }
      }
      ctx.restore();
    }
    for(const b of (level.blinkers||[])){
      const x = b.x - camera.x;
      if(x+b.w < 0 || x > W) continue;
      if(!b.solid){
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.strokeStyle = '#5fd0ff'; ctx.lineWidth = 2; ctx.setLineDash([6,5]);
        ctx.strokeRect(x, b.y, b.w, b.h);
        ctx.restore();
        continue;
      }
      ctx.save();
      if(b.warning) ctx.globalAlpha = 0.45 + Math.sin(Date.now()*0.025) * 0.35;
      ctx.fillStyle = '#7fd8ff';
      ctx.fillRect(x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.fillRect(x, b.y, b.w, 3);
      if(gfxQuality >= 1 && !b.warning){
        ctx.strokeStyle = '#2a90c2'; ctx.lineWidth = 1.5;
        for(let bx=0; bx<b.w; bx+=16) ctx.strokeRect(x+bx, b.y, Math.min(16,b.w-bx), b.h);
      }
      ctx.restore();
    }
    for(const p of level.pipes){
      const x = p.x - camera.x;
      if(x+p.w < 0 || x > W) continue;

      if(gfxQuality >= 1){
        ctx.fillStyle = 'rgba(0,0,0,.2)';
        ctx.beginPath(); ctx.ellipse(x+p.w/2, p.y+p.h+4, p.w/2+2, 5, 0, 0, Math.PI*2); ctx.fill();
      }

      // korpus - gradient cylindryczny (zamiast plaskiego koloru)
      if(gfxQuality === 0){
        ctx.fillStyle = '#1e9e46';
        ctx.fillRect(x, p.y+12, p.w, p.h-12);
      } else {
        const grad = ctx.createLinearGradient(x, 0, x+p.w, 0);
        grad.addColorStop(0, '#0f6e2c');
        grad.addColorStop(0.22, '#2ecc57');
        grad.addColorStop(0.5, '#1e9e46');
        grad.addColorStop(0.78, '#167a37');
        grad.addColorStop(1, '#0f6e2c');
        ctx.fillStyle = grad;
        ctx.fillRect(x, p.y+12, p.w, p.h-12);
        // obrys korpusu: tylko boki i dol (gora jest zaslonieta przez kolnierz - bez podwojnej linii w miejscu styku)
        ctx.strokeStyle = '#0a4a1e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, p.y+12); ctx.lineTo(x, p.y+p.h); ctx.lineTo(x+p.w, p.y+p.h); ctx.lineTo(x+p.w, p.y+12);
        ctx.stroke();
      }

      // kolnierz (poszerzona gorna czesc) z wlasnym cieniowaniem
      const collarX = x-5, collarW = p.w+10;
      if(gfxQuality === 0){
        ctx.fillStyle = '#2ecc57';
        ctx.fillRect(collarX, p.y, collarW, 14);
      } else {
        const cgrad = ctx.createLinearGradient(collarX, 0, collarX+collarW, 0);
        cgrad.addColorStop(0, '#0f6e2c');
        cgrad.addColorStop(0.2, '#3fe06a');
        cgrad.addColorStop(0.5, '#2ecc57');
        cgrad.addColorStop(0.8, '#1e9e46');
        cgrad.addColorStop(1, '#0f6e2c');
        ctx.fillStyle = cgrad;
        ctx.fillRect(collarX, p.y, collarW, 14);
        // obrys kolnierza: tylko boki i gora (dol styka sie z korpusem - bez podwojnej linii)
        ctx.strokeStyle = '#0a4a1e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(collarX, p.y+14); ctx.lineTo(collarX, p.y); ctx.lineTo(collarX+collarW, p.y); ctx.lineTo(collarX+collarW, p.y+14);
        ctx.stroke();
      }

      // ciemny otwor na gorze - sugeruje wejscie do srodka
      if(gfxQuality >= 1){
        ctx.fillStyle = 'rgba(0,20,8,.55)';
        ctx.beginPath(); ctx.ellipse(x+p.w/2, p.y+2, p.w/2-3, 4, 0, 0, Math.PI*2); ctx.fill();
      }
      if(gfxQuality >= 2){
        ctx.fillStyle = 'rgba(255,255,255,.22)';
        ctx.fillRect(x+p.w*0.18, p.y+16, p.w*0.12, p.h-20);
      }
    }
  }

  let cachedCoinGradient = null;
  function getCoinGradient(){
    if(!cachedCoinGradient){
      const grad = ctx.createRadialGradient(-3,-3,1,0,0,10);
      grad.addColorStop(0,'#fff6c9');
      grad.addColorStop(0.5,'#ffd23f');
      grad.addColorStop(1,'#c8860a');
      cachedCoinGradient = grad;
    }
    return cachedCoinGradient;
  }

  function drawCoins(){
    for(const c of level.coins){
      if(c.taken) continue;
      const x = c.x - camera.x;
      if(x < -20 || x > W+20) continue;
      const squish = Math.abs(Math.cos(c.t));
      ctx.save();
      ctx.translate(x, c.y);
      ctx.scale(squish*0.9+0.15, 1);

      if(gfxQuality >= 3){
        ctx.save();
        ctx.shadowColor = 'rgba(255,210,63,.9)';
        ctx.shadowBlur = 10;
      }

      if(gfxQuality === 0){
        ctx.fillStyle = '#ffd23f';
      } else {
        ctx.fillStyle = getCoinGradient();
      }
      ctx.beginPath(); ctx.arc(0,0,10,0,Math.PI*2); ctx.fill();
      if(gfxQuality >= 1){
        ctx.strokeStyle = '#8a5a00';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      if(gfxQuality >= 3) ctx.restore();

      // HIGH+: iskierka
      if(gfxQuality >= 2){
        ctx.fillStyle = 'rgba(255,255,255,.85)';
        ctx.beginPath(); ctx.ellipse(-3,-3,2,3.5,0.6,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawFlag(){
    const x = level.flag.x - camera.x;
    const fy = level.flag.y;
    // maszt - gradient metaliczny zamiast plaskiej szarosci
    if(gfxQuality === 0){
      ctx.fillStyle = '#ccc';
    } else {
      const pg = ctx.createLinearGradient(x, 0, x+6, 0);
      pg.addColorStop(0, '#9aa0a8'); pg.addColorStop(0.5, '#f0f2f4'); pg.addColorStop(1, '#8a9099');
      ctx.fillStyle = pg;
    }
    ctx.fillRect(x, fy, 6, level.flag.h);
    // kulka na szczycie
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(x+3, fy-3, 4, 0, Math.PI*2); ctx.fill();
    if(gfxQuality >= 1){
      ctx.fillStyle = 'rgba(255,255,255,.6)';
      ctx.beginPath(); ctx.arc(x+1.5, fy-4.5, 1.3, 0, Math.PI*2); ctx.fill();
    }
    // falujaca flaga (fala przy wolnym koncu, zamiast sztywnego trojkata)
    const wave = gfxQuality >= 1 ? Math.sin((timeAlive||0)*0.08)*3 : 0;
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.moveTo(x+6, fy+6);
    ctx.quadraticCurveTo(x+22, fy+10+wave, x+34, fy+16+wave*0.6);
    ctx.quadraticCurveTo(x+22, fy+22, x+6, fy+26);
    ctx.closePath();
    ctx.fill();
    if(gfxQuality >= 2){
      ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x+6, fy+16); ctx.quadraticCurveTo(x+22, fy+16+wave*0.8, x+32, fy+16+wave*0.5); ctx.stroke();
    }
    // podstawa masztu
    if(gfxQuality >= 1){
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.beginPath(); ctx.ellipse(x+3, fy+level.flag.h+2, 7, 3, 0, 0, Math.PI*2); ctx.fill();
    }
  }

  function drawCheckpoint(){
    if(!level.checkpoint) return;
    const x = level.checkpoint.x - camera.x;
    if(x < -40 || x > W+40) return;
    const y = level.checkpoint.y;
    const active = levelCheckpointReached;
    ctx.save();
    // maszt - gradient metaliczny
    if(gfxQuality === 0){ ctx.fillStyle = active ? '#ccc' : '#8a8f99'; }
    else {
      const pg = ctx.createLinearGradient(x, 0, x+5, 0);
      if(active){ pg.addColorStop(0,'#9aa0a8'); pg.addColorStop(0.5,'#f0f2f4'); pg.addColorStop(1,'#8a9099'); }
      else { pg.addColorStop(0,'#6b7076'); pg.addColorStop(0.5,'#9298a0'); pg.addColorStop(1,'#5f6469'); }
      ctx.fillStyle = pg;
    }
    ctx.fillRect(x, y-220, 5, 220);
    // falujaca choragiewka (zamiast sztywnego trojkata)
    const wave = gfxQuality >= 1 ? Math.sin((timeAlive||0)*0.08 + x*0.02)*2.5 : 0;
    if(gfxQuality === 0){ ctx.fillStyle = active ? '#2ecc71' : '#556070'; }
    else {
      const fg = ctx.createLinearGradient(x+5, y-214, x+28, y-214);
      if(active){ fg.addColorStop(0,'#4ee08a'); fg.addColorStop(1,'#1ca355'); }
      else { fg.addColorStop(0,'#6a7682'); fg.addColorStop(1,'#444c56'); }
      ctx.fillStyle = fg;
    }
    ctx.beginPath();
    ctx.moveTo(x+5, y-214);
    ctx.quadraticCurveTo(x+18, y-210+wave, x+28, y-206+wave*0.6);
    ctx.quadraticCurveTo(x+18, y-202, x+5, y-198);
    ctx.closePath();
    ctx.fill();
    if(active){
      ctx.shadowColor = '#2ecc71';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(x+2, y-222, 4, 0, Math.PI*2);
      ctx.fillStyle = '#2ecc71';
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    // podstawa masztu
    if(gfxQuality >= 1){
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.beginPath(); ctx.ellipse(x+2, y+3, 7, 3, 0, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  function drawBoss(e, x){
    const cx = x + e.w/2, cy = e.y + e.h/2;
    const flash = e.hitTimer > 0 && Math.floor(e.hitTimer/4)%2===0;
    const bob = Math.sin((e.animT||0)*0.8) * 4;

    // cien
    if(gfxQuality >= 1){
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.beginPath(); ctx.ellipse(cx, e.y+e.h+10, e.w*0.55, 8, 0, 0, Math.PI*2); ctx.fill();
    }

    // nogi
    ctx.fillStyle = '#3a0a1a';
    ctx.beginPath(); ctx.ellipse(cx-e.w*0.28, e.y+e.h-6+bob*0.3, e.w*0.16, 10, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx+e.w*0.28, e.y+e.h-6-bob*0.3, e.w*0.16, 10, 0, 0, Math.PI*2); ctx.fill();

    // cialo
    if(flash){
      ctx.fillStyle = '#ffffff';
    } else if(gfxQuality === 0){
      ctx.fillStyle = '#8a1a3a';
    } else {
      const grad = ctx.createRadialGradient(cx-e.w*0.25, cy-e.h*0.3, 4, cx, cy, e.w*0.75);
      grad.addColorStop(0, '#e05a8a');
      grad.addColorStop(0.5, '#a8225a');
      grad.addColorStop(1, '#5a0e2e');
      ctx.fillStyle = grad;
    }
    ctx.beginPath(); ctx.ellipse(cx, cy+bob*0.4, e.w*0.55, e.h*0.5, 0, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#3a0a1a'; ctx.lineWidth = 3; ctx.stroke();

    // kolce na grzbiecie
    ctx.fillStyle = '#3a0a1a';
    for(let i=-2;i<=2;i++){
      ctx.beginPath();
      ctx.moveTo(cx+i*14-6, cy-e.h*0.35+bob*0.4);
      ctx.lineTo(cx+i*14, cy-e.h*0.7+bob*0.4);
      ctx.lineTo(cx+i*14+6, cy-e.h*0.35+bob*0.4);
      ctx.fill();
    }

    // korona
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(cx-22, cy-e.h*0.45+bob*0.4);
    ctx.lineTo(cx-14, cy-e.h*0.68+bob*0.4);
    ctx.lineTo(cx-4, cy-e.h*0.45+bob*0.4);
    ctx.lineTo(cx+4, cy-e.h*0.68+bob*0.4);
    ctx.lineTo(cx+14, cy-e.h*0.45+bob*0.4);
    ctx.lineTo(cx+22, cy-e.h*0.68+bob*0.4);
    ctx.lineTo(cx+22, cy-e.h*0.4+bob*0.4);
    ctx.lineTo(cx-22, cy-e.h*0.4+bob*0.4);
    ctx.fill();

    // oczy wsciekle
    const eyeShift = (e.vx>=0?1:-1)*3;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(cx-16+eyeShift, cy+bob*0.4, 8, 9, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx+16+eyeShift, cy+bob*0.4, 8, 9, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ff2020';
    ctx.beginPath(); ctx.arc(cx-16+eyeShift*1.6, cy+2+bob*0.4, 4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+16+eyeShift*1.6, cy+2+bob*0.4, 4, 0, Math.PI*2); ctx.fill();

    // zebiska
    ctx.fillStyle = '#fff';
    for(let i=-1;i<=1;i+=2){
      ctx.beginPath();
      ctx.moveTo(cx+i*8-4, cy+e.h*0.28+bob*0.4);
      ctx.lineTo(cx+i*8, cy+e.h*0.42+bob*0.4);
      ctx.lineTo(cx+i*8+4, cy+e.h*0.28+bob*0.4);
      ctx.fill();
    }
  }

  function drawCrushers(){
    if(!level.crushers) return;
    for(const c of level.crushers){
      const x = c.x - camera.x;
      if(x+c.w < 0 || x > W) continue;
      // lancuch/tłok od gory
      ctx.fillStyle = '#5a5a5a';
      ctx.fillRect(x+c.w/2-4, c.topY-40, 8, c.y-(c.topY-40));
      // blok z kolcami
      const grad = gfxQuality===0 ? null : ctx.createLinearGradient(x, c.y, x, c.y+c.h);
      if(grad){ grad.addColorStop(0,'#c0c5cb'); grad.addColorStop(1,'#7a828a'); ctx.fillStyle = grad; }
      else ctx.fillStyle = '#9aa0a6';
      ctx.fillRect(x, c.y, c.w, c.h);
      ctx.fillStyle = '#4a4e54';
      for(let i=0;i<c.w;i+=14){
        ctx.beginPath();
        ctx.moveTo(x+i, c.y+c.h);
        ctx.lineTo(x+i+7, c.y+c.h+12);
        ctx.lineTo(x+i+14, c.y+c.h);
        ctx.fill();
      }
    }
  }

  function drawHammers(){
    if(!level.hammers) return;
    for(const h of level.hammers){
      const x = h.x - camera.x;
      if(x+h.radius < 0 || x-h.radius > W) continue;
      const hx = x + Math.cos(h.angle||0)*h.radius;
      const hy = h.y + Math.sin(h.angle||0)*h.radius;
      ctx.strokeStyle = '#4a4e54';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(x, h.y); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.fillStyle = '#333';
      ctx.beginPath(); ctx.arc(x, h.y, 7, 0, Math.PI*2); ctx.fill();
      const grad = gfxQuality===0 ? null : ctx.createRadialGradient(hx-6,hy-6,2,hx,hy,20);
      if(grad){ grad.addColorStop(0,'#c0c5cb'); grad.addColorStop(1,'#5a5f66'); ctx.fillStyle = grad; }
      else ctx.fillStyle = '#8a8f96';
      ctx.beginPath(); ctx.arc(hx, hy, 20, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#3a3e44';
      for(let i=0;i<8;i++){
        const a = i*(Math.PI/4) + (h.angle||0)*0.3;
        ctx.beginPath();
        ctx.moveTo(hx+Math.cos(a)*20, hy+Math.sin(a)*20);
        ctx.lineTo(hx+Math.cos(a)*28, hy+Math.sin(a)*28);
        ctx.lineTo(hx+Math.cos(a+0.25)*20, hy+Math.sin(a+0.25)*20);
        ctx.fill();
      }
    }
  }

  function drawTurrets(){
    if(!level.shooters) return;
    for(const s of level.shooters){
      const x = s.x - camera.x;
      if(x < -40 || x > W+40) continue;
      const dir = s.dir || 1;
      ctx.save();
      const grad = gfxQuality===0 ? null : ctx.createLinearGradient(x-16, s.y-16, x-16, s.y+16);
      if(grad){ grad.addColorStop(0,'#7d8694'); grad.addColorStop(1,'#454c56'); ctx.fillStyle = grad; }
      else ctx.fillStyle = '#5a626e';
      ctx.fillRect(x-16, s.y-16, 32, 32);
      ctx.fillStyle = '#2e333a';
      ctx.fillRect(x-16, s.y-16, 32, 6);
      ctx.fillRect(x-16, s.y+10, 32, 6);
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(dir>=0 ? x+8 : x-28, s.y-5, 20, 10);
      ctx.fillStyle = '#ffcc4d';
      ctx.beginPath(); ctx.arc(x, s.y, 5, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }

  function drawProjectiles(){
    if(!level.projectiles) return;
    for(const p of level.projectiles){
      const x = p.x - camera.x;
      if(x < -30 || x > W+30) continue;
      if(gfxQuality >= 2){
        ctx.save();
        ctx.shadowColor = 'rgba(255,120,40,.9)';
        ctx.shadowBlur = 10;
      }
      const grad = gfxQuality===0 ? null : ctx.createRadialGradient(x-2,p.y-2,1,x,p.y,9);
      if(grad){ grad.addColorStop(0,'#fff2b0'); grad.addColorStop(0.5,'#ff8a3d'); grad.addColorStop(1,'#c0390a'); ctx.fillStyle = grad; }
      else ctx.fillStyle = '#ff8a3d';
      ctx.beginPath(); ctx.arc(x, p.y, 8, 0, Math.PI*2); ctx.fill();
      if(gfxQuality >= 2) ctx.restore();
    }
  }

  function drawHazards(){
    if(!level.hazards) return;
    for(const h of level.hazards){
      const x = h.x - camera.x;
      if(x+h.w < 0 || x > W) continue;
      const spikeW = 12;
      const n = Math.max(1, Math.round(h.w / spikeW));
      const grad = ctx.createLinearGradient(x, h.y, x, h.y+h.h);
      grad.addColorStop(0, '#e8e8e8');
      grad.addColorStop(1, '#8a8f96');
      ctx.fillStyle = gfxQuality === 0 ? '#a0a5ab' : grad;
      for(let i=0;i<n;i++){
        const sx = x + i*(h.w/n);
        ctx.beginPath();
        ctx.moveTo(sx, h.y+h.h);
        ctx.lineTo(sx + h.w/n/2, h.y);
        ctx.lineTo(sx + h.w/n, h.y+h.h);
        ctx.closePath();
        ctx.fill();
      }
      if(gfxQuality >= 2){
        ctx.strokeStyle = 'rgba(0,0,0,.3)';
        ctx.lineWidth = 1;
        for(let i=0;i<n;i++){
          const sx = x + i*(h.w/n);
          ctx.beginPath();
          ctx.moveTo(sx, h.y+h.h);
          ctx.lineTo(sx + h.w/n/2, h.y);
          ctx.lineTo(sx + h.w/n, h.y+h.h);
          ctx.stroke();
        }
      }
    }
  }

  function drawGatesAndSwitches(){
    if(level.gates) for(const g of level.gates){
      if(!g.solid) continue; // otwarta brama - nic do rysowania, przejscie wolne
      const x = g.x - camera.x;
      if(x+g.w < 0 || x > W) continue;
      const grad = gfxQuality===0 ? null : ctx.createLinearGradient(x, g.y, x+g.w, g.y);
      if(grad){ grad.addColorStop(0,'#8a93a0'); grad.addColorStop(0.5,'#c5cdd6'); grad.addColorStop(1,'#8a93a0'); ctx.fillStyle = grad; }
      else ctx.fillStyle = '#9aa3b0';
      ctx.fillRect(x, g.y, g.w, g.h);
      ctx.strokeStyle = '#3a4350';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, g.y, g.w, g.h);
      ctx.fillStyle = '#3a4350';
      for(let sy = g.y+10; sy < g.y+g.h-6; sy += 22) ctx.fillRect(x+3, sy, g.w-6, 5);
      if(gfxQuality >= 1){
        // nity na rogach krat - mechaniczny detal
        ctx.fillStyle = 'rgba(255,255,255,.5)';
        for(let sy = g.y+10; sy < g.y+g.h-6; sy += 22){
          ctx.beginPath(); ctx.arc(x+6, sy+2.5, 1.4, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(x+g.w-6, sy+2.5, 1.4, 0, Math.PI*2); ctx.fill();
        }
      }
    }
    if(level.switches) for(const s of level.switches){
      const x = s.x - camera.x;
      if(x+s.w < 0 || x > W) continue;
      // podstawa (plytka montazowa)
      ctx.fillStyle = '#2a2e33';
      ctx.fillRect(x+s.w/2-10, s.y+s.h-4, 20, 6);
      // trzpien - krotszy gdy wcisniety
      ctx.fillStyle = '#4a4e54';
      ctx.fillRect(x+s.w/2-4, s.y+s.h-6, 8, s.pressed ? 6 : 10);
      const by = s.y + (s.pressed ? 8 : 4);
      // poswiata gdy aktywny
      if(gfxQuality >= 2 && s.pressed){
        ctx.save(); ctx.globalAlpha = 0.4; ctx.fillStyle = '#2ecc71';
        ctx.beginPath(); ctx.arc(x+s.w/2, by, 17, 0, Math.PI*2); ctx.fill(); ctx.restore();
      }
      // przycisk - gradient zamiast plaskiego koloru
      if(gfxQuality === 0){
        ctx.fillStyle = s.pressed ? '#2ecc71' : '#e74c3c';
      } else {
        const g = ctx.createRadialGradient(x+s.w/2-3, by-3, 1, x+s.w/2, by, 12);
        if(s.pressed){ g.addColorStop(0,'#c8f7dc'); g.addColorStop(1,'#1ca355'); }
        else { g.addColorStop(0,'#ffc4bd'); g.addColorStop(1,'#c0392b'); }
        ctx.fillStyle = g;
      }
      ctx.beginPath(); ctx.arc(x+s.w/2, by, 12, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#2a2e33'; ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function drawLasers(){
    if(!level.lasers) return;
    for(const l of level.lasers){
      const x = l.x - camera.x;
      const w = l.axis==='y' ? 30 : l.length, h = l.axis==='y' ? l.length : 30;
      if(x+w < 0 || x-w > W) continue;
      const ex2 = l.axis==='y' ? l.x : l.x + l.length, ey2 = l.axis==='y' ? l.y + l.length : l.y;
      const sx = l.x - camera.x, sy = l.y, exx = ex2 - camera.x, eyy = ey2;
      // emitery na obu koncach
      ctx.fillStyle = '#4a4e54';
      ctx.beginPath(); ctx.arc(sx, sy, 10, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(exx, eyy, 10, 0, Math.PI*2); ctx.fill();
      if(l.firing){
        ctx.strokeStyle = '#fff5cc';
        ctx.lineWidth = 7;
        ctx.shadowColor = 'rgba(255,60,60,.9)';
        ctx.shadowBlur = gfxQuality >= 1 ? 16 : 0;
        ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(exx,eyy); ctx.stroke();
        ctx.strokeStyle = '#ff3b3b';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(exx,eyy); ctx.stroke();
        ctx.shadowBlur = 0;
      } else if(l.warning){
        const pulse = 0.5 + 0.5*Math.sin((l.t||0)*0.9);
        ctx.strokeStyle = `rgba(255,70,70,${0.4+0.5*pulse})`;
        ctx.lineWidth = 3;
        ctx.setLineDash([6,5]);
        ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(exx,eyy); ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = 'rgba(255,90,90,.35)';
        ctx.lineWidth = 2;
        ctx.setLineDash([3,6]);
        ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(exx,eyy); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = l.firing ? '#ff6b6b' : (l.warning ? '#ffb199' : '#8a8f96');
      ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(exx, eyy, 5, 0, Math.PI*2); ctx.fill();
    }
  }

  function drawMovers(){
    if(!level.movers) return;
    for(const m of level.movers){
      const x = m.x - camera.x;
      if(x+m.w < 0 || x > W) continue;
      if(gfxQuality >= 1){
        ctx.fillStyle = 'rgba(0,0,0,.2)';
        ctx.beginPath(); ctx.ellipse(x+m.w/2, m.y+m.h+6, m.w/2, 4, 0, 0, Math.PI*2); ctx.fill();
      }
      if(gfxQuality === 0){
        ctx.fillStyle = '#8a5ac9';
      } else {
        const grad = ctx.createLinearGradient(x, m.y, x, m.y+m.h);
        grad.addColorStop(0, '#c9a5f5');
        grad.addColorStop(0.4, '#8a5ac9');
        grad.addColorStop(1, '#5a2f8a');
        ctx.fillStyle = grad;
      }
      ctx.fillRect(x, m.y, m.w, m.h);
      ctx.fillStyle = '#c9a5f5';
      ctx.fillRect(x, m.y, m.w, 5);
      if(gfxQuality >= 1){
        ctx.strokeStyle = '#4a2a70';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, m.y, m.w, m.h);
        // nity na rogach - mechaniczny wyglad
        ctx.fillStyle = 'rgba(255,255,255,.5)';
        const rr = 1.8;
        ctx.beginPath(); ctx.arc(x+6, m.y+m.h/2, rr, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(x+m.w-6, m.y+m.h/2, rr, 0, Math.PI*2); ctx.fill();
        // strzalki kierunku ruchu (pion/poziom) - delikatny wskaznik osi
        ctx.fillStyle = 'rgba(255,255,255,.4)';
        const mx = x+m.w/2, my = m.y+m.h/2;
        if(m.axis === 'y'){
          ctx.beginPath(); ctx.moveTo(mx-4, my-m.h*0.3); ctx.lineTo(mx, my-m.h*0.3-5); ctx.lineTo(mx+4, my-m.h*0.3); ctx.fill();
          ctx.beginPath(); ctx.moveTo(mx-4, my+m.h*0.3); ctx.lineTo(mx, my+m.h*0.3+5); ctx.lineTo(mx+4, my+m.h*0.3); ctx.fill();
        } else {
          ctx.beginPath(); ctx.moveTo(x+m.w*0.22, my-4); ctx.lineTo(x+m.w*0.22-5, my); ctx.lineTo(x+m.w*0.22, my+4); ctx.fill();
          ctx.beginPath(); ctx.moveTo(x+m.w*0.78, my-4); ctx.lineTo(x+m.w*0.78+5, my); ctx.lineTo(x+m.w*0.78, my+4); ctx.fill();
        }
      }
      if(gfxQuality >= 3){
        ctx.fillStyle = 'rgba(255,255,255,.25)';
        ctx.fillRect(x+4, m.y+2, m.w-8, 2);
      }
    }
  }

  function drawEnemies(){
    for(const e of level.enemies){
      if(!e.alive) continue;
      const x = e.x - camera.x;
      if(x+e.w < 0 || x > W) continue;
      if(e.type === 'boss'){ drawBoss(e, x); continue; }
      const walkBob = Math.sin(e.animT||0) * 2.2;
      const squash = 1 + Math.sin((e.animT||0)*2) * 0.03;
      const cx = x + e.w/2, cy = e.y + e.h/2 + walkBob*0.4;
      const bodyW = (e.w/2) * squash;
      const bodyH = (e.h/2) / squash;
      const facing = e.vx >= 0 ? 1 : -1;
      const palette = e.type==='flyer'
        ? {flat:'#3d8fd6', light:'#a8d4f7', mid:'#4f9fe0', dark:'#1e5a99', stroke:'#123a66', spike:'#1e5a99', leg:'#123a66'}
        : e.type==='jumper'
        ? {flat:'#3fae52', light:'#c8f0c8', mid:'#4fc463', dark:'#1e7a2e', stroke:'#124a1a', spike:'#1e7a2e', leg:'#124a1a'}
        : e.type==='shooter'
        ? {flat:'#d6791f', light:'#ffd9a8', mid:'#e08a2f', dark:'#8a4a12', stroke:'#5c2f0a', spike:'#8a4a12', leg:'#5c2f0a'}
        : e.type==='charger'
        ? {flat:'#b5262f', light:'#ff9a9a', mid:'#c73b3b', dark:'#6e1414', stroke:'#420b0b', spike:'#6e1414', leg:'#420b0b'}
        : {flat:'#8a4bc7', light:'#d69bf0', mid:'#a655d6', dark:'#5e2680', stroke:'#3a1554', spike:'#4a1f66', leg:'#2c1140'};

      // cien pod nim
      if(gfxQuality >= 1){
        ctx.fillStyle = 'rgba(0,0,0,.25)';
        ctx.beginPath(); ctx.ellipse(cx, e.y+e.h+5, e.w/2, 4.5, 0, 0, Math.PI*2); ctx.fill();
      }

      // ULTRA: pulsujaca aura + drobinki (kolor zgodny z typem wroga)
      if(gfxQuality >= 3){
        const pulse = 0.5 + Math.sin((e.animT||0)*1.5)*0.5;
        ctx.save();
        ctx.globalAlpha = 0.28 + pulse*0.18;
        ctx.fillStyle = palette.mid;
        ctx.beginPath(); ctx.ellipse(cx, cy, bodyW*1.8, bodyH*1.8, 0, 0, Math.PI*2); ctx.fill();
        ctx.restore();
        for(let i=0;i<3;i++){
          const pt = ((e.animT||0)*0.6 + i*2.1) % 6.28;
          const px2 = cx + Math.cos(pt)*(bodyW*1.9);
          const py2 = cy + Math.sin(pt)*(bodyH*1.9);
          ctx.fillStyle = palette.light;
          ctx.beginPath(); ctx.arc(px2, py2, 2.2, 0, Math.PI*2); ctx.fill();
        }
      }

      // skrzydla latacza (rysowane pod cialem, przed nozkami)
      if(e.type === 'flyer'){
        const wingFlap = Math.sin((e.animT||0)*3)*0.6;
        ctx.fillStyle = gfxQuality===0 ? '#5aa0e0' : 'rgba(140,195,245,.85)';
        ctx.save(); ctx.translate(cx-bodyW*0.85, cy-4); ctx.rotate(wingFlap);
        ctx.beginPath(); ctx.ellipse(0,0, bodyW*0.85, bodyH*0.45, 0,0,Math.PI*2); ctx.fill();
        ctx.restore();
        ctx.save(); ctx.translate(cx+bodyW*0.85, cy-4); ctx.rotate(-wingFlap);
        ctx.beginPath(); ctx.ellipse(0,0, bodyW*0.85, bodyH*0.45, 0,0,Math.PI*2); ctx.fill();
        ctx.restore();
      }

      // nozki (przebieranie) - latacz ich nie ma, skoczek ma sprezyste odnoze
      if(e.type === 'flyer'){
        // brak nog - unosi sie w powietrzu
      } else if(e.type === 'jumper'){
        ctx.strokeStyle = palette.leg;
        ctx.lineWidth = 3;
        ctx.beginPath();
        for(let i=0;i<3;i++){
          const yy = e.y+e.h-2 - i*4;
          ctx.moveTo(cx-6, yy); ctx.lineTo(cx+6, yy-3);
        }
        ctx.stroke();
      } else {
        const stepA = Math.sin(e.animT||0);
        ctx.fillStyle = palette.spike;
        ctx.beginPath(); ctx.ellipse(cx-9, e.y+e.h-3+stepA*2, 6.5, 4.5, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx+9, e.y+e.h-3-stepA*2, 6.5, 4.5, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = palette.leg;
        ctx.beginPath(); ctx.ellipse(cx-9, e.y+e.h+stepA*2, 5, 2.6, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx+9, e.y+e.h-stepA*2, 5, 2.6, 0, 0, Math.PI*2); ctx.fill();
      }

      // grzbiet kolcow
      ctx.fillStyle = palette.spike;
      for(let i=-1;i<=1;i++){
        ctx.beginPath();
        ctx.moveTo(cx+i*7-4, cy-bodyH*0.75);
        ctx.lineTo(cx+i*7, cy-bodyH*1.15);
        ctx.lineTo(cx+i*7+4, cy-bodyH*0.75);
        ctx.fill();
      }

      // cialo
      if(gfxQuality === 0){
        ctx.fillStyle = palette.flat;
      } else {
        const grad = ctx.createRadialGradient(cx-bodyW*0.35, cy-bodyH*0.4, 2, cx, cy, bodyW*1.15);
        grad.addColorStop(0, palette.light);
        grad.addColorStop(0.45, palette.mid);
        grad.addColorStop(1, palette.dark);
        ctx.fillStyle = grad;
      }
      ctx.beginPath(); ctx.ellipse(cx, cy, bodyW, bodyH, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = palette.stroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if(gfxQuality >= 1){
        // jasny brzuch
        ctx.fillStyle = 'rgba(255,255,255,.18)';
        ctx.beginPath(); ctx.ellipse(cx, cy+bodyH*0.35, bodyW*0.6, bodyH*0.45, 0, 0, Math.PI*2); ctx.fill();

        // cetki
        ctx.fillStyle = 'rgba(60,20,80,.35)';
        ctx.beginPath(); ctx.ellipse(cx-bodyW*0.5, cy+bodyH*0.1, 3, 2.4, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx+bodyW*0.4, cy-bodyH*0.25, 2.6, 2, 0, 0, Math.PI*2); ctx.fill();
      }

      // brwi wkurzone (zwrocone w strone ruchu)
      ctx.strokeStyle = '#2c1440';
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      const browShift = facing*2;
      ctx.beginPath(); ctx.moveTo(cx-11+browShift, cy-bodyH*0.55); ctx.lineTo(cx-3+browShift, cy-bodyH*0.15); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx+11+browShift, cy-bodyH*0.55); ctx.lineTo(cx+3+browShift, cy-bodyH*0.15); ctx.stroke();

      // oczy (patrzace w strone ruchu)
      const eyeShift = facing*1.5;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(cx-6+eyeShift, cy+bodyH*0.05, 4.3, 5.2, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx+6+eyeShift, cy+bodyH*0.05, 4.3, 5.2, 0, 0, Math.PI*2); ctx.fill();
      if(gfxQuality >= 2){
        ctx.save();
        ctx.shadowColor = 'rgba(255,60,60,.9)';
        ctx.shadowBlur = 8;
      }
      ctx.fillStyle = '#ff3b3b';
      ctx.beginPath(); ctx.arc(cx-6+eyeShift*1.6, cy+bodyH*0.08, 2.2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx+6+eyeShift*1.6, cy+bodyH*0.08, 2.2, 0, Math.PI*2); ctx.fill();
      if(gfxQuality >= 2) ctx.restore();
      ctx.fillStyle = '#1a0d28';
      ctx.beginPath(); ctx.arc(cx-6+eyeShift*1.6, cy+bodyH*0.08, 0.9, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx+6+eyeShift*1.6, cy+bodyH*0.08, 0.9, 0, Math.PI*2); ctx.fill();

      // zabawne zebki
      if(gfxQuality >= 1){
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(cx-5, cy+bodyH*0.55);
        ctx.lineTo(cx-2, cy+bodyH*0.42);
        ctx.lineTo(cx+1, cy+bodyH*0.55);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx+2, cy+bodyH*0.55);
        ctx.lineTo(cx+5, cy+bodyH*0.42);
        ctx.lineTo(cx+8, cy+bodyH*0.55);
        ctx.fill();
      }

      // cechy charakterystyczne danego typu - zeby sylwetka byla rozpoznawalna nawet bez koloru
      if(e.type === 'charger'){
        // rogi - agresywny wyglad szarzujacego
        ctx.fillStyle = palette.dark;
        ctx.beginPath(); ctx.moveTo(cx-bodyW*0.55, cy-bodyH*0.55); ctx.lineTo(cx-bodyW*0.85, cy-bodyH*1.25); ctx.lineTo(cx-bodyW*0.25, cy-bodyH*0.8); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx+bodyW*0.55, cy-bodyH*0.55); ctx.lineTo(cx+bodyW*0.85, cy-bodyH*1.25); ctx.lineTo(cx+bodyW*0.25, cy-bodyH*0.8); ctx.closePath(); ctx.fill();
        if(gfxQuality >= 1 && Math.abs(e.vx) > 0.5){
          // smugi predkosci za plecami podczas szarzy
          ctx.strokeStyle = 'rgba(255,255,255,.4)';
          ctx.lineWidth = 2;
          for(let i=0;i<3;i++){
            const sy2 = cy - bodyH*0.5 + i*bodyH*0.5;
            ctx.beginPath(); ctx.moveTo(cx-facing*bodyW*1.1, sy2); ctx.lineTo(cx-facing*bodyW*1.7, sy2); ctx.stroke();
          }
        }
      } else if(e.type === 'shooter'){
        // lufa skierowana w strone ruchu
        ctx.fillStyle = palette.dark;
        ctx.fillRect(cx + facing*bodyW*0.55, cy-3, facing*bodyW*0.5, 6);
        ctx.fillStyle = palette.stroke;
        ctx.beginPath(); ctx.arc(cx + facing*(bodyW*0.55+bodyW*0.5), cy, 4, 0, Math.PI*2); ctx.fill();
      } else if(e.type === 'flyer'){
        // ogonek stabilizujacy z tylu
        ctx.fillStyle = palette.mid;
        ctx.beginPath();
        ctx.moveTo(cx - facing*bodyW*0.9, cy-2);
        ctx.lineTo(cx - facing*bodyW*1.4, cy-8);
        ctx.lineTo(cx - facing*bodyW*1.4, cy+2);
        ctx.closePath(); ctx.fill();
      } else if(e.type === 'jumper'){
        // nic dodatkowego - sprezyste nozki juz wyrozniaja ten typ
      } else {
        // domyslny (walker) - male czulki, dla "sluzowato-kosmicznego" wygladu
        ctx.strokeStyle = palette.dark;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx-5, cy-bodyH*0.95); ctx.lineTo(cx-8, cy-bodyH*1.35); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx+5, cy-bodyH*0.95); ctx.lineTo(cx+8, cy-bodyH*1.35); ctx.stroke();
        ctx.fillStyle = palette.light;
        ctx.beginPath(); ctx.arc(cx-8, cy-bodyH*1.35, 2.2, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx+8, cy-bodyH*1.35, 2.2, 0, Math.PI*2); ctx.fill();
      }
    }
  }
