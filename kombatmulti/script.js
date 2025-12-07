// --- 1. AYARLAR ---
let VS_AI=true, IS_ONLINE=false, IS_HOST=false, AI_DIFFICULTY='normal';
const WIN_SCORE=3;
let gameActive=false, p1, p2, particles=[], screenShake=0, round=1, scores={p1:0,p2:0};
let peer=null, conn=null;

// --- 2. MENÜ YÖNETİMİ ---
window.startLocalGame = function(diff) {
    VS_AI=true; IS_ONLINE=false; AI_DIFFICULTY=diff;
    document.getElementById('p2-name').innerText = "BOT (" + diff.toUpperCase() + ")";
    startGame();
}
window.showOnlineMenu = function() {
    document.getElementById('menu-buttons').style.display='none';
    document.getElementById('online-lobby').style.display='block';
    if(!peer) initPeer();
}
window.hideOnlineMenu = function() {
    document.getElementById('online-lobby').style.display='none';
    document.getElementById('menu-buttons').style.display='block';
}
window.startGame = function() {
    document.getElementById('main-menu').style.display='none';
    document.getElementById('game-hud').style.display='block';
    if(IS_ONLINE) {
        document.getElementById('p1-name').innerText = IS_HOST ? "SEN (HOST)" : "RAKİP";
        document.getElementById('p2-name').innerText = IS_HOST ? "RAKİP" : "SEN (CLIENT)";
    }
    try{SoundManager.init();}catch(e){}
    startRound();
}

// --- 3. SES ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();
const SoundManager = {
    init: () => { if(audioCtx.state === 'suspended') audioCtx.resume(); },
    playTone: (freq, type, vol) => {
        const o=audioCtx.createOscillator(), g=audioCtx.createGain();
        o.type=type; o.frequency.setValueAtTime(freq, audioCtx.currentTime);
        g.gain.setValueAtTime(vol, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime+0.2);
        o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime+0.2);
    },
    jump: () => SoundManager.playTone(200, 'sine', 0.2),
    swing: () => SoundManager.playTone(100, 'triangle', 0.1),
    hit: () => SoundManager.playTone(80, 'square', 0.2),
    ulti: () => SoundManager.playTone(50, 'sawtooth', 0.4)
};

// --- 4. 3D SAHNE ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 1000);
// KAMERA SABİTLENDİ
camera.position.set(0, 7, 26); 
const originalCamPos = { x: 0, y: 7, z: 26 };

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dl = new THREE.DirectionalLight(0xffffff, 1.0); dl.position.set(10,20,10); dl.castShadow=true; scene.add(dl);

// Ring
const g=new THREE.Group();
const base=new THREE.Mesh(new THREE.CylinderGeometry(16,14,2,8), new THREE.MeshStandardMaterial({color:0x333333})); base.position.y=-1.5; base.receiveShadow=true; g.add(base);
const cvs=new THREE.Mesh(new THREE.BoxGeometry(17,0.5,17), new THREE.MeshStandardMaterial({color:0xeeeeee})); cvs.position.y=-0.25; cvs.receiveShadow=true; g.add(cvs);
const pGeo=new THREE.CylinderGeometry(0.3,0.3,5,16);
[{x:-8.5,z:-8.5,c:0xcc0000},{x:8.5,z:8.5,c:0x0000cc},{x:-8.5,z:8.5,c:0xffffff},{x:8.5,z:-8.5,c:0xffffff}].forEach(p=>{const m=new THREE.Mesh(pGeo,new THREE.MeshStandardMaterial({color:p.c}));m.position.set(p.x,2,p.z);g.add(m);});
const rGeo=new THREE.CylinderGeometry(0.08,0.08,17,8); const rMat=new THREE.MeshStandardMaterial({color:0x111111});
[1.5,2.8,4.1].forEach(h=>{
    const b=new THREE.Mesh(rGeo,rMat); b.position.set(0,h,-8.5); b.rotation.z=Math.PI/2; g.add(b);
    const l=new THREE.Mesh(rGeo,rMat); l.position.set(-8.5,h,0); l.rotation.x=Math.PI/2; g.add(l);
    const r=new THREE.Mesh(rGeo,rMat); r.position.set(8.5,h,0); r.rotation.x=Math.PI/2; g.add(r);
});
scene.add(g);

// --- 5. KARAKTER SINIFI (KAFA DÜZELTİLDİ) ---
class Boxer {
    constructor(color, x, facing) {
        this.color=color; this.skin=0xffccaa; this.hp=100; this.stamina=100; this.ulti=0; this.dead=false;
        this.vel={x:0,y:0}; this.isGrounded=false; this.speed=0.12; this.jumpP=0.35; this.facing=facing?1:-1;
        this.isAttacking=false; this.isBlocking=false;
        this.mesh=new THREE.Group(); this.mesh.position.set(x,2.0,0); this.mesh.scale.set(1.3,1.3,1.3);
        
        // Gövde
        const chest=new THREE.Mesh(new THREE.BoxGeometry(1,1.1,0.6), new THREE.MeshStandardMaterial({color:this.skin})); chest.position.y=2.3; chest.castShadow=true; this.mesh.add(chest); this.chest=chest;
        // Şort
        const abs=new THREE.Mesh(new THREE.BoxGeometry(0.95,0.7,0.58), new THREE.MeshStandardMaterial({color:color})); abs.position.y=-0.8; chest.add(abs);
        
        // Kafa (YÜKSELTİLDİ)
        const head=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.6,0.55), new THREE.MeshStandardMaterial({color:this.skin})); 
        head.position.y=1.3; // Yüksekliği artırdım
        chest.add(head); this.head=head;
        head.add(new THREE.Mesh(new THREE.BoxGeometry(0.1,0.05,0.05), new THREE.MeshBasicMaterial({color:0x000}))).position.set(0.15,0.1,0.28);
        head.add(new THREE.Mesh(new THREE.BoxGeometry(0.1,0.05,0.05), new THREE.MeshBasicMaterial({color:0x000}))).position.set(-0.15,0.1,0.28);
        
        this.lArm=this.mkArm(); this.lArm.position.set(0.65,0.3,0); chest.add(this.lArm);
        this.rArm=this.mkArm(); this.rArm.position.set(-0.65,0.3,0); chest.add(this.rArm);
        this.lLeg=this.mkLeg(color); this.lLeg.position.set(0.3,-0.6,0); abs.add(this.lLeg);
        this.rLeg=this.mkLeg(color); this.rLeg.position.set(-0.3,-0.6,0); abs.add(this.rLeg);
        
        this.shield=new THREE.Mesh(new THREE.RingGeometry(0.8,1,32), new THREE.MeshBasicMaterial({color:0xffff00,side:THREE.DoubleSide,transparent:true,opacity:0})); this.shield.position.set(0,0,1); chest.add(this.shield);
        this.aura=new THREE.Mesh(new THREE.CylinderGeometry(1,1,4,16,1,true), new THREE.MeshBasicMaterial({color:0x00ffff,transparent:true,opacity:0,side:THREE.DoubleSide})); this.mesh.add(this.aura);
        scene.add(this.mesh);
    }
    mkArm() {
        const g=new THREE.Group();
        const u=new THREE.Mesh(new THREE.CylinderGeometry(0.17,0.15,0.7), new THREE.MeshStandardMaterial({color:this.skin})); u.position.y=-0.35; g.add(u);
        const e=new THREE.Group(); e.position.y=-0.35; u.add(e);
        const l=new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.11,0.6), new THREE.MeshStandardMaterial({color:this.skin})); l.position.y=-0.3; e.add(l);
        const gl=new THREE.Mesh(new THREE.BoxGeometry(0.35,0.35,0.4), new THREE.MeshStandardMaterial({color:0xffffff})); gl.position.y=-0.4; l.add(gl);
        g.sub=e; g.tip=gl; return g;
    }
    mkLeg(c) {
        const g=new THREE.Group();
        const u=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.17,0.8), new THREE.MeshStandardMaterial({color:c})); u.position.y=-0.4; g.add(u);
        const k=new THREE.Group(); k.position.y=-0.4; u.add(k);
        const l=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.14,0.8), new THREE.MeshStandardMaterial({color:this.skin})); l.position.y=-0.4; k.add(l);
        const f=new THREE.Mesh(new THREE.BoxGeometry(0.25,0.15,0.4), new THREE.MeshStandardMaterial({color:0x111111})); f.position.set(0,-0.45,0.1); l.add(f);
        g.knee=k; return g;
    }
    update(g,t,opp) {
        if(this.dead) return;
        if(this.stamina<100 && !this.isAttacking && !this.isBlocking) this.stamina+=0.2;
        this.shield.material.opacity = this.isBlocking ? 0.6 : 0;
        this.mesh.position.x += this.vel.x; this.mesh.position.y += this.vel.y;
        if(this.mesh.position.y+this.vel.y<=2.0){this.vel.y=0;this.mesh.position.y=2.0;this.isGrounded=true;}else{this.vel.y+=g;this.isGrounded=false;}
        if(this.mesh.position.x<-8.5)this.mesh.position.x=-8.5; if(this.mesh.position.x>8.5)this.mesh.position.x=8.5;
        if(opp) this.facing = opp.mesh.position.x > this.mesh.position.x ? 1 : -1;
        this.mesh.rotation.y = this.facing===1 ? Math.PI/2 : -Math.PI/2;
        
        let ra={x:0}, la={x:0};
        if(this.isBlocking){ra.x=-0.5;la.x=-0.5;}
        else if(!this.isAttacking && Math.abs(this.vel.x)>0.01 && this.isGrounded){
            const w=15; this.lLeg.rotation.x=Math.sin(t*w)*0.8; this.rLeg.rotation.x=Math.cos(t*w)*0.8;
            this.lLeg.knee.rotation.x=Math.abs(Math.sin(t*w)); this.rLeg.knee.rotation.x=Math.abs(Math.cos(t*w));
            la.x+=Math.cos(t*w)*0.3; ra.x+=Math.sin(t*w)*0.3;
        } else { this.lLeg.rotation.x=0; this.rLeg.rotation.x=0; this.lLeg.knee.rotation.x=0; this.rLeg.knee.rotation.x=0; }
        if(!this.isAttacking) {
            this.lArm.rotation.x += (la.x - this.lArm.rotation.x)*0.1;
            this.rArm.rotation.x += (ra.x - this.rArm.rotation.x)*0.1;
        }
        this.aura.material.opacity = this.ulti>=100 ? 0.4 : 0; this.aura.rotation.y+=0.1;
    }
    jump() { if(this.isGrounded && this.stamina>10) { this.vel.y=this.jumpP; this.stamina-=10; SoundManager.jump(); } }
    attack(isUlti) {
        if(this.isAttacking||this.isBlocking||this.dead)return;
        if(!isUlti && this.stamina<15)return;
        this.isAttacking=true; if(!isUlti)this.stamina-=15;
        const arm = Math.random()>0.5 ? this.rArm : this.lArm;
        if(isUlti) { this.ulti=0; SoundManager.ulti(); arm.tip.scale.set(3,3,3); arm.tip.material.color.setHex(0x00ffff); }
        else { SoundManager.swing(); }
        arm.rotation.x=-1.5; arm.sub.rotation.x=0;
        setTimeout(()=>{ arm.rotation.x=0; arm.tip.scale.set(1,1,1); arm.tip.material.color.setHex(0xffffff); this.isAttacking=false; }, isUlti?400:150);
    }
    takeHit(srcX, isUlti) {
        const dir = srcX < this.mesh.position.x ? -1 : 1;
        if(this.isBlocking && !isUlti && ((dir===1 && this.facing===-1) || (dir===-1 && this.facing===1))) {
            SoundManager.block(); this.stamina-=5; this.hp-=1; this.ulti+=2; return;
        }
        SoundManager.hit(); this.hp -= isUlti?35:10; if(this.hp<0)this.hp=0; this.ulti+=15; if(this.ulti>100)this.ulti=100;
        this.vel.x = (srcX < this.mesh.position.x ? 1 : -1) * (isUlti?1.0:0.2); this.vel.y = 0.2;
        this.chest.material.color.setHex(0xffffff); setTimeout(()=>this.chest.material.color.set(this.skin),100);
    }
}

// --- 6. OYUN YÖNETİMİ ---
function startRound() {
    if(p1) scene.remove(p1.mesh); if(p2) scene.remove(p2.mesh);
    p1 = new Boxer(0xd32f2f, -4, true); p2 = new Boxer(0x1976d2, 4, false);
    gameActive = true; document.getElementById('msg-overlay').style.display='none'; updateHUD();
}
function endRound(loser) {
    gameActive = false; const msg=document.getElementById('msg-overlay'); msg.style.display='block';
    if(loser===p1) scores.p2++; else scores.p1++;
    document.querySelector('.score-display').innerHTML=`<span class="p1-color">${scores.p1}</span> - <span class="p2-color">${scores.p2}</span>`;
    if(scores.p1>=3 || scores.p2>=3) { msg.innerHTML = (scores.p1>=3?"KIRMIZI":"MAVİ")+" KAZANDI!"; msg.style.fontSize="60px"; }
    else { msg.innerText="K.O."; setTimeout(()=>{round++; document.getElementById('round-num').innerText=round; msg.innerText="ROUND "+round; setTimeout(startRound,2000);},2000); }
}
function updateHUD() {
    if(!p1) return;
    document.getElementById('p1-hp').style.width=Math.max(0,p1.hp)+'%'; document.getElementById('p2-hp').style.width=Math.max(0,p2.hp)+'%';
    document.getElementById('p1-stamina').style.width=p1.stamina+'%'; document.getElementById('p2-stamina').style.width=p2.stamina+'%';
    document.getElementById('p1-ulti').style.width=p1.ulti+'%'; document.getElementById('p2-ulti').style.width=p2.ulti+'%';
    p1.ulti>=100 ? document.getElementById('p1-ulti').parentElement.classList.add('ulti-ready') : document.getElementById('p1-ulti').parentElement.classList.remove('ulti-ready');
    p2.ulti>=100 ? document.getElementById('p2-ulti').parentElement.classList.add('ulti-ready') : document.getElementById('p2-ulti').parentElement.classList.remove('ulti-ready');
}

// --- 7. KONTROLLER (DÜZELTİLDİ: A=Ulti, S=Savunma, D=Yumruk) ---
function handleInput(pl, k, d) {
    if(d) {
        if(k==='left') pl.vel.x=-pl.speed; if(k==='right') pl.vel.x=pl.speed;
        if(k==='jump') pl.jump(); if(k==='block') pl.isBlocking=true;
        if(k==='attack') pl.attack(false); if(k==='ulti' && pl.ulti>=100) pl.attack(true);
    } else {
        if(k==='left'||k==='right') pl.vel.x=0; if(k==='block') pl.isBlocking=false;
    }
}
window.addEventListener('keydown', e => {
    if(!gameActive) return;
    let act=null;
    if(e.key==='ArrowRight') act='right'; if(e.key==='ArrowLeft') act='left'; if(e.key==='ArrowUp') act='jump';
    if(e.key==='d'||e.key==='D') act='attack'; if(e.key==='s'||e.key==='S') act='block'; if(e.key==='a'||e.key==='A') act='ulti';
    
    if(act) {
        if(IS_ONLINE) {
            const me = IS_HOST ? p1 : p2; handleInput(me, act, true);
            if(conn && conn.open) conn.send({type:'input', key:act, isDown:true});
        } else handleInput(p1, act, true);
    }
});
window.addEventListener('keyup', e => {
    let act=null;
    if(e.key==='ArrowRight') act='right'; if(e.key==='ArrowLeft') act='left'; if(e.key==='s'||e.key==='S') act='block';
    if(act) {
        if(IS_ONLINE) {
            const me = IS_HOST ? p1 : p2; handleInput(me, act, false);
            if(conn && conn.open) conn.send({type:'input', key:act, isDown:false});
        } else handleInput(p1, act, false);
    }
});

// --- 8. AI ---
function updateAI() {
    if(!VS_AI || p2.dead || !gameActive || IS_ONLINE) return;
    const dist = Math.abs(p1.mesh.position.x - p2.mesh.position.x);
    p2.vel.x=0;
    let rate = AI_DIFFICULTY==='hard' ? 0.05 : 0.02;
    if(dist>2.5) p2.vel.x = p2.speed * (p1.mesh.position.x>p2.mesh.position.x?1:-1);
    else if(dist<1.0) p2.vel.x = p2.speed * (p1.mesh.position.x>p2.mesh.position.x?-1:1) * 0.5;
    if(dist<3.5 && Math.random()<rate) p2.attack(false);
    if(p2.ulti>=100 && dist<4 && Math.random()<0.1) p2.attack(true);
    p2.isBlocking = (p1.isAttacking && Math.random()<0.4);
}

// --- 9. OYUN LOOP (KAMERA SABİTLENDİ) ---
function animate() {
    requestAnimationFrame(animate);
    const time = Date.now()*0.001;
    if(gameActive && p1 && p2) {
        if(VS_AI) updateAI();
        p1.update(-0.02, time, p2); p2.update(-0.02, time, p1);
        
        if(!p1.dead && !p2.dead) {
            const dx = p1.mesh.position.x - p2.mesh.position.x;
            if(Math.abs(dx)<1.5 && Math.abs(p1.mesh.position.y - p2.mesh.position.y)<2) {
                const push = (1.5-Math.abs(dx))/2 * (dx>0?1:-1);
                p1.mesh.position.x += push; p2.mesh.position.x -= push;
            }
        }
        
        if(p1.isAttacking && !p1.hasHit) {
            const d = Math.abs(p1.mesh.position.x - p2.mesh.position.x);
            if(d<3.5 && ((p1.facing===1 && p2.mesh.position.x>p1.mesh.position.x)||(p1.facing===-1 && p2.mesh.position.x<p1.mesh.position.x))) {
                p2.takeHit(p1.mesh.position.x, p1.ulti===0); 
                if(p2.hp<=0 && !p2.dead) { p2.dead=true; p2.mesh.rotation.x=-Math.PI/2; endRound(p2); }
            }
            p1.hasHit=true; setTimeout(()=>p1.hasHit=false,200);
        }
        if(p2.isAttacking && !p2.hasHit) {
            const d = Math.abs(p2.mesh.position.x - p1.mesh.position.x);
            if(d<3.5 && ((p2.facing===1 && p1.mesh.position.x>p2.mesh.position.x)||(p2.facing===-1 && p1.mesh.position.x<p2.mesh.position.x))) {
                p1.takeHit(p2.mesh.position.x, p2.ulti===0);
                if(p1.hp<=0 && !p1.dead) { p1.dead=true; p1.mesh.rotation.x=-Math.PI/2; endRound(p1); }
            }
            p2.hasHit=true; setTimeout(()=>p2.hasHit=false,200);
        }
    }
    // KAMERA SABİT
    camera.position.x = originalCamPos.x + (Math.random()-0.5)*screenShake;
    camera.position.y = originalCamPos.y + (Math.random()-0.5)*screenShake;
    screenShake *= 0.9;
    
    particles.forEach((p,i)=>{ p.life-=0.05; p.mesh.position.add(p.vel); p.mesh.scale.setScalar(p.life); if(p.life<=0){scene.remove(p.mesh); particles.splice(i,1);} });
    renderer.render(scene, camera); updateHUD();
}
animate();
window.addEventListener('resize', () => { camera.aspect=window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth,window.innerHeight); });

// --- ONLINE ---
function initPeer() {
    document.getElementById('status-text').innerText = "BAĞLANIYOR...";
    peer = new Peer(null, {debug:1, secure:true, sameSite:'none'});
    peer.on('open', id => { document.getElementById('my-id').innerText=id; document.getElementById('status-text').innerText="HAZIR"; });
    peer.on('connection', c => {
        conn=c; IS_HOST=true;
        conn.on('open', ()=>{
            conn.on('data', d => { if(d.type==='input'){ handleInput(IS_HOST?p2:p1, d.key, d.isDown); } else if(d.type==='START'){VS_AI=false; IS_ONLINE=true; startGame();} });
            VS_AI=false; IS_ONLINE=true; startGame(); conn.send({type:'START'});
        });
    });
}
window.joinGame = function() {
    const id=document.getElementById('friend-id').value; if(!id)return alert("ID YOK");
    conn=peer.connect(id); IS_HOST=false;
    conn.on('open', ()=>{
        document.getElementById('status-text').innerText="BAĞLANDI!";
        conn.on('data', d => {
            if(d.type==='START'){ VS_AI=false; IS_ONLINE=true; startGame(); }
            else if(d.type==='input'){ handleInput(IS_HOST?p2:p1, d.key, d.isDown); }
        });
    });
}
window.copyId = function() { navigator.clipboard.writeText(document.getElementById('my-id').innerText); alert("KOPYALANDI"); }

// --- MOBİL (SOL-YUKARI-SAĞ) ---
['btn-left','btn-jump','btn-right','btn-atk','btn-block','btn-ulti'].forEach(id=>{
    const el=document.getElementById(id);
    const keyMap={'btn-left':'left','btn-right':'right','btn-jump':'jump','btn-atk':'attack','btn-block':'block','btn-ulti':'ulti'};
    if(el) {
        el.addEventListener('touchstart',e=>{e.preventDefault(); handleInput(p1,keyMap[id],true);});
        el.addEventListener('touchend',e=>{e.preventDefault(); handleInput(p1,keyMap[id],false);});
    }
});