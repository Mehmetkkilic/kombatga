// --- 1. AYARLAR VE DEĞİŞKENLER ---
let VS_AI = true;
let IS_ONLINE = false;
let IS_HOST = false;
let AI_DIFFICULTY = 'normal';
const WIN_SCORE = 3;
let gameActive = false;
let p1, p2;
let particles = [];
let screenShake = 0;
let round = 1;
let scores = { p1: 0, p2: 0 };
let peer = null, conn = null;

// --- 2. MENÜ SİSTEMİ (GARANTİLİ ÇALIŞMA) ---
window.startLocalGame = function(difficulty) {
    VS_AI = true; IS_ONLINE = false; AI_DIFFICULTY = difficulty;
    document.getElementById('p2-name').innerText = "BOT (" + difficulty.toUpperCase() + ")";
    startGame();
};

window.showOnlineMenu = function() {
    document.getElementById('menu-buttons').style.display = 'none';
    document.getElementById('online-lobby').style.display = 'block';
    if(!peer) initPeer();
};

window.hideOnlineMenu = function() {
    document.getElementById('online-lobby').style.display = 'none';
    document.getElementById('menu-buttons').style.display = 'block';
};

window.startGame = function() {
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('game-hud').style.display = 'block';
    if(IS_ONLINE) {
        document.getElementById('p1-name').innerText = IS_HOST ? "SEN (HOST)" : "RAKİP";
        document.getElementById('p2-name').innerText = IS_HOST ? "RAKİP" : "SEN (CLIENT)";
    }
    try{SoundManager.init();}catch(e){}
    startRound();
};

// --- 3. SES MOTORU ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();
const SoundManager = {
    init: () => { if (audioCtx.state === 'suspended') audioCtx.resume(); },
    playTone: (freq, type, duration, vol = 0.1) => {
        const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
        osc.type = type; osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + duration);
    },
    playNoise: (duration) => {
        const b = audioCtx.createBuffer(1, audioCtx.sampleRate * duration, audioCtx.sampleRate);
        const d = b.getChannelData(0); for(let i=0; i<d.length; i++) d[i] = Math.random() * 2 - 1;
        const n = audioCtx.createBufferSource(); n.buffer = b; const g = audioCtx.createGain();
        g.gain.setValueAtTime(0.3, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        n.connect(g); g.connect(audioCtx.destination); n.start();
    },
    jump: () => SoundManager.playTone(200, 'sine', 0.2),
    swing: () => SoundManager.playTone(100, 'triangle', 0.1),
    hit: () => { SoundManager.playTone(80, 'square', 0.1, 0.2); SoundManager.playNoise(0.15); },
    block: () => SoundManager.playTone(600, 'sawtooth', 0.1),
    ulti: () => { SoundManager.playTone(50, 'sawtooth', 0.5, 0.3); SoundManager.playNoise(0.5); }
};

// --- 4. THREE.JS SAHNE ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 22); const originalCamPos = { x: 0, y: 5, z: 22 };
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(10, 20, 10); dirLight.castShadow = true; scene.add(dirLight);

function createRing() {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(16,14,2,8), new THREE.MeshStandardMaterial({color:0x333333}));
    base.position.y = -1.5; base.receiveShadow=true; g.add(base);
    const cvs = new THREE.Mesh(new THREE.BoxGeometry(17,0.5,17), new THREE.MeshStandardMaterial({color:0xeeeeee}));
    cvs.position.y = -0.25; cvs.receiveShadow=true; g.add(cvs);
    const pGeo = new THREE.CylinderGeometry(0.3,0.3,5,16);
    [{x:-8.5,z:-8.5,c:0xcc0000},{x:8.5,z:8.5,c:0x0000cc},{x:-8.5,z:8.5,c:0xffffff},{x:8.5,z:-8.5,c:0xffffff}].forEach(p=>{
        const m = new THREE.Mesh(pGeo, new THREE.MeshStandardMaterial({color:p.c}));
        m.position.set(p.x,2,p.z); g.add(m);
    });
    const rGeo = new THREE.CylinderGeometry(0.08,0.08,17,8);
    const rMat = new THREE.MeshStandardMaterial({color:0x111111});
    [1.5,2.8,4.1].forEach(h=>{
        const b = new THREE.Mesh(rGeo,rMat); b.position.set(0,h,-8.5); b.rotation.z=Math.PI/2; g.add(b);
        const l = new THREE.Mesh(rGeo,rMat); l.position.set(-8.5,h,0); l.rotation.x=Math.PI/2; g.add(l);
        const r = new THREE.Mesh(rGeo,rMat); r.position.set(8.5,h,0); r.rotation.x=Math.PI/2; g.add(r);
    });
    scene.add(g);
}
createRing();

// --- 5. KARAKTER ---
class Boxer {
    constructor(color, xPos, isFacingRight) {
        this.color = color; this.skinColor = 0xffccaa;
        this.hp = 100; this.stamina = 100; this.ulti = 0; this.dead = false;
        this.velocity = { x: 0, y: 0 }; this.isGrounded = false; this.speed = 0.12; this.jumpPower = 0.35;
        this.facing = isFacingRight ? 1 : -1; this.isAttacking = false; this.isBlocking = false;
        
        this.mesh = new THREE.Group(); this.mesh.position.set(xPos, 0, 0); this.mesh.scale.set(1.2, 1.2, 1.2);
        
        const chest = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 0.6), new THREE.MeshStandardMaterial({ color: this.skinColor }));
        chest.position.y = 2.3; chest.castShadow = true; this.mesh.add(chest); this.chest = chest;
        
        const abs = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.55), new THREE.MeshStandardMaterial({ color: color }));
        abs.position.y = -0.9; chest.add(abs); this.abs = abs;
        
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.55), new THREE.MeshStandardMaterial({ color: this.skinColor }));
        head.position.y = 0.8; chest.add(head); this.head = head;
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        head.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.05), eyeMat)).position.set(0.15, 0.1, 0.28);
        head.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.05), eyeMat)).position.set(-0.15, 0.1, 0.28);

        this.leftArm = this.createArm(); this.leftArm.position.set(0.65, 0.3, 0); chest.add(this.leftArm);
        this.rightArm = this.createArm(); this.rightArm.position.set(-0.65, 0.3, 0); chest.add(this.rightArm);
        this.leftLeg = this.createLeg(); this.leftLeg.position.set(0.3, -1.4, 0); abs.add(this.leftLeg);
        this.rightLeg = this.createLeg(); this.rightLeg.position.set(-0.3, -1.4, 0); abs.add(this.rightLeg);

        this.shield = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.0, 32), new THREE.MeshBasicMaterial({ color: 0xffff00, side: THREE.DoubleSide, transparent: true, opacity: 0 }));
        this.shield.position.set(0, 0, 1); chest.add(this.shield);
        
        const auraMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0, side: THREE.DoubleSide });
        this.aura = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 4, 16, 1, true), auraMat);
        this.mesh.add(this.aura);
        scene.add(this.mesh);
    }
    createArm() {
        const s = new THREE.Group();
        const u = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.7), new THREE.MeshStandardMaterial({ color: this.skinColor })); u.position.y=-0.35; s.add(u);
        const e = new THREE.Group(); e.position.y=-0.35; u.add(e);
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.6), new THREE.MeshStandardMaterial({ color: this.skinColor })); l.position.y=-0.3; e.add(l);
        const g = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.4), new THREE.MeshStandardMaterial({ color: 0xffffff })); g.position.y=-0.4; l.add(g);
        s.elbow = e; s.glove = g; return s;
    }
    createLeg() {
        const h = new THREE.Group();
        const t = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.8), new THREE.MeshStandardMaterial({ color: this.color })); t.position.y=-0.4; h.add(t);
        const k = new THREE.Group(); k.position.y=-0.4; t.add(k);
        const s = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.8), new THREE.MeshStandardMaterial({ color: this.skinColor })); s.position.y=-0.4; k.add(s);
        const f = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.4), new THREE.MeshStandardMaterial({ color: 0x111111 })); f.position.set(0,-0.45,0.1); s.add(f);
        h.knee = k; return h;
    }
    update(gravity, time) {
        if(this.dead) return;
        if(this.stamina < 100 && !this.isAttacking && !this.isBlocking) this.stamina += 0.2; 
        this.speed = (this.stamina <= 10 || this.isBlocking) ? 0.05 : 0.12;
        this.shield.material.opacity = this.isBlocking ? 0.6 : 0;
        
        let la={x:0,z:0}, ra={x:0,z:0}, le=-2.5, re=-2.5;
        if (this.isBlocking) { la={x:-0.5,z:0.5}; ra={x:-0.5,z:-0.5}; } 
        else if (!this.isAttacking) { const b=Math.sin(time*5)*0.1; la={x:0.5+b,z:0.2}; ra={x:0.5+b,z:-0.2}; le=-2.0; re=-2.0; }

        if (Math.abs(this.velocity.x) > 0.01 && this.isGrounded) {
            const w = 15;
            this.leftLeg.rotation.x = Math.sin(time*w)*0.8; this.rightLeg.rotation.x = Math.cos(time*w)*0.8;
            this.leftLeg.knee.rotation.x = Math.abs(Math.sin(time*w))*1.5; this.rightLeg.knee.rotation.x = Math.abs(Math.cos(time*w))*1.5;
            la.x += Math.cos(time*w)*0.3; ra.x += Math.sin(time*w)*0.3;
        } else {
            this.leftLeg.rotation.x = 0; this.rightLeg.rotation.x = 0; this.leftLeg.knee.rotation.x = 0; this.rightLeg.knee.rotation.x = 0;
        }

        if(!this.isAttacking) {
            this.leftArm.rotation.x += (la.x-this.leftArm.rotation.x)*0.1; this.leftArm.rotation.z += (la.z-this.leftArm.rotation.z)*0.1; this.leftArm.elbow.rotation.x += (le-this.leftArm.elbow.rotation.x)*0.1;
            this.rightArm.rotation.x += (ra.x-this.rightArm.rotation.x)*0.1; this.rightArm.rotation.z += (ra.z-this.rightArm.rotation.z)*0.1; this.rightArm.elbow.rotation.x += (re-this.rightArm.elbow.rotation.x)*0.1;
        }

        this.aura.material.opacity = this.ulti >= 100 ? 0.4 : 0; this.aura.rotation.y += 0.1;
        this.mesh.position.y += this.velocity.y; this.mesh.position.x += this.velocity.x;

        if (this.mesh.position.y + this.velocity.y <= 0) { this.velocity.y = 0; this.mesh.position.y = 0; this.isGrounded = true; } 
        else { this.velocity.y += gravity; this.isGrounded = false; }

        if (this.mesh.position.x < -8.5) this.mesh.position.x = -8.5; if (this.mesh.position.x > 8.5) this.mesh.position.x = 8.5;
        if (!this.isBlocking && !this.isAttacking && Math.abs(this.velocity.x) > 0) this.facing = this.velocity.x > 0 ? 1 : -1;
        this.mesh.rotation.y = (this.facing === 1 ? Math.PI / 2 : -Math.PI / 2);
    }
    jump() { if(this.isGrounded && this.stamina > 10) { this.velocity.y = this.jumpPower; this.stamina -= 10; SoundManager.jump(); } }
    attack(isUlti = false) {
        if (this.isAttacking || this.isBlocking || this.dead) return;
        if (!isUlti && this.stamina < 15) return;
        this.isAttacking = true; if(!isUlti) this.stamina -= 15;
        const arm = Math.random()>0.5 ? this.rightArm : this.leftArm;
        if (isUlti) {
            this.ulti = 0; SoundManager.ulti();
            arm.glove.scale.set(3,3,3); arm.glove.material.color.setHex(0x00ffff);
            arm.rotation.x = -1.5; arm.elbow.rotation.x = 0;
            setTimeout(() => { arm.glove.scale.set(1,1,1); arm.glove.material.color.setHex(0xffffff); this.isAttacking = false; }, 400);
        } else {
            SoundManager.swing(); arm.rotation.x = -1.5; arm.elbow.rotation.x = -0.2; this.chest.rotation.y = Math.random() > 0.5 ? -0.5 : 0.5;
            setTimeout(() => { this.isAttacking = false; this.chest.rotation.y = 0; }, 150);
        }
    }
    takeHit(srcX, isUlti) {
        const dir = srcX < this.mesh.position.x ? -1 : 1;
        if (this.isBlocking && !isUlti && ((dir===1 && this.facing===-1) || (dir===-1 && this.facing===1))) {
            SoundManager.block(); this.stamina -= 5; this.hp -= 1; this.ulti += 2; return;
        }
        SoundManager.hit(); this.hp -= isUlti ? 35 : 10; this.ulti += 15; if(this.ulti>100) this.ulti=100;
        createParticles(this.mesh.position.x, 2, 0xcc0000);
        this.velocity.x = (srcX < this.mesh.position.x ? 1 : -1) * (isUlti ? 1.0 : 0.2); this.velocity.y = isUlti ? 0.5 : 0.2;
        this.head.rotation.x = -0.5; setTimeout(() => this.head.rotation.x = 0, 200);
        this.chest.material.color.setHex(0xffffff); setTimeout(() => this.chest.material.color.set(this.skinColor), 100);
    }
}

// --- 6. ONLINE MANTIK ---
function updateStatus(msg, color="white") { const el = document.getElementById('status-text'); if(el) { el.innerText = msg; el.style.color = color; } }
function initPeer() {
    updateStatus("BAĞLANIYOR...");
    peer = new Peer(null, { debug: 1, secure: true, sameSite: 'none' });
    peer.on('open', (id) => { document.getElementById('my-id').innerText = id; updateStatus("HAZIR", "#00e5ff"); });
    peer.on('connection', (c) => { conn = c; IS_HOST = true; setupConn(); });
    peer.on('error', () => updateStatus("HATA", "red"));
}
window.joinGame = function() {
    const id = document.getElementById('friend-id').value.trim(); if(!id) return alert("ID GİR!");
    conn = peer.connect(id); IS_HOST = false; setupConn();
}
function setupConn() {
    updateStatus("BAĞLANIYOR...", "yellow");
    conn.on('open', () => {
        updateStatus("BAĞLANDI!", "#00ff00");
        conn.on('data', (d) => {
            if (d.type === 'START') { VS_AI=false; IS_ONLINE=true; startGame(); }
            else if (d.type === 'input') { handleInput(IS_HOST ? p2 : p1, d.key, d.isDown); }
        });
        if(IS_HOST) { setTimeout(() => { conn.send({type:'START'}); VS_AI=false; IS_ONLINE=true; startGame(); }, 1000); }
    });
}
function sendData(d) { if(IS_ONLINE && conn && conn.open) conn.send(d); }
window.copyId = function() { navigator.clipboard.writeText(document.getElementById('my-id').innerText); alert("Kopyalandı!"); }

// --- 7. KONTROLLER ---
function handleInput(pl, key, down) {
    if(down) {
        if(key==='left') pl.velocity.x = -pl.speed; if(key==='right') pl.velocity.x = pl.speed;
        if(key==='jump') pl.jump(); if(key==='block') pl.isBlocking = true;
        if(key==='attack') pl.attack(); if(key==='ulti') pl.attack(true);
    } else {
        if(key==='left' || key==='right') pl.velocity.x = 0; if(key==='block') pl.isBlocking = false;
    }
}

window.addEventListener('keydown', e => {
    if(!gameActive) return;
    let act = null;
    // YÖN TUŞLARI + A, S, D
    if(e.key==='ArrowRight') act='right'; if(e.key==='ArrowLeft') act='left'; if(e.key==='ArrowUp') act='jump';
    if(e.key==='a' || e.key==='A') {
        // Ulti: 'A' tuşu
        const me = (IS_ONLINE && !IS_HOST) ? p2 : p1;
        if(me.ulti >= 100) act='ulti';
    }
    if(e.key==='d' || e.key==='D') act='attack'; // Yumruk: 'D'
    if(e.key==='s' || e.key==='S') act='block';  // Blok: 'S'

    if(act) {
        if(IS_ONLINE) {
            const me = IS_HOST ? p1 : p2; handleInput(me, act, true); sendData({type:'input', key:act, isDown:true});
        } else { handleInput(p1, act, true); }
    }
});

window.addEventListener('keyup', e => {
    let act = null;
    if(e.key==='ArrowRight') act='right'; if(e.key==='ArrowLeft') act='left';
    if(e.key==='s' || e.key==='S') act='block';
    if(act) {
        if(IS_ONLINE) {
            const me = IS_HOST ? p1 : p2; handleInput(me, act, false); sendData({type:'input', key:act, isDown:false});
        } else { handleInput(p1, act, false); }
    }
});

// --- 8. OYUN DÖNGÜSÜ ---
function startRound() {
    if(p1) scene.remove(p1.mesh); if(p2) scene.remove(p2.mesh);
    p1 = new Boxer(0xd32f2f, -4, true); p2 = new Boxer(0x1976d2, 4, false);
    gameActive = true; document.getElementById('msg-overlay').style.display = 'none'; updateHUD();
}
function updateHUD() {
    if(!p1 || !p2) return;
    document.getElementById('p1-hp').style.width = Math.max(0, p1.hp) + '%'; document.getElementById('p2-hp').style.width = Math.max(0, p2.hp) + '%';
    document.getElementById('p1-stamina').style.width = p1.stamina + '%'; document.getElementById('p2-stamina').style.width = p2.stamina + '%';
    const u1 = document.getElementById('p1-ulti'), u2 = document.getElementById('p2-ulti');
    u1.style.width = p1.ulti + '%'; u2.style.width = p2.ulti + '%';
    p1.ulti>=100 ? u1.parentElement.classList.add('ulti-ready') : u1.parentElement.classList.remove('ulti-ready');
    p2.ulti>=100 ? u2.parentElement.classList.add('ulti-ready') : u2.parentElement.classList.remove('ulti-ready');
}
function updateAI() {
    if (!VS_AI || p2.dead || !gameActive || IS_ONLINE) return;
    const dist = Math.abs(p1.mesh.position.x - p2.mesh.position.x);
    p2.velocity.x = 0; let rate = AI_DIFFICULTY==='hard' ? 0.06 : 0.03;
    if(dist>2.5) p2.velocity.x = p2.speed * (p1.mesh.position.x>p2.mesh.position.x?1:-1);
    if(dist<3.5 && Math.random()<rate) p2.attack();
    if(p2.ulti>=100 && dist<4 && Math.random()<0.1) p2.attack(true);
    p2.isBlocking = (p1.isAttacking && Math.random()<0.4);
}
function createParticles(x, y, color) {
    for (let i=0; i<8; i++) {
        const m=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.2,0.2), new THREE.MeshBasicMaterial({color:color}));
        m.position.set(x,y,0); scene.add(m); particles.push({mesh:m, vel:{x:(Math.random()-0.5), y:Math.random(), z:(Math.random()-0.5)}, life:1});
    }
}
function animate() {
    requestAnimationFrame(animate);
    const time = Date.now() * 0.001;
    if (gameActive && p1 && p2) {
        if(VS_AI && !IS_ONLINE) updateAI();
        p1.update(-0.02, time); p2.update(-0.02, time);
        
        // İçinden geçmeme (Collision)
        if (!p1.dead && !p2.dead) {
            const dx = p1.mesh.position.x - p2.mesh.position.x;
            if (Math.abs(dx) < 1.5 && Math.abs(p1.mesh.position.y - p2.mesh.position.y) < 2.0) {
                const push = (1.5 - Math.abs(dx)) / 2 * (dx > 0 ? 1 : -1);
                p1.mesh.position.x += push; p2.mesh.position.x -= push;
            }
        }

        if(p1.isAttacking && !p1.hasHit) { 
            const dist = Math.abs(p1.mesh.position.x - p2.mesh.position.x);
            if(dist < (p1.isUltiActive?5:3.5) && ((p1.facing===1 && p2.mesh.position.x>p1.mesh.position.x) || (p1.facing===-1 && p2.mesh.position.x<p1.mesh.position.x))) {
                p2.takeHit(p1.mesh.position.x, p1.isUltiActive); if(p2.hp<=0 && !p2.dead) { p2.dead=true; p2.mesh.rotation.x=-Math.PI/2; endRound(p2); }
            }
            p1.hasHit=true; setTimeout(()=>p1.hasHit=false, 200); 
        }
        if(p2.isAttacking && !p2.hasHit) { 
            const dist = Math.abs(p2.mesh.position.x - p1.mesh.position.x);
            if(dist < (p2.isUltiActive?5:3.5) && ((p2.facing===1 && p1.mesh.position.x>p2.mesh.position.x) || (p2.facing===-1 && p1.mesh.position.x<p2.mesh.position.x))) {
                p1.takeHit(p2.mesh.position.x, p2.isUltiActive); if(p1.hp<=0 && !p1.dead) { p1.dead=true; p1.mesh.rotation.x=-Math.PI/2; endRound(p1); }
            }
            p2.hasHit=true; setTimeout(()=>p2.hasHit=false, 200); 
        }
    }
    if(screenShake>0) {
        camera.position.x = originalCamPos.x + (Math.random()-0.5)*screenShake; camera.position.y = originalCamPos.y + (Math.random()-0.5)*screenShake; screenShake *= 0.9;
    } else if(p1 && p2) {
        camera.position.x += ((p1.mesh.position.x+p2.mesh.position.x)/2 - camera.position.x)*0.05;
    }
    particles.forEach((p,i)=>{ p.life-=0.05; p.mesh.position.add(p.vel); p.mesh.scale.setScalar(p.life); if(p.life<=0){scene.remove(p.mesh); particles.splice(i,1);} });
    renderer.render(scene, camera); updateHUD();
}
animate();
window.addEventListener('resize', () => { camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
