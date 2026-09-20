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
    if(gfxQuality >= 2 && (level.bg==='night' || level.bg==='volcano' || level.bg==='aurora')){
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
        ctx.fillStyle = '#7a4a1e';
        ctx.fillRect(x, p.y+p.h-6, p.w, 6);
        ctx.fillStyle = '#ff5f6d';
        ctx.fillRect(x, p.y + squash*6, p.w, p.h-6-squash*6);
        ctx.strokeStyle = '#c0392b';
        ctx.lineWidth = 2;
        for(let sx=6; sx<p.w-3; sx+=12) { ctx.beginPath(); ctx.moveTo(x+sx, p.y+p.h-6); ctx.lineTo(x+sx+6, p.y+squash*6); ctx.stroke(); }
        ctx.restore();
        continue;
      }
      if(p.isCrumbler){
        if(p.state === 'gone') continue;
        const shakeX = p.state === 'shaking' ? (Math.random()*4-2) : 0;
        ctx.save();
        ctx.globalAlpha = p.state === 'shaking' ? (0.5 + Math.sin((p.timer||0)*0.9)*0.3) : 1;
        ctx.fillStyle = p.state === 'shaking' ? '#8a5a3a' : '#a06a3e';
        ctx.fillRect(x+shakeX, p.y, p.w, p.h);
        ctx.strokeStyle = '#5a3a1e';
        ctx.lineWidth = 2;
        for(let cx=0; cx<p.w; cx+=18) ctx.strokeRect(x+shakeX+cx, p.y, Math.min(18,p.w-cx), p.h);
        ctx.restore();
        continue;
      }
      if(p.isGround){
        ctx.fillStyle = '#8a5a2b';
        ctx.fillRect(x, p.y, p.w, H-p.y+10);
        ctx.fillStyle = '#3fae4a';
        ctx.fillRect(x, p.y, p.w, 10);
        if(gfxQuality >= 2){
          ctx.fillStyle = 'rgba(255,255,255,.15)';
          ctx.fillRect(x, p.y, p.w, 2);
        }
      } else {
        if(gfxQuality >= 2){
          ctx.fillStyle = 'rgba(0,0,0,.2)';
          ctx.beginPath(); ctx.ellipse(x+p.w/2, p.y+p.h+5, p.w/2.2, 4, 0, 0, Math.PI*2); ctx.fill();
        }
        ctx.fillStyle = '#c96a2e';
        ctx.fillRect(x, p.y, p.w, p.h);
        if(gfxQuality >= 1){
          ctx.strokeStyle = '#7a3d15';
          ctx.lineWidth = 2;
          for(let bx=0; bx<p.w; bx+=22) ctx.strokeRect(x+bx, p.y, Math.min(22, p.w-bx), p.h);
        }
        if(gfxQuality >= 2){
          ctx.fillStyle = 'rgba(255,255,255,.2)';
          ctx.fillRect(x, p.y, p.w, 2);
        }
      }
    }
    for(const p of level.pipes){
      const x = p.x - camera.x;
      if(x+p.w < 0 || x > W) continue;
      ctx.fillStyle = '#1e9e46';
      ctx.fillRect(x, p.y, p.w, p.h);
      ctx.fillStyle = '#2ecc57';
      ctx.fillRect(x-4, p.y, p.w+8, 12);
      if(gfxQuality >= 2){
        ctx.fillStyle = 'rgba(255,255,255,.2)';
        ctx.fillRect(x+4, p.y+14, 4, p.h-16);
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
    ctx.fillStyle = '#ccc';
    ctx.fillRect(x, level.flag.y, 6, level.flag.h);
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.moveTo(x+6, level.flag.y+6);
    ctx.lineTo(x+34, level.flag.y+16);
    ctx.lineTo(x+6, level.flag.y+26);
    ctx.fill();
  }

  function drawCheckpoint(){
    if(!level.checkpoint) return;
    const x = level.checkpoint.x - camera.x;
    if(x < -40 || x > W+40) return;
    const y = level.checkpoint.y;
    const active = levelCheckpointReached;
    ctx.save();
    ctx.fillStyle = active ? '#ccc' : '#8a8f99';
    ctx.fillRect(x, y-220, 5, 220);
    ctx.fillStyle = active ? '#2ecc71' : '#556070';
    ctx.beginPath();
    ctx.moveTo(x+5, y-214);
    ctx.lineTo(x+30, y-206);
    ctx.lineTo(x+5, y-198);
    ctx.fill();
    if(active){
      ctx.shadowColor = '#2ecc71';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(x+2, y-215, 4, 0, Math.PI*2);
      ctx.fillStyle = '#2ecc71';
      ctx.fill();
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

  function drawMovers(){
    if(!level.movers) return;
    for(const m of level.movers){
      const x = m.x - camera.x;
      if(x+m.w < 0 || x > W) continue;
      if(gfxQuality >= 1){
        ctx.fillStyle = 'rgba(0,0,0,.2)';
        ctx.beginPath(); ctx.ellipse(x+m.w/2, m.y+m.h+6, m.w/2, 4, 0, 0, Math.PI*2); ctx.fill();
      }
      ctx.fillStyle = '#8a5ac9';
      ctx.fillRect(x, m.y, m.w, m.h);
      ctx.fillStyle = '#c9a5f5';
      ctx.fillRect(x, m.y, m.w, 5);
      if(gfxQuality >= 1){
        ctx.strokeStyle = '#4a2a70';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, m.y, m.w, m.h);
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
    }
  }
