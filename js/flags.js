// Flagi (trails): miniatury i flaga za graczem.
// Klasyczny skrypt (bez IIFE): wspolny zasieg globalny z pozostalymi plikami js/.
  function drawMiniFlag(px, py, w, h, id, colors, targetCtx){
    const g = targetCtx || ctx;   // domyslnie glowny canvas gry; sklep podaje wlasny canvas miniaturki
    const c = colors;
    const x0 = -w/2, y0 = -h/2;
    g.save();
    g.translate(px, py);
    // cień/obrys dla czytelności na dowolnym tle
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.fillRect(x0-1, y0-1, w+2, h+2);
    switch(id){
      case 'ukraine':
      case 'poland':
      case 'belarus':
      case 'monaco':
      case 'sanmarino':
      case 'liechtenstein':
        g.fillStyle = c[0]; g.fillRect(x0, y0, w, h/2);
        g.fillStyle = c[1]; g.fillRect(x0, y0+h/2, w, h/2);
        break;
      case 'lithuania':
      case 'germany':
      case 'austria':
      case 'netherlands':
      case 'hungary':
      case 'bulgaria':
      case 'estonia':
      case 'croatia':
      case 'slovakia':
      case 'slovenia':
      case 'serbia':
      case 'luxembourg':
        g.fillStyle = c[0]; g.fillRect(x0, y0, w, h/3);
        g.fillStyle = c[1]; g.fillRect(x0, y0+h/3, w, h/3);
        g.fillStyle = c[2]; g.fillRect(x0, y0+2*h/3, w, h/3);
        break;
      case 'latvia':
        g.fillStyle = c[0]; g.fillRect(x0, y0, w, h*0.4);
        g.fillStyle = c[1]; g.fillRect(x0, y0+h*0.4, w, h*0.2);
        g.fillStyle = c[2]; g.fillRect(x0, y0+h*0.6, w, h*0.4);
        break;
      case 'spain':
        g.fillStyle = c[0]; g.fillRect(x0, y0, w, h*0.25);
        g.fillStyle = c[1]; g.fillRect(x0, y0+h*0.25, w, h*0.5);
        g.fillStyle = c[0]; g.fillRect(x0, y0+h*0.75, w, h*0.25);
        break;
      case 'italy':
      case 'france':
      case 'belgium':
      case 'ireland':
      case 'romania':
        g.fillStyle = c[0]; g.fillRect(x0, y0, w/3, h);
        g.fillStyle = c[1]; g.fillRect(x0+w/3, y0, w/3, h);
        g.fillStyle = c[2]; g.fillRect(x0+2*w/3, y0, w/3, h);
        break;
      case 'sweden':
      case 'finland':
      case 'denmark':
        g.fillStyle = c[0]; g.fillRect(x0, y0, w, h);
        g.fillStyle = c[1];
        g.fillRect(x0 + w*0.3, y0, w*0.14, h);
        g.fillRect(x0, y0 + h*0.38, w, h*0.24);
        break;
      case 'japan':
        g.fillStyle = c[0]; g.fillRect(x0, y0, w, h);
        g.fillStyle = c[1];
        g.beginPath(); g.arc(0, 0, h*0.32, 0, Math.PI*2); g.fill();
        break;
      case 'usa': {
        g.fillStyle = c[2]; g.fillRect(x0, y0, w, h);
        g.fillStyle = c[1];
        for(let i=0;i<5;i++){ if(i%2===0) g.fillRect(x0, y0 + i*h/5, w, h/5); }
        const cantonW = w*0.46, cantonH = h*0.58;
        g.fillStyle = c[0];
        g.fillRect(x0, y0, cantonW, cantonH);
        g.fillStyle = '#ffffff';
        const starsX = 4, starsY = 3, starR = Math.max(0.6, cantonH/starsY*0.16);
        for(let sy=0; sy<starsY; sy++){
          for(let sx=0; sx<starsX; sx++){
            const sxp = x0 + cantonW*(sx+0.5)/starsX;
            const syp = y0 + cantonH*(sy+0.5)/starsY;
            g.beginPath();
            g.arc(sxp, syp, starR, 0, Math.PI*2);
            g.fill();
          }
        }
        break;
      }
      case 'norway':
      case 'iceland': {
        g.fillStyle = c[0]; g.fillRect(x0, y0, w, h);
        g.fillStyle = c[1];
        g.fillRect(x0 + w*0.26, y0, w*0.2, h);
        g.fillRect(x0, y0 + h*0.33, w, h*0.34);
        g.fillStyle = c[2];
        g.fillRect(x0 + w*0.31, y0, w*0.1, h);
        g.fillRect(x0, y0 + h*0.42, w, h*0.16);
        break;
      }
      case 'switzerland': {
        g.fillStyle = c[0]; g.fillRect(x0, y0, w, h);
        g.fillStyle = c[1];
        const sz = h*0.68, th = sz*0.34;
        g.fillRect(-th/2, -sz/2, th, sz);
        g.fillRect(-sz/2, -th/2, sz, th);
        break;
      }
      case 'czechia':
        g.fillStyle = c[0]; g.fillRect(x0, y0, w, h/2);
        g.fillStyle = c[1]; g.fillRect(x0, y0+h/2, w, h/2);
        g.fillStyle = c[2];
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + w*0.5, 0); g.lineTo(x0, y0+h); g.closePath(); g.fill();
        break;
      case 'uk': {
        g.fillStyle = c[0]; g.fillRect(x0, y0, w, h);
        g.save();
        g.beginPath(); g.rect(x0, y0, w, h); g.clip();
        g.strokeStyle = c[1]; g.lineWidth = h*0.26;
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0+w, y0+h); g.moveTo(x0+w, y0); g.lineTo(x0, y0+h); g.stroke();
        g.strokeStyle = c[2]; g.lineWidth = h*0.09;
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0+w, y0+h); g.moveTo(x0+w, y0); g.lineTo(x0, y0+h); g.stroke();
        g.restore();
        g.fillStyle = c[1];
        g.fillRect(-h*0.17, y0, h*0.34, h); g.fillRect(x0, y0 + h*0.33, w, h*0.34);
        g.fillStyle = c[2];
        g.fillRect(-h*0.1, y0, h*0.2, h); g.fillRect(x0, y0 + h*0.4, w, h*0.2);
        break;
      }
      case 'canada': {
        g.fillStyle = c[0]; g.fillRect(x0, y0, w, h);
        g.fillStyle = c[1]; g.fillRect(x0 + w*0.25, y0, w*0.5, h);
        g.fillStyle = c[0];
        const lr = h*0.42;
        const leaf = [[0,-1],[.2,-.55],[.5,-.65],[.4,-.2],[.85,-.3],[.65,.05],[.9,.2],[.45,.35],[.5,.5],[.08,.4],[.06,.95],[-.06,.95],[-.08,.4],[-.5,.5],[-.45,.35],[-.9,.2],[-.65,.05],[-.85,-.3],[-.4,-.2],[-.5,-.65],[-.2,-.55]];
        g.beginPath();
        leaf.forEach((q,i) => { const lx = q[0]*lr*0.95, ly = q[1]*lr; if(i) g.lineTo(lx,ly); else g.moveTo(lx,ly); });
        g.closePath(); g.fill();
        break;
      }
      case 'greece': {
        for(let i=0;i<9;i++){ g.fillStyle = (i%2===0) ? c[0] : c[1]; g.fillRect(x0, y0 + i*h/9, w, h/9 + 0.5); }
        const cs = h*5/9;
        g.fillStyle = c[0]; g.fillRect(x0, y0, cs, cs);
        g.fillStyle = c[1];
        g.fillRect(x0 + cs*0.4, y0, cs*0.2, cs); g.fillRect(x0, y0 + cs*0.4, cs, cs*0.2);
        break;
      }
      case 'portugal': {
        g.fillStyle = c[0]; g.fillRect(x0, y0, w*0.4, h);
        g.fillStyle = c[1]; g.fillRect(x0 + w*0.4, y0, w*0.6, h);
        const ex = x0 + w*0.4;
        g.fillStyle = c[2]; g.beginPath(); g.arc(ex, 0, h*0.26, 0, Math.PI*2); g.fill();
        g.fillStyle = c[1]; g.beginPath(); g.arc(ex, 0, h*0.15, 0, Math.PI*2); g.fill();
        g.fillStyle = '#ffffff'; g.beginPath(); g.arc(ex, 0, h*0.06, 0, Math.PI*2); g.fill();
        break;
      }
      case 'turkey': {
        g.fillStyle = c[0]; g.fillRect(x0, y0, w, h);
        g.fillStyle = c[1]; g.beginPath(); g.arc(x0 + w*0.36, 0, h*0.3, 0, Math.PI*2); g.fill();
        g.fillStyle = c[0]; g.beginPath(); g.arc(x0 + w*0.42, 0, h*0.24, 0, Math.PI*2); g.fill();
        g.fillStyle = c[1];
        g.beginPath();
        for(let i=0;i<10;i++){
          const ang = -Math.PI/2 + i*Math.PI/5, rr = (i%2===0) ? h*0.14 : h*0.056;
          const sx2 = x0 + w*0.58 + Math.cos(ang)*rr, sy2 = Math.sin(ang)*rr;
          if(i) g.lineTo(sx2, sy2); else g.moveTo(sx2, sy2);
        }
        g.closePath(); g.fill();
        break;
      }
      case 'brazil': {
        g.fillStyle = c[0]; g.fillRect(x0, y0, w, h);
        g.fillStyle = c[1];
        g.beginPath(); g.moveTo(0, y0 + h*0.1); g.lineTo(x0 + w*0.9, 0); g.lineTo(0, y0 + h*0.9); g.lineTo(x0 + w*0.1, 0); g.closePath(); g.fill();
        g.fillStyle = c[2]; g.beginPath(); g.arc(0, 0, h*0.24, 0, Math.PI*2); g.fill();
        g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(0.8, h*0.05);
        g.beginPath(); g.arc(0, h*0.06, h*0.2, Math.PI*1.15, Math.PI*1.85); g.stroke();
        break;
      }
      case 'pirate': {
        g.fillStyle = c[0]; g.fillRect(x0, y0, w, h);
        g.strokeStyle = c[1]; g.lineWidth = Math.max(1, h*0.09); g.lineCap = 'round';
        g.beginPath(); g.moveTo(-h*0.42, -h*0.34); g.lineTo(h*0.42, h*0.34); g.moveTo(h*0.42, -h*0.34); g.lineTo(-h*0.42, h*0.34); g.stroke();
        g.fillStyle = c[1];
        g.beginPath(); g.arc(0, -h*0.04, h*0.24, 0, Math.PI*2); g.fill();
        g.fillRect(-h*0.12, h*0.1, h*0.24, h*0.17);
        g.fillStyle = c[0];
        g.beginPath(); g.arc(-h*0.09, -h*0.06, h*0.06, 0, Math.PI*2); g.fill();
        g.beginPath(); g.arc(h*0.09, -h*0.06, h*0.06, 0, Math.PI*2); g.fill();
        break;
      }
      default: {
        const bw = w / c.length;
        c.forEach((col,i)=>{ g.fillStyle = col; g.fillRect(x0+i*bw, y0, bw, h); });
      }
    }
    g.restore();
  }

  function drawFlagAt(px, py, w, h, facing, vx, onGround, trailId){
    if(!trailId || trailId === 'none') return;
    const trail = TRAILS.find(t => t.id === trailId);
    if(!trail) return;

    const dir = -(facing || 1); // flaga powiewa w strone przeciwna do kierunku patrzenia
    const poleX = px + (facing >= 0 ? 4 : w - 4);
    const poleY = py + h*0.24;
    const L = 44, Hh = 22;
    const N = 10;
    const moving = Math.abs(vx) > 0.3 || !onGround;
    const running = onGround && Math.abs(vx) > 3.5;
    const speedFactor = running ? 1.7 : 1;
    const t = (timeAlive||0) * 0.16 * speedFactor;
    const ampMax = moving ? 5 : 2;

    const topPts = [], botPts = [];
    for(let i=0;i<=N;i++){
      const f = i/N;
      const x = poleX + dir*L*f;
      const wave = Math.sin(t + f*4.2) * ampMax * f;
      const shrink = Hh/2*(1 - f*0.1);
      topPts.push({x, y: poleY + wave - shrink});
      botPts.push({x, y: poleY + wave + shrink});
    }

    ctx.save();
    ctx.strokeStyle = 'rgba(50,38,22,.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(poleX, poleY - Hh*0.75);
    ctx.lineTo(poleX, poleY + Hh*0.75);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(topPts[0].x, topPts[0].y);
    for(const p of topPts) ctx.lineTo(p.x, p.y);
    for(let i=botPts.length-1;i>=0;i--) ctx.lineTo(botPts[i].x, botPts[i].y);
    ctx.closePath();
    ctx.save();
    ctx.clip();
    ctx.shadowColor = 'rgba(0,0,0,.4)';
    ctx.shadowBlur = 4;
    drawMiniFlag(poleX + dir*L/2, poleY, L, Hh, trail.id, trail.colors);
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,.35)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
  }

  function drawPlayerFlag(){
    drawFlagAt(player.x - camera.x, player.y, player.w, player.h, player.facing, player.vx, player.onGround, state.equippedTrail);
  }
