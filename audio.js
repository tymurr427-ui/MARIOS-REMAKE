// AudioEngine: syntezowana muzyka i efekty dzwiekowe.
// Klasyczny skrypt (bez IIFE): wspolny zasieg globalny z pozostalymi plikami js/.
  // ---------- AUDIO (wlasna, syntezowana muzyka - bez zadnych cudzych nagran) ----------
  const AudioEngine = (function(){
    let ctx, masterGain;
    let musicOn = true;
    let melodyTimer = null;
    let melodyIndex = 0;
    let volume = 0.28; // 0..0.5 (glosnosc bazowa)

    // prosta, oryginalna melodyjka w stylu chiptune (nuty w Hz, dlugosc w sek; 0 = pauza)
    const MELODY = [
      [523,0.2],[0,0.05],[523,0.2],[0,0.05],[659,0.2],[0,0.05],[523,0.2],[0,0.05],
      [784,0.4],[0,0.15],[698,0.4],[0,0.15],
      [659,0.2],[0,0.05],[587,0.2],[0,0.05],[523,0.4],[0,0.2],
      [440,0.2],[0,0.05],[523,0.2],[0,0.05],[587,0.4],[0,0.3],
    ];

    function ensureCtx(){
      if(!ctx){
        ctx = new (window.AudioContext||window.webkitAudioContext)();
        masterGain = ctx.createGain();
        masterGain.gain.value = volume;
        masterGain.connect(ctx.destination);
      }
      if(ctx.state === 'suspended') ctx.resume();
    }

    function tone(freq, delay, dur, type, vol){
      if(!ctx || freq<=0) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'square';
      o.frequency.value = freq;
      o.connect(g); g.connect(masterGain);
      const t0 = ctx.currentTime + delay;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime((vol!==undefined?vol:0.4), t0+0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
      o.start(t0);
      o.stop(t0+dur+0.02);
    }

    function scheduleMusic(){
      if(!musicOn) return;
      ensureCtx();
      clearTimeout(melodyTimer);
      function step(){
        if(!musicOn) return;
        const [freq,dur] = MELODY[melodyIndex % MELODY.length];
        if(freq>0) tone(freq, 0, dur*0.85, 'triangle', 0.22);
        melodyIndex++;
        melodyTimer = setTimeout(step, dur*1000);
      }
      step();
    }
    function stopMusic(){ clearTimeout(melodyTimer); melodyTimer = null; }
    function toggleMusic(){
      musicOn = !musicOn;
      if(musicOn) scheduleMusic(); else stopMusic();
      return musicOn;
    }
    function setVolume(v){
      volume = Math.max(0, Math.min(0.5, v));
      if(masterGain) masterGain.gain.value = volume;
    }
    function getVolume(){ return volume; }

    return {
      ensureCtx,
      startIfNeeded(){ ensureCtx(); if(musicOn && !melodyTimer) scheduleMusic(); },
      sfxJump(){ ensureCtx(); tone(600,0,0.08,'square',0.3); tone(880,0.05,0.1,'square',0.25); },
      sfxCoin(){ ensureCtx(); tone(988,0,0.07,'square',0.3); tone(1318,0.06,0.12,'square',0.3); },
      sfxStomp(){ ensureCtx(); tone(150,0,0.14,'square',0.35); },
      sfxHurt(){ ensureCtx(); tone(300,0,0.1,'sawtooth',0.3); tone(180,0.1,0.22,'sawtooth',0.3); },
      sfxWin(){ ensureCtx(); [523,659,784,1046].forEach((f,i)=>tone(f,i*0.13,0.18,'square',0.3)); },
      sfxLose(){ ensureCtx(); [392,349,311,262].forEach((f,i)=>tone(f,i*0.16,0.22,'sawtooth',0.3)); },
      toggleMusic,
      setVolume,
      getVolume,
      isOn(){ return musicOn; }
    };
  })();

  // odblokuj audio przy pierwszej interakcji uzytkownika (wymog przegladarek)
  document.addEventListener('click', function initAudioOnce(){
    AudioEngine.startIfNeeded();
    document.removeEventListener('click', initAudioOnce);
  });
