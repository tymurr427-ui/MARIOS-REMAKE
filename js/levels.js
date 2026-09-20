// Definicje 19 poziomow. Kazda funkcja levelN() zwraca swiezy obiekt poziomu.
// Zalezy tylko od GROUND_Y (musi rownac sie GROUND_Y z main.js: 720 - 60).
(function(){
  const GROUND_Y = 720 - 60;

  // ---------- LEVEL DEFINITIONS ----------
  function mkGround(x,w){ return {x, y:GROUND_Y, w, h:200, isGround:true}; }

  function level1(){
    const platforms = [
      mkGround(0, 1000),
      mkGround(1050, 900),
      {x:260, y:GROUND_Y-90, w:110, h:22},
      {x:430, y:GROUND_Y-150, w:110, h:22},
      {x:620, y:GROUND_Y-90, w:110, h:22},
      {x:1120, y:GROUND_Y-100, w:130, h:22},
      {x:1320, y:GROUND_Y-170, w:110, h:22},
      {x:1520, y:GROUND_Y-100, w:130, h:22},
      {x:1750, y:GROUND_Y-60, w:120, h:22},
    ];
    const pipes = [
      {x:520, y:GROUND_Y-46, w:46, h:46},
      {x:1450, y:GROUND_Y-60, w:46, h:60},
    ];
    const coins = [];
    function row(x,y,n,gap){ for(let i=0;i<n;i++) coins.push({x:x+i*gap,y,taken:false,t:Math.random()*10}); }
    row(280, GROUND_Y-130, 4, 26);
    row(450, GROUND_Y-190, 4, 26);
    row(640, GROUND_Y-130, 4, 26);
    row(1140, GROUND_Y-140, 5, 26);
    row(1340, GROUND_Y-210, 4, 26);
    row(1540, GROUND_Y-140, 5, 26);
    row(150, GROUND_Y-60, 3, 26);
    row(880, GROUND_Y-60, 5, 30);
    const enemies = [
      {x:520, y:GROUND_Y-34, w:34, h:34, vx:0.6, minX:460, maxX:700, alive:true},
      {x:1150, y:GROUND_Y-134, w:34, h:34, vx:0.56, minX:1130, maxX:1235, alive:true},
      {x:1580, y:GROUND_Y-34, w:34, h:34, vx:0.64, minX:1550, maxX:1720, alive:true},
    ];
    return { name:'Zielone Wzgórza', platforms, pipes, coins, enemies, flag:{x:1900,y:GROUND_Y-220,w:14,h:220}, width:2000, bg:'day' };
  }

  function level2(){
    const platforms = [
      mkGround(0, 400),
      mkGround(520, 260),
      mkGround(900, 300),
      mkGround(1330, 260),
      mkGround(1720, 500),
      {x:180, y:GROUND_Y-110, w:100, h:22},
      {x:620, y:GROUND_Y-100, w:100, h:22},
      {x:790, y:GROUND_Y-160, w:100, h:22},
      {x:1000, y:GROUND_Y-110, w:110, h:22},
      {x:1180, y:GROUND_Y-170, w:100, h:22},
      {x:1420, y:GROUND_Y-100, w:110, h:22},
      {x:1600, y:GROUND_Y-160, w:100, h:22},
    ];
    const pipes = [
      {x:300, y:GROUND_Y-60, w:46, h:60},
      {x:1050, y:GROUND_Y-46, w:46, h:46},
    ];
    const coins = [];
    function row(x,y,n,gap){ for(let i=0;i<n;i++) coins.push({x:x+i*gap,y,taken:false,t:Math.random()*10}); }
    row(190, GROUND_Y-150, 3, 26);
    row(630, GROUND_Y-140, 3, 26);
    row(800, GROUND_Y-200, 3, 26);
    row(1010, GROUND_Y-150, 4, 26);
    row(1190, GROUND_Y-210, 3, 26);
    row(1430, GROUND_Y-140, 4, 26);
    row(1610, GROUND_Y-200, 3, 26);
    const enemies = [
      {x:150, y:GROUND_Y-34, w:34, h:34, vx:0.6, minX:60, maxX:340, alive:true},
      {x:600, y:GROUND_Y-34, w:34, h:34, vx:0.64, minX:560, maxX:740, alive:true},
      {x:1040, y:GROUND_Y-144, w:34, h:34, vx:0.52, minX:1010, maxX:1100, alive:true},
      {x:1400, y:GROUND_Y-34, w:34, h:34, vx:0.68, minX:1360, maxX:1560, alive:true},
    ];
    return { name:'Skoki nad Przepaścią', platforms, pipes, coins, enemies, flag:{x:2100,y:GROUND_Y-220,w:14,h:220}, width:2200, bg:'day' };
  }

  function level3(){
    const platforms = [
      mkGround(0, 300),
      mkGround(420, 200),
      mkGround(760, 200),
      mkGround(1100, 200),
      mkGround(1440, 200),
      mkGround(1780, 500),
      {x:340, y:GROUND_Y-100, w:90, h:22},
      {x:600, y:GROUND_Y-130, w:90, h:22},
      {x:680, y:GROUND_Y-100, w:90, h:22},
      {x:940, y:GROUND_Y-140, w:90, h:22},
      {x:1020, y:GROUND_Y-190, w:90, h:22},
      {x:1280, y:GROUND_Y-100, w:90, h:22},
      {x:1360, y:GROUND_Y-170, w:90, h:22},
      {x:1620, y:GROUND_Y-140, w:90, h:22},
    ];
    const pipes = [
      {x:200, y:GROUND_Y-60, w:46, h:60},
      {x:860, y:GROUND_Y-46, w:46, h:46},
      {x:1550, y:GROUND_Y-60, w:46, h:60},
    ];
    const coins = [];
    function row(x,y,n,gap){ for(let i=0;i<n;i++) coins.push({x:x+i*gap,y,taken:false,t:Math.random()*10}); }
    row(350, GROUND_Y-140, 3, 26);
    row(610, GROUND_Y-170, 3, 26);
    row(690, GROUND_Y-140, 3, 26);
    row(950, GROUND_Y-180, 3, 26);
    row(1030, GROUND_Y-230, 3, 26);
    row(1290, GROUND_Y-140, 3, 26);
    row(1370, GROUND_Y-210, 3, 26);
    row(1630, GROUND_Y-180, 3, 26);
    const enemies = [
      {x:80, y:GROUND_Y-34, w:34, h:34, vx:0.56, minX:60, maxX:170, alive:true},
      {x:1050, y:GROUND_Y-224, w:34, h:34, vx:0.48, minX:1030, maxX:1100, alive:true},
      {x:1470, y:GROUND_Y-34, w:34, h:34, vx:0.6, minX:1460, maxX:1530, alive:true},
      {x:1900, y:GROUND_Y-34, w:34, h:34, vx:0.64, minX:1850, maxX:2050, alive:true},
    ];
    return { name:'Kamienny Labirynt', platforms, pipes, coins, enemies, flag:{x:2200,y:GROUND_Y-220,w:14,h:220}, width:2300, bg:'dusk' };
  }

  function level4(){
    const platforms = [
      mkGround(0, 260),
      {x:340, y:GROUND_Y-90, w:80, h:22},
      {x:520, y:GROUND_Y-150, w:80, h:22},
      {x:700, y:GROUND_Y-90, w:80, h:22},
      mkGround(860, 180),
      {x:1120, y:GROUND_Y-100, w:90, h:22},
      {x:1300, y:GROUND_Y-180, w:80, h:22},
      {x:1470, y:GROUND_Y-240, w:80, h:22},
      {x:1650, y:GROUND_Y-180, w:80, h:22},
      {x:1820, y:GROUND_Y-100, w:90, h:22},
      mkGround(2000, 500),
    ];
    const pipes = [
      {x:900, y:GROUND_Y-60, w:46, h:60},
      {x:1950, y:GROUND_Y-46, w:46, h:46},
    ];
    const coins = [];
    function row(x,y,n,gap){ for(let i=0;i<n;i++) coins.push({x:x+i*gap,y,taken:false,t:Math.random()*10}); }
    row(350, GROUND_Y-130, 3, 26);
    row(530, GROUND_Y-190, 3, 26);
    row(710, GROUND_Y-130, 3, 26);
    row(1130, GROUND_Y-140, 3, 26);
    row(1310, GROUND_Y-220, 3, 26);
    row(1480, GROUND_Y-280, 3, 26);
    row(1660, GROUND_Y-220, 3, 26);
    row(1830, GROUND_Y-140, 3, 26);
    const enemies = [
      {x:100, y:GROUND_Y-34, w:34, h:34, vx:0.6, minX:40, maxX:220, alive:true},
      {x:920, y:GROUND_Y-34, w:34, h:34, vx:0.64, minX:880, maxX:1020, alive:true},
      {x:2100, y:GROUND_Y-34, w:34, h:34, vx:0.68, minX:2040, maxX:2300, alive:true},
    ];
    return { name:'Wieża Chmur', platforms, pipes, coins, enemies, flag:{x:2400,y:GROUND_Y-220,w:14,h:220}, width:2500, bg:'night' };
  }

  function level5(){
    const platforms = [
      mkGround(0,300),
      mkGround(420,200),
      mkGround(760,200),
      mkGround(1100,200),
      mkGround(1440,200),
      mkGround(1780,500),
      {x:340, y:GROUND_Y-100, w:90, h:22},
      {x:600, y:GROUND_Y-130, w:90, h:22},
      {x:680, y:GROUND_Y-100, w:90, h:22},
      {x:940, y:GROUND_Y-140, w:90, h:22},
      {x:1020, y:GROUND_Y-190, w:90, h:22},
      {x:1280, y:GROUND_Y-100, w:90, h:22},
      {x:1360, y:GROUND_Y-170, w:90, h:22},
      {x:1620, y:GROUND_Y-140, w:90, h:22},
    ];
    const pipes = [
      {x:200, y:GROUND_Y-60, w:46, h:60},
      {x:860, y:GROUND_Y-46, w:46, h:46},
      {x:1550, y:GROUND_Y-60, w:46, h:60},
    ];
    const coins = [];
    function row(x,y,n,gap){ for(let i=0;i<n;i++) coins.push({x:x+i*gap,y,taken:false,t:Math.random()*10}); }
    row(350, GROUND_Y-140, 3, 26);
    row(610, GROUND_Y-170, 3, 26);
    row(690, GROUND_Y-140, 3, 26);
    row(950, GROUND_Y-180, 3, 26);
    row(1030, GROUND_Y-230, 3, 26);
    row(1290, GROUND_Y-140, 3, 26);
    row(1370, GROUND_Y-210, 3, 26);
    row(1630, GROUND_Y-180, 3, 26);
    const enemies = [
      {x:80, y:GROUND_Y-34, w:34, h:34, vx:0.6, minX:60, maxX:170, alive:true},
      {x:800, y:GROUND_Y-34, w:34, h:34, vx:0.68, minX:770, maxX:900, alive:true},
      {x:1050, y:GROUND_Y-224, w:34, h:34, vx:0.52, minX:1030, maxX:1100, alive:true},
      {x:1470, y:GROUND_Y-34, w:34, h:34, vx:0.64, minX:1460, maxX:1530, alive:true},
      {x:1900, y:GROUND_Y-34, w:34, h:34, vx:0.72, minX:1850, maxX:2050, alive:true},
      {x:2150, y:GROUND_Y-34, w:34, h:34, vx:0.6, minX:2100, maxX:2250, alive:true},
    ];
    return { name:'Wulkaniczna Otchłań', platforms, pipes, coins, enemies, flag:{x:2200,y:GROUND_Y-220,w:14,h:220}, width:2300, bg:'volcano' };
  }

  function level6(){
    const platforms = [
      mkGround(0, 260),
      {x:340, y:GROUND_Y-90, w:80, h:22},
      {x:520, y:GROUND_Y-150, w:80, h:22},
      {x:700, y:GROUND_Y-90, w:80, h:22},
      mkGround(860, 180),
      {x:1120, y:GROUND_Y-100, w:90, h:22},
      {x:1300, y:GROUND_Y-180, w:80, h:22},
      {x:1470, y:GROUND_Y-240, w:80, h:22},
      {x:1650, y:GROUND_Y-180, w:80, h:22},
      {x:1820, y:GROUND_Y-100, w:90, h:22},
      mkGround(2000, 500),
    ];
    const pipes = [
      {x:900, y:GROUND_Y-60, w:46, h:60},
      {x:1950, y:GROUND_Y-46, w:46, h:46},
    ];
    const coins = [];
    function row(x,y,n,gap){ for(let i=0;i<n;i++) coins.push({x:x+i*gap,y,taken:false,t:Math.random()*10}); }
    row(350, GROUND_Y-130, 3, 26);
    row(530, GROUND_Y-190, 3, 26);
    row(710, GROUND_Y-130, 3, 26);
    row(1130, GROUND_Y-140, 3, 26);
    row(1310, GROUND_Y-220, 3, 26);
    row(1480, GROUND_Y-280, 3, 26);
    row(1660, GROUND_Y-220, 3, 26);
    row(1830, GROUND_Y-140, 3, 26);
    const enemies = [
      {x:100, y:GROUND_Y-34, w:34, h:34, vx:0.64, minX:40, maxX:220, alive:true},
      {x:920, y:GROUND_Y-34, w:34, h:34, vx:0.68, minX:880, maxX:1020, alive:true},
      {x:2050, y:GROUND_Y-34, w:34, h:34, vx:0.72, minX:2040, maxX:2160, alive:true},
      {x:2280, y:GROUND_Y-34, w:34, h:34, vx:0.64, minX:2200, maxX:2400, alive:true},
    ];
    return { name:'Lodowa Twierdza', platforms, pipes, coins, enemies, flag:{x:2400,y:GROUND_Y-220,w:14,h:220}, width:2500, bg:'ice' };
  }

  function level7(){
    const platforms = [
      mkGround(0, 260),
      mkGround(900, 200),
      mkGround(1850, 550),
    ];
    const pipes = [];
    // mosty z 3 zsynchronizowanych platform (ta sama predkosc i faza = STALY, bezpieczny odstep
    // miedzy nimi niezaleznie od momentu skoku - nie da sie juz "spoznic" na platforme)
    const movers = [
      {baseX:340, baseY:GROUND_Y-40, x:340, y:GROUND_Y-40, w:90, h:20, axis:'x', range:50, speed:1.0, isMover:true},
      {baseX:530, baseY:GROUND_Y-40, x:530, y:GROUND_Y-40, w:90, h:20, axis:'x', range:50, speed:1.0, isMover:true},
      {baseX:720, baseY:GROUND_Y-40, x:720, y:GROUND_Y-40, w:90, h:20, axis:'x', range:50, speed:1.0, isMover:true},
      {baseX:1250, baseY:GROUND_Y-40, x:1250, y:GROUND_Y-40, w:90, h:20, axis:'x', range:55, speed:1.0, isMover:true},
      {baseX:1450, baseY:GROUND_Y-40, x:1450, y:GROUND_Y-40, w:90, h:20, axis:'x', range:55, speed:1.0, isMover:true},
      {baseX:1650, baseY:GROUND_Y-40, x:1650, y:GROUND_Y-40, w:90, h:20, axis:'x', range:55, speed:1.0, isMover:true},
    ];
    const coins = [];
    function row(x,y,n,gap){ for(let i=0;i<n;i++) coins.push({x:x+i*gap,y,taken:false,t:Math.random()*10}); }
    row(150, GROUND_Y-100, 3, 26);
    row(340, GROUND_Y-90, 3, 26);
    row(530, GROUND_Y-90, 3, 26);
    row(720, GROUND_Y-90, 3, 26);
    row(950, GROUND_Y-100, 4, 26);
    row(1250, GROUND_Y-90, 3, 26);
    row(1450, GROUND_Y-90, 3, 26);
    row(1650, GROUND_Y-90, 3, 26);
    row(1980, GROUND_Y-100, 6, 26);
    const hazards = [
      {x:2200, y:GROUND_Y-18, w:36, h:18},
    ];
    const enemies = [
      {x:530, y:GROUND_Y-140, w:32, h:32, vx:0.52, minX:400, maxX:750, baseY:GROUND_Y-140, amp:35, type:'flyer', alive:true},
      {x:1450, y:GROUND_Y-34, w:34, h:34, vx:0.56, minX:1300, maxX:1600, alive:true},
    ];
    return { name:'Latający Szlak', platforms, pipes, coins, enemies, movers, hazards, flag:{x:2350,y:GROUND_Y-220,w:14,h:220}, width:2450, bg:'desert' };
  }

  function level8(){
    const platforms = [
      mkGround(0, 260),
      {x:420, y:GROUND_Y-40, w:90, h:22},
      {x:590, y:GROUND_Y-40, w:90, h:22},
      mkGround(700, 200),
      {x:1220, y:GROUND_Y-90, w:90, h:22},
      {x:1400, y:GROUND_Y-150, w:90, h:22},
      mkGround(1600, 500),
    ];
    const pipes = [
      {x:340, y:GROUND_Y-60, w:46, h:60},
    ];
    const movers = [
      {baseX:1000, baseY:GROUND_Y-150, x:1000, y:GROUND_Y-150, w:90, h:20, axis:'y', range:110, speed:0.8, isMover:true},
    ];
    const coins = [];
    function row(x,y,n,gap){ for(let i=0;i<n;i++) coins.push({x:x+i*gap,y,taken:false,t:Math.random()*10}); }
    row(80, GROUND_Y-100, 3, 26);
    row(430, GROUND_Y-90, 3, 26);
    row(600, GROUND_Y-90, 3, 26);
    row(720, GROUND_Y-100, 4, 26);
    row(1230, GROUND_Y-130, 3, 26);
    row(1410, GROUND_Y-190, 3, 26);
    row(1650, GROUND_Y-100, 5, 26);
    row(1900, GROUND_Y-100, 4, 26);
    const hazards = [
      {x:800, y:GROUND_Y-18, w:40, h:18},
    ];
    const enemies = [
      {x:900, y:GROUND_Y-34, w:34, h:34, jumpHeight:70, baseY:GROUND_Y-34, type:'jumper', alive:true},
      {x:1250, y:GROUND_Y-124, w:32, h:32, jumpHeight:60, baseY:GROUND_Y-124, type:'jumper', alive:true},
      {x:1700, y:GROUND_Y-34, w:34, h:34, vx:0.64, minX:1650, maxX:1850, alive:true},
      {x:1980, y:GROUND_Y-34, w:34, h:34, jumpHeight:80, baseY:GROUND_Y-34, type:'jumper', alive:true},
    ];
    return { name:'Pustynia Kolców', platforms, pipes, coins, enemies, movers, hazards, flag:{x:2020,y:GROUND_Y-220,w:14,h:220}, width:2150, bg:'desert' };
  }

  function level9(){
    const platforms = [
      mkGround(0, 240),
      mkGround(1050, 220),
      mkGround(2200, 600),
    ];
    const pipes = [];
    // dwa dlugie mosty z 4 zsynchronizowanych platform kazdy - staly, bezpieczny odstep
    const movers = [
      {baseX:320, baseY:GROUND_Y-40, x:320, y:GROUND_Y-40, w:90, h:20, axis:'x', range:50, speed:1.0, isMover:true},
      {baseX:510, baseY:GROUND_Y-40, x:510, y:GROUND_Y-40, w:90, h:20, axis:'x', range:50, speed:1.0, isMover:true},
      {baseX:700, baseY:GROUND_Y-40, x:700, y:GROUND_Y-40, w:90, h:20, axis:'x', range:50, speed:1.0, isMover:true},
      {baseX:890, baseY:GROUND_Y-40, x:890, y:GROUND_Y-40, w:90, h:20, axis:'x', range:50, speed:1.0, isMover:true},
      {baseX:1350, baseY:GROUND_Y-40, x:1350, y:GROUND_Y-40, w:90, h:20, axis:'x', range:55, speed:1.0, isMover:true},
      {baseX:1540, baseY:GROUND_Y-40, x:1540, y:GROUND_Y-40, w:90, h:20, axis:'x', range:55, speed:1.0, isMover:true},
      {baseX:1730, baseY:GROUND_Y-40, x:1730, y:GROUND_Y-40, w:90, h:20, axis:'x', range:55, speed:1.0, isMover:true},
      {baseX:1920, baseY:GROUND_Y-40, x:1920, y:GROUND_Y-40, w:90, h:20, axis:'x', range:55, speed:1.0, isMover:true},
      // bonusowa winda pionowa w obrebie 3 - dodatkowe monety, nie blokuje przejscia
      {baseX:2500, baseY:GROUND_Y-150, x:2500, y:GROUND_Y-150, w:90, h:20, axis:'y', range:100, speed:0.8, isMover:true},
    ];
    const coins = [];
    function row(x,y,n,gap){ for(let i=0;i<n;i++) coins.push({x:x+i*gap,y,taken:false,t:Math.random()*10}); }
    row(120, GROUND_Y-100, 3, 26);
    row(320, GROUND_Y-90, 3, 26);
    row(510, GROUND_Y-90, 3, 26);
    row(700, GROUND_Y-90, 3, 26);
    row(890, GROUND_Y-90, 3, 26);
    row(1100, GROUND_Y-100, 4, 26);
    row(1350, GROUND_Y-90, 3, 26);
    row(1540, GROUND_Y-90, 3, 26);
    row(1730, GROUND_Y-90, 3, 26);
    row(1920, GROUND_Y-90, 3, 26);
    row(2500, GROUND_Y-220, 3, 26);
    row(2650, GROUND_Y-100, 5, 26);
    const hazards = [
      {x:2350, y:GROUND_Y-18, w:36, h:18},
    ];
    const enemies = [
      {x:500, y:GROUND_Y-140, w:32, h:32, vx:0.56, minX:350, maxX:750, baseY:GROUND_Y-140, amp:35, type:'flyer', alive:true},
      {x:1100, y:GROUND_Y-34, w:34, h:34, jumpHeight:75, baseY:GROUND_Y-34, type:'jumper', alive:true},
      {x:1200, y:GROUND_Y-34, w:34, h:34, vx:0.64, minX:1160, maxX:1250, alive:true},
      {x:1650, y:GROUND_Y-150, w:32, h:32, vx:0.6, minX:1500, maxX:1800, baseY:GROUND_Y-150, amp:40, type:'flyer', alive:true},
      {x:2280, y:GROUND_Y-34, w:34, h:34, vx:0.64, minX:2250, maxX:2450, alive:true},
      {x:2480, y:GROUND_Y-34, w:34, h:34, jumpHeight:80, baseY:GROUND_Y-34, type:'jumper', alive:true},
      {x:2680, y:GROUND_Y-34, w:34, h:34, vx:0.68, minX:2650, maxX:2760, alive:true},
    ];
    return { name:'Ostateczna Próba', platforms, pipes, coins, enemies, movers, hazards, flag:{x:2750,y:GROUND_Y-220,w:14,h:220}, width:2850, bg:'night' };
  }

  function level10(){
    const platforms = [
      mkGround(0, 260),
      mkGround(500, 220),
      mkGround(1250, 200),
      mkGround(2000, 600),
    ];
    const pipes = [];
    const movers = [
      {baseX:343, baseY:GROUND_Y-40, x:343, y:GROUND_Y-40, w:90, h:20, axis:'x', range:58, speed:1.0, isMover:true},
      {baseX:820, baseY:GROUND_Y-40, x:820, y:GROUND_Y-40, w:90, h:20, axis:'x', range:50, speed:1.0, isMover:true},
      {baseX:1010, baseY:GROUND_Y-40, x:1010, y:GROUND_Y-40, w:90, h:20, axis:'x', range:50, speed:1.0, isMover:true},
      {baseX:1200, baseY:GROUND_Y-40, x:1200, y:GROUND_Y-40, w:90, h:20, axis:'x', range:50, speed:1.0, isMover:true},
      {baseX:1550, baseY:GROUND_Y-40, x:1550, y:GROUND_Y-40, w:90, h:20, axis:'x', range:50, speed:1.0, isMover:true},
      {baseX:1740, baseY:GROUND_Y-40, x:1740, y:GROUND_Y-40, w:90, h:20, axis:'x', range:50, speed:1.0, isMover:true},
      {baseX:1930, baseY:GROUND_Y-40, x:1930, y:GROUND_Y-40, w:90, h:20, axis:'x', range:50, speed:1.0, isMover:true},
    ];
    const coins = [];
    function row(x,y,n,gap){ for(let i=0;i<n;i++) coins.push({x:x+i*gap,y,taken:false,t:Math.random()*10}); }
    row(120, GROUND_Y-100, 3, 26);
    row(343, GROUND_Y-90, 3, 26);
    row(560, GROUND_Y-100, 3, 26);
    row(820, GROUND_Y-90, 3, 26);
    row(1010, GROUND_Y-90, 3, 26);
    row(1200, GROUND_Y-90, 3, 26);
    row(1300, GROUND_Y-100, 3, 26);
    row(1550, GROUND_Y-90, 3, 26);
    row(1740, GROUND_Y-90, 3, 26);
    row(1930, GROUND_Y-90, 3, 26);
    row(2100, GROUND_Y-100, 5, 26);
    const hazards = [
      {x:2300, y:GROUND_Y-18, w:40, h:18},
    ];
    const enemies = [
      {x:560, y:GROUND_Y-34, w:34, h:34, vx:0.55, minX:520, maxX:680, alive:true},
      {x:1300, y:GROUND_Y-34, w:34, h:34, jumpHeight:70, baseY:GROUND_Y-34, type:'jumper', alive:true},
      {x:2450, y:GROUND_Y-34, w:34, h:34, vx:0.6, minX:2400, maxX:2550, alive:true},
    ];
    return { name:'Podniebna Forteca', platforms, pipes, coins, enemies, movers, hazards, flag:{x:2450,y:GROUND_Y-220,w:14,h:220}, width:2600, bg:'ice' };
  }

  function level11(){
    const platforms = [
      mkGround(0, 240),
      mkGround(650, 200),
      mkGround(1500, 220),
      mkGround(2450, 600),
    ];
    const pipes = [];
    const movers = [
      {baseX:380, baseY:GROUND_Y-40, x:380, y:GROUND_Y-40, w:90, h:20, axis:'x', range:50, speed:1.0, isMover:true},
      {baseX:570, baseY:GROUND_Y-40, x:570, y:GROUND_Y-40, w:90, h:20, axis:'x', range:50, speed:1.0, isMover:true},
      {baseX:950, baseY:GROUND_Y-40, x:950, y:GROUND_Y-40, w:90, h:20, axis:'x', range:50, speed:1.0, isMover:true},
      {baseX:1140, baseY:GROUND_Y-40, x:1140, y:GROUND_Y-40, w:90, h:20, axis:'x', range:50, speed:1.0, isMover:true},
      {baseX:1330, baseY:GROUND_Y-40, x:1330, y:GROUND_Y-40, w:90, h:20, axis:'x', range:50, speed:1.0, isMover:true},
      {baseX:1820, baseY:GROUND_Y-40, x:1820, y:GROUND_Y-40, w:90, h:20, axis:'x', range:55, speed:1.0, isMover:true},
      {baseX:2010, baseY:GROUND_Y-40, x:2010, y:GROUND_Y-40, w:90, h:20, axis:'x', range:55, speed:1.0, isMover:true},
      {baseX:2200, baseY:GROUND_Y-40, x:2200, y:GROUND_Y-40, w:90, h:20, axis:'x', range:55, speed:1.0, isMover:true},
      // bonusowa winda pionowa na ostatniej wyspie
      {baseX:2750, baseY:GROUND_Y-160, x:2750, y:GROUND_Y-160, w:90, h:20, axis:'y', range:110, speed:0.8, isMover:true},
    ];
    const coins = [];
    function row(x,y,n,gap){ for(let i=0;i<n;i++) coins.push({x:x+i*gap,y,taken:false,t:Math.random()*10}); }
    row(100, GROUND_Y-100, 3, 26);
    row(380, GROUND_Y-90, 3, 26);
    row(570, GROUND_Y-90, 3, 26);
    row(700, GROUND_Y-100, 4, 26);
    row(950, GROUND_Y-90, 3, 26);
    row(1140, GROUND_Y-90, 3, 26);
    row(1330, GROUND_Y-90, 3, 26);
    row(1550, GROUND_Y-100, 4, 26);
    row(1820, GROUND_Y-90, 3, 26);
    row(2010, GROUND_Y-90, 3, 26);
    row(2200, GROUND_Y-90, 3, 26);
    row(2750, GROUND_Y-230, 3, 26);
    row(2900, GROUND_Y-100, 5, 26);
    const hazards = [
      {x:700, y:GROUND_Y-18, w:40, h:18},
      {x:1550, y:GROUND_Y-18, w:40, h:18},
      {x:2650, y:GROUND_Y-18, w:40, h:18},
    ];
    const enemies = [
      {x:700, y:GROUND_Y-34, w:34, h:34, vx:0.55, minX:670, maxX:820, alive:true},
      {x:1650, y:GROUND_Y-34, w:34, h:34, jumpHeight:70, baseY:GROUND_Y-34, type:'jumper', alive:true},
      {x:2500, y:GROUND_Y-34, w:34, h:34, vx:0.6, minX:2470, maxX:2620, alive:true},
      {x:2700, y:GROUND_Y-34, w:34, h:34, jumpHeight:75, baseY:GROUND_Y-34, type:'jumper', alive:true},
      {x:2980, y:GROUND_Y-34, w:34, h:34, vx:0.6, minX:2950, maxX:3040, alive:true},
    ];
    return { name:'Mroczny Finał', platforms, pipes, coins, enemies, movers, hazards, flag:{x:2950,y:GROUND_Y-220,w:14,h:220}, width:3050, bg:'volcano' };
  }

  function level12(){
    const platforms = [
      mkGround(0, 300),
      mkGround(420, 200),
      mkGround(760, 200),
      mkGround(1100, 200),
      mkGround(1440, 200),
      mkGround(1780, 500),
      {x:340, y:GROUND_Y-100, w:90, h:22},
      {x:600, y:GROUND_Y-130, w:90, h:22},
      {x:680, y:GROUND_Y-100, w:90, h:22},
      {x:940, y:GROUND_Y-140, w:90, h:22},
      {x:1020, y:GROUND_Y-190, w:90, h:22},
      {x:1280, y:GROUND_Y-100, w:90, h:22},
      {x:1360, y:GROUND_Y-170, w:90, h:22},
      {x:1620, y:GROUND_Y-140, w:90, h:22},
    ];
    const pipes = [
      {x:200, y:GROUND_Y-60, w:46, h:60},
      {x:860, y:GROUND_Y-46, w:46, h:46},
      {x:1550, y:GROUND_Y-60, w:46, h:60},
    ];
    const coins = [];
    function row(x,y,n,gap){ for(let i=0;i<n;i++) coins.push({x:x+i*gap,y,taken:false,t:Math.random()*10}); }
    row(350, GROUND_Y-140, 3, 26);
    row(610, GROUND_Y-170, 3, 26);
    row(690, GROUND_Y-140, 3, 26);
    row(950, GROUND_Y-180, 3, 26);
    row(1030, GROUND_Y-230, 3, 26);
    row(1290, GROUND_Y-140, 3, 26);
    row(1370, GROUND_Y-210, 3, 26);
    row(1630, GROUND_Y-180, 3, 26);
    const hazards = [
      {x:500, y:GROUND_Y-18, w:36, h:18},
      {x:1200, y:GROUND_Y-18, w:36, h:18},
    ];
    const enemies = [
      {x:1050, y:GROUND_Y-224, w:34, h:34, jumpHeight:65, baseY:GROUND_Y-224, type:'jumper', alive:true},
      {x:1900, y:GROUND_Y-34, w:34, h:34, vx:0.64, minX:1850, maxX:2050, alive:true},
    ];
    return { name:'Zamarznięty Labirynt', platforms, pipes, coins, enemies, hazards, flag:{x:2200,y:GROUND_Y-220,w:14,h:220}, width:2300, bg:'ice' };
  }

  function level13(){
    const platforms = [
      mkGround(0, 240),
      mkGround(1050, 220),
      mkGround(2200, 600),
    ];
    const pipes = [];
    const movers = [
      {baseX:320, baseY:GROUND_Y-40, x:320, y:GROUND_Y-40, w:90, h:20, axis:'x', range:50, speed:1.0, isMover:true},
      {baseX:510, baseY:GROUND_Y-40, x:510, y:GROUND_Y-40, w:90, h:20, axis:'x', range:50, speed:1.0, isMover:true},
      {baseX:700, baseY:GROUND_Y-40, x:700, y:GROUND_Y-40, w:90, h:20, axis:'x', range:50, speed:1.0, isMover:true},
      {baseX:890, baseY:GROUND_Y-40, x:890, y:GROUND_Y-40, w:90, h:20, axis:'x', range:50, speed:1.0, isMover:true},
      {baseX:1350, baseY:GROUND_Y-40, x:1350, y:GROUND_Y-40, w:90, h:20, axis:'x', range:55, speed:1.0, isMover:true},
      {baseX:1540, baseY:GROUND_Y-40, x:1540, y:GROUND_Y-40, w:90, h:20, axis:'x', range:55, speed:1.0, isMover:true},
      {baseX:1730, baseY:GROUND_Y-40, x:1730, y:GROUND_Y-40, w:90, h:20, axis:'x', range:55, speed:1.0, isMover:true},
      {baseX:1920, baseY:GROUND_Y-40, x:1920, y:GROUND_Y-40, w:90, h:20, axis:'x', range:55, speed:1.0, isMover:true},
    ];
    const coins = [];
    function row(x,y,n,gap){ for(let i=0;i<n;i++) coins.push({x:x+i*gap,y,taken:false,t:Math.random()*10}); }
    row(120, GROUND_Y-100, 3, 26);
    row(320, GROUND_Y-90, 3, 26);
    row(510, GROUND_Y-90, 3, 26);
    row(700, GROUND_Y-90, 3, 26);
    row(890, GROUND_Y-90, 3, 26);
    row(1100, GROUND_Y-100, 4, 26);
    row(1350, GROUND_Y-90, 3, 26);
    row(1540, GROUND_Y-90, 3, 26);
    row(1730, GROUND_Y-90, 3, 26);
    row(1920, GROUND_Y-90, 3, 26);
    row(2350, GROUND_Y-100, 5, 26);
    const hazards = [
      {x:2500, y:GROUND_Y-18, w:36, h:18},
    ];
    const enemies = [
      {x:1150, y:GROUND_Y-140, w:32, h:32, vx:0.5, minX:1100, maxX:1260, baseY:GROUND_Y-140, amp:35, type:'flyer', alive:true},
      {x:1200, y:GROUND_Y-34, w:34, h:34, jumpHeight:70, baseY:GROUND_Y-34, type:'jumper', alive:true},
      {x:2280, y:GROUND_Y-34, w:34, h:34, vx:0.6, minX:2240, maxX:2420, alive:true},
      {x:2600, y:GROUND_Y-34, w:34, h:34, jumpHeight:75, baseY:GROUND_Y-34, type:'jumper', alive:true},
      {x:2700, y:GROUND_Y-34, w:34, h:34, vx:0.6, minX:2650, maxX:2760, alive:true},
    ];
    return { name:'Piaszczysta Otchłań', platforms, pipes, coins, enemies, movers, hazards, flag:{x:2750,y:GROUND_Y-220,w:14,h:220}, width:2850, bg:'desert' };
  }

  function level14(){
    const platforms = [
      mkGround(0, 300),
      mkGround(420, 200),
      mkGround(760, 200),
      mkGround(1100, 200),
      mkGround(1440, 200),
      mkGround(1780, 500),
      {x:340, y:GROUND_Y-100, w:90, h:22},
      {x:680, y:GROUND_Y-100, w:90, h:22},
      {x:1280, y:GROUND_Y-100, w:90, h:22},
      {x:1620, y:GROUND_Y-140, w:90, h:22},
    ];
    const pipes = [
      {x:200, y:GROUND_Y-60, w:46, h:60},
    ];
    const crushers = [
      {x:490, w:50, h:50, topY:80, bottomY:GROUND_Y-55, speed:1.0, t:0},
      {x:1170, w:50, h:50, topY:80, bottomY:GROUND_Y-55, speed:1.1, t:3},
    ];
    const shooters = [
      {x:760, y:GROUND_Y-90, dir:1, interval:260},
      {x:2260, y:GROUND_Y-90, dir:-1, interval:230},
    ];
    const coins = [];
    function row(x,y,n,gap){ for(let i=0;i<n;i++) coins.push({x:x+i*gap,y,taken:false,t:Math.random()*10}); }
    row(350, GROUND_Y-140, 3, 26);
    row(690, GROUND_Y-140, 3, 26);
    row(950, GROUND_Y-100, 4, 26);
    row(1290, GROUND_Y-140, 3, 26);
    row(1630, GROUND_Y-180, 3, 26);
    row(1900, GROUND_Y-100, 5, 26);
    const hazards = [];
    const enemies = [
      {x:800, y:GROUND_Y-34, w:34, h:34, vx:0.5, minX:770, maxX:900, alive:true},
      {x:1500, y:GROUND_Y-34, w:34, h:34, jumpHeight:65, baseY:GROUND_Y-34, type:'jumper', alive:true},
      {x:2000, y:GROUND_Y-34, w:34, h:34, vx:0.6, minX:1950, maxX:2150, alive:true},
    ];
    return { name:'Korytarz Zagłady', platforms, pipes, coins, enemies, hazards, crushers, shooters, flag:{x:2200,y:GROUND_Y-220,w:14,h:220}, width:2300, bg:'volcano' };
  }

  function level15(){
    const platforms = [
      mkGround(0, 2300),
    ];
    const pipes = [];
    const coins = [];
    function row(x,y,n,gap){ for(let i=0;i<n;i++) coins.push({x:x+i*gap,y,taken:false,t:Math.random()*10}); }
    row(150, GROUND_Y-100, 4, 26);
    row(500, GROUND_Y-100, 4, 26);
    row(2000, GROUND_Y-100, 6, 26);
    const enemies = [
      {x:300, y:GROUND_Y-34, w:34, h:34, vx:0.6, minX:250, maxX:600, alive:true},
      {
        x:1350, y:GROUND_Y-90, w:90, h:90, alive:true, type:'boss',
        name:'Król Kolców', hp:6, maxHp:6, hitTimer:0,
        vx:0.9, minX:1150, maxX:1750, baseY:GROUND_Y-90, animT:0
      },
    ];
    return { name:'Starcie z Bossem', platforms, pipes, coins, enemies, flag:{x:2200,y:GROUND_Y-220,w:14,h:220}, width:2300, bg:'volcano' };
  }

  function level16(){
    const platforms = [
      mkGround(0, 240),
      mkGround(1050, 220),
      mkGround(2200, 600),
      mkGround(3730, 900),
      {x:3820, y:GROUND_Y-100, w:90, h:22},
      {x:4050, y:GROUND_Y-140, w:90, h:22},
    ];
    const pipes = [
      {x:1100, y:GROUND_Y-46, w:46, h:46},
    ];
    const movers = [
      {baseX:320, baseY:GROUND_Y-40, x:320, y:GROUND_Y-40, w:90, h:20, axis:'x', range:50, speed:1.0, isMover:true},
      {baseX:510, baseY:GROUND_Y-40, x:510, y:GROUND_Y-40, w:90, h:20, axis:'x', range:50, speed:1.0, isMover:true},
      {baseX:700, baseY:GROUND_Y-40, x:700, y:GROUND_Y-40, w:90, h:20, axis:'x', range:50, speed:1.0, isMover:true},
      {baseX:890, baseY:GROUND_Y-40, x:890, y:GROUND_Y-40, w:90, h:20, axis:'x', range:50, speed:1.0, isMover:true},
      {baseX:1350, baseY:GROUND_Y-40, x:1350, y:GROUND_Y-40, w:90, h:20, axis:'x', range:55, speed:1.0, isMover:true},
      {baseX:1540, baseY:GROUND_Y-40, x:1540, y:GROUND_Y-40, w:90, h:20, axis:'x', range:55, speed:1.0, isMover:true},
      {baseX:1730, baseY:GROUND_Y-40, x:1730, y:GROUND_Y-40, w:90, h:20, axis:'x', range:55, speed:1.0, isMover:true},
      {baseX:1920, baseY:GROUND_Y-40, x:1920, y:GROUND_Y-40, w:90, h:20, axis:'x', range:55, speed:1.0, isMover:true},
      {baseX:2880, baseY:GROUND_Y-150, x:2880, y:GROUND_Y-150, w:90, h:20, axis:'y', range:110, speed:0.8, isMover:true},
      {baseX:3070, baseY:GROUND_Y-40, x:3070, y:GROUND_Y-40, w:90, h:20, axis:'x', range:55, speed:1.0, isMover:true},
      {baseX:3260, baseY:GROUND_Y-40, x:3260, y:GROUND_Y-40, w:90, h:20, axis:'x', range:55, speed:1.0, isMover:true},
      {baseX:3450, baseY:GROUND_Y-40, x:3450, y:GROUND_Y-40, w:90, h:20, axis:'x', range:55, speed:1.0, isMover:true},
    ];
    const crushers = [
      {x:3900, w:50, h:50, topY:80, bottomY:GROUND_Y-55, speed:1.0, t:0},
    ];
    const shooters = [
      {x:3980, y:GROUND_Y-90, dir:1, interval:245},
      {x:4150, y:GROUND_Y-90, dir:-1, interval:235},
    ];
    const coins = [];
    function row(x,y,n,gap){ for(let i=0;i<n;i++) coins.push({x:x+i*gap,y,taken:false,t:Math.random()*10}); }
    row(120, GROUND_Y-100, 3, 26);
    row(320, GROUND_Y-90, 3, 26);
    row(510, GROUND_Y-90, 3, 26);
    row(700, GROUND_Y-90, 3, 26);
    row(890, GROUND_Y-90, 3, 26);
    row(1100, GROUND_Y-100, 4, 26);
    row(1350, GROUND_Y-90, 3, 26);
    row(1540, GROUND_Y-90, 3, 26);
    row(1730, GROUND_Y-90, 3, 26);
    row(1920, GROUND_Y-90, 3, 26);
    row(2350, GROUND_Y-100, 5, 26);
    row(2900, GROUND_Y-200, 3, 26);
    row(3820, GROUND_Y-140, 3, 26);
    row(4050, GROUND_Y-180, 3, 26);
    const hazards = [
      {x:2500, y:GROUND_Y-18, w:36, h:18},
      {x:4300, y:GROUND_Y-18, w:36, h:18},
    ];
    const enemies = [
      {x:1150, y:GROUND_Y-140, w:32, h:32, vx:0.5, minX:1100, maxX:1260, baseY:GROUND_Y-140, amp:35, type:'flyer', alive:true},
      {x:1200, y:GROUND_Y-34, w:34, h:34, jumpHeight:70, baseY:GROUND_Y-34, type:'jumper', alive:true},
      {x:2280, y:GROUND_Y-34, w:34, h:34, vx:0.6, minX:2240, maxX:2420, alive:true},
      {x:2600, y:GROUND_Y-34, w:34, h:34, jumpHeight:75, baseY:GROUND_Y-34, type:'jumper', alive:true},
      {x:3800, y:GROUND_Y-34, w:34, h:34, vx:0.55, minX:3760, maxX:3870, alive:true},
      {x:4000, y:GROUND_Y-160, w:32, h:32, vx:0.5, minX:3950, maxX:4100, baseY:GROUND_Y-160, amp:30, type:'flyer', alive:true},
      {
        x:4400, y:GROUND_Y-90, w:90, h:90, alive:true, type:'boss',
        name:'Strażnik Traktu', hp:6, maxHp:6, hitTimer:0,
        vx:0.9, minX:4300, maxX:4550, baseY:GROUND_Y-90, animT:0
      },
    ];
    return { name:'Długi Trakt', platforms, pipes, coins, enemies, movers, hazards, crushers, shooters, flag:{x:4600,y:GROUND_Y-220,w:14,h:220}, checkpoint:{x:2350,y:GROUND_Y}, width:4700, bg:'dusk' };
  }

  function level17(){
    const platforms = [
      mkGround(0, 280),
      mkGround(400, 200),
      mkGround(730, 200),
      mkGround(1060, 200),
      mkGround(1390, 200),
      mkGround(1720, 700),
      {x:320, y:GROUND_Y-110, w:90, h:22},
      {x:650, y:GROUND_Y-100, w:90, h:22},
      {x:980, y:GROUND_Y-140, w:90, h:22},
      {x:1310, y:GROUND_Y-110, w:90, h:22},
      {x:1900, y:GROUND_Y-150, w:90, h:22},
    ];
    const pipes = [
      {x:180, y:GROUND_Y-60, w:46, h:60},
    ];
    const crushers = [
      {x:470, w:50, h:50, topY:80, bottomY:GROUND_Y-55, speed:1.1, t:0},
      {x:1130, w:50, h:50, topY:80, bottomY:GROUND_Y-55, speed:1.0, t:2},
      {x:2000, w:50, h:50, topY:80, bottomY:GROUND_Y-55, speed:1.2, t:1},
    ];
    const shooters = [
      {x:600, y:GROUND_Y-90, dir:1, interval:230},
      {x:930, y:GROUND_Y-90, dir:-1, interval:235},
      {x:1590, y:GROUND_Y-90, dir:1, interval:220},
      {x:2100, y:GROUND_Y-90, dir:-1, interval:215},
    ];
    const coins = [];
    function row(x,y,n,gap){ for(let i=0;i<n;i++) coins.push({x:x+i*gap,y,taken:false,t:Math.random()*10}); }
    row(60, GROUND_Y-100, 3, 26);
    row(330, GROUND_Y-150, 3, 26);
    row(660, GROUND_Y-140, 3, 26);
    row(990, GROUND_Y-180, 3, 26);
    row(1320, GROUND_Y-150, 3, 26);
    row(1780, GROUND_Y-100, 4, 26);
    row(1910, GROUND_Y-190, 3, 26);
    row(2150, GROUND_Y-100, 4, 26);
    const hazards = [
      {x:850, y:GROUND_Y-18, w:36, h:18},
      {x:1450, y:GROUND_Y-18, w:36, h:18},
    ];
    const enemies = [
      {x:500, y:GROUND_Y-34, w:34, h:34, vx:0.55, minX:420, maxX:590, alive:true},
      {x:1200, y:GROUND_Y-34, w:34, h:34, jumpHeight:65, baseY:GROUND_Y-34, type:'jumper', alive:true},
      {x:1850, y:GROUND_Y-160, w:32, h:32, vx:0.5, minX:1780, maxX:1980, baseY:GROUND_Y-160, amp:30, type:'flyer', alive:true},
      {x:2250, y:GROUND_Y-34, w:34, h:34, vx:0.6, minX:2200, maxX:2380, alive:true},
    ];
    return { name:'Fortec Wieżyczek', platforms, pipes, coins, enemies, hazards, crushers, shooters, flag:{x:2350,y:GROUND_Y-220,w:14,h:220}, width:2450, bg:'volcano' };
  }

  function level18(){
    const platforms = [
      mkGround(0, 2600),
      {x:800, y:GROUND_Y-120, w:110, h:22},
      {x:1400, y:GROUND_Y-150, w:110, h:22},
    ];
    const pipes = [];
    const crushers = [
      {x:1150, w:50, h:50, topY:80, bottomY:GROUND_Y-55, speed:1.1, t:0},
    ];
    const shooters = [
      {x:600, y:GROUND_Y-90, dir:1, interval:235},
      {x:1900, y:GROUND_Y-90, dir:-1, interval:230},
    ];
    const coins = [];
    function row(x,y,n,gap){ for(let i=0;i<n;i++) coins.push({x:x+i*gap,y,taken:false,t:Math.random()*10}); }
    row(150, GROUND_Y-100, 4, 26);
    row(500, GROUND_Y-100, 4, 26);
    row(820, GROUND_Y-160, 3, 26);
    row(1420, GROUND_Y-190, 3, 26);
    row(2100, GROUND_Y-100, 6, 26);
    const enemies = [
      {x:300, y:GROUND_Y-34, w:34, h:34, vx:0.6, minX:250, maxX:600, alive:true},
      {
        x:1600, y:GROUND_Y-90, w:90, h:90, alive:true, type:'boss',
        name:'Strażnik Bastionu', hp:8, maxHp:8, hitTimer:0,
        vx:1.0, minX:1400, maxX:2000, baseY:GROUND_Y-90, animT:0
      },
    ];
    return { name:'Ostatni Bastion', platforms, pipes, coins, enemies, crushers, shooters, flag:{x:2500,y:GROUND_Y-220,w:14,h:220}, width:2600, bg:'night' };
  }

  function level19(){
    const platforms = [
      mkGround(0, 260),
      {x:340, y:GROUND_Y-40, w:90, h:20, isCrumbler:true, state:'idle', timer:0},
      {x:520, y:GROUND_Y-40, w:90, h:20, isCrumbler:true, state:'idle', timer:0},
      {x:700, y:GROUND_Y-40, w:90, h:20, isCrumbler:true, state:'idle', timer:0},
      mkGround(900, 220),
      {x:1120, y:GROUND_Y-30, w:120, h:20, isTrampoline:true, bounceAnim:0},
      {x:1200, y:GROUND_Y-260, w:130, h:22},
      {x:1450, y:GROUND_Y-260, w:110, h:22},
      {x:1650, y:GROUND_Y-200, w:110, h:22},
      {x:1800, y:GROUND_Y-140, w:90, h:22},
      {x:1950, y:GROUND_Y-40, w:90, h:20, isCrumbler:true, state:'idle', timer:0},
      {x:2100, y:GROUND_Y-40, w:90, h:20, isCrumbler:true, state:'idle', timer:0},
      mkGround(2280, 420),
      {x:2420, y:GROUND_Y-30, w:70, h:20, isTrampoline:true, bounceAnim:0},
      // NOWA CZESC: kolejne kruszace sie platformy nad przepascia
      {x:2800, y:GROUND_Y-40, w:90, h:20, isCrumbler:true, state:'idle', timer:0},
      {x:2980, y:GROUND_Y-40, w:90, h:20, isCrumbler:true, state:'idle', timer:0},
      mkGround(3160, 200),
      // trampolina "od razu z gruntu" wynosi na wyzsza sciezke platform
      {x:3360, y:GROUND_Y-30, w:110, h:20, isTrampoline:true, bounceAnim:0},
      {x:3380, y:GROUND_Y-240, w:120, h:22},
      {x:3600, y:GROUND_Y-240, w:110, h:22},
      {x:3800, y:GROUND_Y-180, w:110, h:22},
      // finalowa arena: miazdzarka + wiezyczki + boss
      mkGround(3980, 550),
    ];
    const pipes = [];
    const crushers = [
      {x:3260, w:50, h:50, topY:80, bottomY:GROUND_Y-55, speed:1.0, t:0},
      {x:4300, w:50, h:50, topY:80, bottomY:GROUND_Y-55, speed:1.1, t:1},
    ];
    const shooters = [
      {x:3300, y:GROUND_Y-90, dir:1, interval:220},
      {x:4180, y:GROUND_Y-90, dir:-1, interval:220},
    ];
    const coins = [];
    function row(x,y,n,gap){ for(let i=0;i<n;i++) coins.push({x:x+i*gap,y,taken:false,t:Math.random()*10}); }
    row(340, GROUND_Y-80, 3, 26);
    row(520, GROUND_Y-80, 3, 26);
    row(700, GROUND_Y-80, 3, 26);
    row(1230, GROUND_Y-300, 3, 26);
    row(1460, GROUND_Y-300, 3, 26);
    row(1660, GROUND_Y-240, 3, 26);
    row(1950, GROUND_Y-80, 3, 26);
    row(2100, GROUND_Y-80, 3, 26);
    row(2430, GROUND_Y-220, 4, 26);
    row(2600, GROUND_Y-100, 4, 26);
    row(2800, GROUND_Y-80, 3, 26);
    row(2980, GROUND_Y-80, 3, 26);
    row(3180, GROUND_Y-100, 4, 26);
    row(3400, GROUND_Y-280, 4, 26);
    row(3610, GROUND_Y-280, 3, 26);
    row(3820, GROUND_Y-220, 3, 26);
    row(4050, GROUND_Y-100, 5, 26);
    const enemies = [
      {x:1500, y:GROUND_Y-300, w:32, h:32, vx:0.5, minX:1220, maxX:1750, baseY:GROUND_Y-300, amp:30, type:'flyer', alive:true},
      {x:2350, y:GROUND_Y-34, w:34, h:34, jumpHeight:70, baseY:GROUND_Y-34, type:'jumper', alive:true},
      {x:2600, y:GROUND_Y-34, w:34, h:34, vx:0.6, minX:2550, maxX:2680, alive:true},
      {x:3200, y:GROUND_Y-34, w:34, h:34, vx:0.5, minX:3170, maxX:3340, alive:true},
      {x:3620, y:GROUND_Y-274, w:34, h:34, jumpHeight:55, baseY:GROUND_Y-274, type:'jumper', alive:true},
      {x:3850, y:GROUND_Y-320, w:32, h:32, vx:0.55, minX:3760, maxX:4100, baseY:GROUND_Y-320, amp:35, type:'flyer', alive:true},
      {
        x:4400, y:GROUND_Y-90, w:90, h:90, alive:true, type:'boss',
        name:'Wartownik Szlaku', hp:7, maxHp:7, hitTimer:0,
        vx:0.9, minX:4230, maxX:4480, baseY:GROUND_Y-90, animT:0
      },
    ];
    return { name:'Chwiejny Szlak', platforms, pipes, coins, enemies, crushers, shooters, flag:{x:4500,y:GROUND_Y-220,w:14,h:220}, width:4600, bg:'aurora' };
  }

  window.SPB_GROUND_Y = GROUND_Y;
  window.SPB_LEVEL_FUNCS = [level1, level2, level3, level4, level5, level6, level7, level8, level9, level10, level11, level12, level13, level14, level15, level16, level17, level18, level19];
})();
