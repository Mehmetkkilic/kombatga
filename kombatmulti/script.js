// --- GLOBAL DEĞİŞKENLER ---
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

// --- ONLINE BAĞLANTI DEĞİŞKENLERİ ---
let peer = null;
let conn = null;

// --- SES MOTORU ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();
const SoundManager = {
    init: () => { if (audioCtx.state === 'suspended') audioCtx.resume(); },
    playTone: (freq, type, duration, vol = 0.1) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type; osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + duration);
    },
    playNoise: (duration) => {
        const bSize = audioCtx.sampleRate * duration;
        const b = audioCtx.createBuffer(1, bSize, audioCtx.sampleRate);
        const d = b.getChannelData(0);
        for(let i=0; i<bSize; i++) d[i] = Math.random() * 2 - 1;
        const n = audioCtx.createBufferSource(); n.buffer = b;
        const g = audioCtx.createGain(); g.gain.setValueAtTime(0.3, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        n.connect(g); g.connect(audioCtx.destination); n.start();
    },
    jump: () => SoundManager.playTone(200, 'sine', 0.2),
    swing: () => SoundManager.playTone(100, 'triangle', 0.1),
    hit: () => { SoundManager.playTone(80, 'square', 0.1, 0.2); SoundManager.playNoise(0.15); },
    block: () => SoundManager.playTone(600, 'sawtooth', 0.1),
    ulti: () => { SoundManager.playTone(50, 'sawtooth', 0.5, 0.3); SoundManager.playNoise(0.5); }
};

// --- MENÜ YÖNETİMİ ---
function startLocalGame(difficulty) {
    VS_AI = true;
    IS_ONLINE = false;
    AI_DIFFICULTY = difficulty;
    document.getElementById('p2-name').innerText = "BOT (" + difficulty.toUpperCase() + ")";
    startGame();
}

function showOnlineMenu() {
    document.getElementById('menu-buttons').style.display = 'none';
    document.getElementById('online-lobby').style.display = 'block';
    if(!peer) initPeer();
}

function hideOnlineMenu() {
    document.getElementById('online-lobby').style.display = 'none';
    document.getElementById('menu-buttons').style.display = 'block';
}

function startGame() {
    // MENÜYÜ ZORLA GİZLE
    const menu = document.getElementById('main-menu');
    const hud = document.getElementById('game-hud');
    
    if(menu) menu.style.display = 'none'; 
    if(hud) hud.style.display = 'block';  
    
    try{SoundManager.init();}catch(e){}
    startRound();
}

// --- ONLINE MANTIK ---
function initPeer() {
    peer = new Peer(); 
    peer.on('open', (id) => {
        document.getElementById('my-id').innerText = id;
        document.getElementById('status-text').innerText = "HAZIR (ID BEKLENİYOR)";
    });
    peer.on('connection', (connection) => {
        conn = connection;
        IS_HOST = true;
        setupConnection();
    });
}

function joinGame() {
    const friendId = document.getElementById('friend-id').value;
    if(!friendId) return alert("Lütfen bir ID gir!");
    conn = peer.connect(friendId);
    IS_HOST = false;
    setupConnection();
}

function setupConnection() {
    const statusText = document.getElementById('status-text');
    statusText.innerText = "BAĞLANDI! OYUN BAŞLIYOR...";
    statusText.style.color = "#00ff00";
    
    conn.on('open', () => {
        conn.on('data', (data) => {
            handleNetworkData(data);
        });
        setTimeout(() => {
            VS_AI = false;
            IS_ONLINE = true;
            document.getElementById('p1-name').innerText = IS_HOST ? "SEN (HOST)" : "RAKİP";
            document.getElementById('p2-name').innerText = IS_HOST ? "RAKİP" : "SEN (CLIENT)";
            startGame();
        }, 1000);
    });
}

function sendData(data) {
    if(IS_ONLINE && conn && conn.open) {
        conn.send(data);
    }
}

function handleNetworkData(data) {
    if(data.type === 'input') {
        const targetPlayer = IS_HOST ? p2 : p1; 
        handleInput(targetPlayer, data.key, data.isDown);
    }
}

function copyId() {
    const idText = document.getElementById('my-id').innerText;
    navigator.clipboard.writeText(idText);
    alert("ID Kopyalandı!");
}

// --- THREE.JS SAHNE ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 22);
const originalCamPos = { x: 0, y: 5, z: 22 };

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
scene.add(dirLight);

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

// --- OYUNCU SINIFI ---
class Boxer {
    constructor(color, xPos, isFacingRight) {
        this.color = color;
        this.hp = 100;
        this.stamina = 100;
        this.ulti = 0;
        this.dead = false;
        this.velocity = { x: 0, y: 0 };
        this.isGrounded = false;
        this.speed = 0.12; 
        this.jumpPower = 0.35;
        this.facing = isFacingRight ? 1 : -1;
        this.isAttacking = false;
        this.isBlocking = false;
        this.isUltiActive = false;

        this.mesh = new THREE.Group();
        this.mesh.position.set(xPos, 0, 0);
        this.mesh.scale.set(1.3, 1.3, 1.3);

        const legGeo = new THREE.BoxGeometry(0.4, 1.1, 0.5);
        const legMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        this.leftLeg = new THREE.Mesh(legGeo, legMat); this.leftLeg.position.set(0.25, 0.55, 0); this.mesh.add(this.leftLeg);
        this.rightLeg = new THREE.Mesh(legGeo, legMat); this.rightLeg.position.set(-0.25, 0.55, 0); this.mesh.add(this.rightLeg);
        const bodyGeo = new THREE.BoxGeometry(1.1, 1.4, 0.7);
        const bodyMat = new THREE.MeshStandardMaterial({ color: color });
        this.body = new THREE.Mesh(bodyGeo, bodyMat); this.body.position.y = 1.6; this.body.castShadow = true; this.mesh.add(this.body);
        const headGeo = new THREE.BoxGeometry(0.5, 0.6, 0.5);
        const headMat = new THREE.MeshStandardMaterial({ color: 0xffccaa });
        this.head = new THREE.Mesh(headGeo, headMat); this.head.position.set(0, 2.6, 0); this.mesh.add(this.head);
        const gloveGeo = new THREE.SphereGeometry(0.45, 16, 16);
        const gloveMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        this.leftGlove = new THREE.Mesh(gloveGeo, gloveMat); this.leftGlove.position.set(0.4, 2.0, 0.7); this.mesh.add(this.leftGlove);
        this.rightGlove = new THREE.Mesh(gloveGeo, gloveMat); this.rightGlove.position.set(-0.4, 2.0, 0.7); this.mesh.add(this.rightGlove);
        this.shield = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.0, 32), new THREE.MeshBasicMaterial({ color: 0xffff00, side: THREE.DoubleSide, transparent: true, opacity: 0 }));
        this.shield.position.set(0, 2.0, 1); this.mesh.add(this.shield);
        this.aura = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3, 1.5), new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true, transparent: true, opacity: 0 }));
        this.aura.position.y = 1.5; this.mesh.add(this.aura);
        scene.add(this.mesh);
    }

    update(gravity, time) {
        if(this.dead) return;
        if(this.stamina < 100 && !this.isAttacking && !this.isBlocking) this.stamina += 0.2; 
        const isTired = this.stamina <= 10;
        this.speed = isTired || this.isBlocking ? 0.05 : 0.12;
        this.shield.material.opacity = this.isBlocking ? 0.6 : 0;
        
        if (Math.abs(this.velocity.x) > 0.01 && this.isGrounded) {
            this.leftLeg.rotation.x = Math.sin(time * 15) * 0.5;
            this.rightLeg.rotation.x = Math.cos(time * 15) * 0.5;
        } else {
            this.leftLeg.rotation.x = 0; this.rightLeg.rotation.x = 0;
        }
        if (!this.isAttacking && !this.isBlocking) {
            const breath = Math.sin(time * 5) * 0.03;
            this.leftGlove.position.y = 2.0 + breath;
            this.rightGlove.position.y = 2.0 - breath;
        }
        this.aura.material.opacity = this.ulti >= 100 ? 0.3 : 0;
        this.aura.rotation.y += 0.1;
        this.mesh.position.y += this.velocity.y;
        this.mesh.position.x += this.velocity.x;
        if (this.mesh.position.y + this.velocity.y <= 0) {
            this.velocity.y = 0; this.mesh.position.y = 0; this.isGrounded = true;
        } else {
            this.velocity.y += gravity; this.isGrounded = false;
        }
        if (this.mesh.position.x < -8.5) this.mesh.position.x = -8.5;
        if (this.mesh.position.x > 8.5) this.mesh.position.x = 8.5;
        if (!this.isBlocking && !this.isAttacking && Math.abs(this.velocity.x) > 0) {
            this.facing = this.velocity.x > 0 ? 1 : -1;
        }
        this.mesh.rotation.y = (this.facing === 1 ? Math.PI / 2 : -Math.PI / 2);
    }
    jump() {
        if(this.isGrounded && this.stamina > 10) {
            this.velocity.y = this.jumpPower; this.stamina -= 10; SoundManager.jump();
        }
    }
    attack(isUlti = false) {
        if (this.isAttacking || this.isBlocking || this.dead) return;
        if (!isUlti && this.stamina < 15) return;
        
        this.isAttacking = true;
        if(!isUlti) this.stamina -= 15;
        
        const glove = Math.random()>0.5 ? this.rightGlove : this.leftGlove;
        if (isUlti) {
            // ULTİ KULLANILDI - SIFIRLA
            this.ulti = 0; 
            this.isUltiActive = true; 
            SoundManager.ulti();
            glove.scale.set(3,3,3); glove.material.color.setHex(0x00ffff); glove.position.z = 4.0;
            setTimeout(() => {
                glove.scale.set(1,1,1); glove.material.color.setHex(0xffffff); glove.position.z = 0.7;
                this.isAttacking = false; this.isUltiActive = false;
            }, 400);
        } else {
            SoundManager.swing();
            glove.position.z = 2.2; this.body.rotation.x = 0.2;
            setTimeout(() => {
                glove.position.z = 0.7; this.body.rotation.x = 0; this.isAttacking = false;
            }, 150);
        }
    }
    takeHit(attackerX, isUltiHit) {
        if (this.isBlocking && !isUltiHit) {
            const dir = attackerX < this.mesh.position.x ? -1 : 1;
            if ((dir===1 && this.facing===-1) || (dir===-1 && this.facing===1)) {
                SoundManager.block(); this.stamina -= 5; this.hp -= 1; this.ulti += 2; return;
            }
        }
        SoundManager.hit();
        const dmg = isUltiHit ? 35 : 10;
        this.hp -= dmg; this.ulti += 15;
        if(this.ulti > 100) this.ulti = 100;
        createParticles(this.mesh.position.x, 2, 0xcc0000);
        const push = attackerX < this.mesh.position.x ? 1 : -1;
        this.velocity.x = push * (isUltiHit ? 1.0 : 0.2);
        this.velocity.y = isUltiHit ? 0.5 : 0.2;
        this.body.material.color.setHex(0xffffff);
        setTimeout(() => this.body.material.color.set(this.color), 100);
    }
}

// --- YÖNETİM ---
function startRound() {
    if(p1) scene.remove(p1.mesh);
    if(p2) scene.remove(p2.mesh);
    p1 = new Boxer(0xd32f2f, -4, true);
    p2 = new Boxer(0x1976d2, 4, false);
    gameActive = true;
    document.getElementById('msg-overlay').style.display = 'none';
    updateHUD();
}
function endRound(loser) {
    gameActive = false;
    const msg = document.getElementById('msg-overlay');
    msg.style.display = 'block';
    if (loser === p1) scores.p2++; else scores.p1++;
    document.querySelector('.score-display').innerHTML = `<span class="p1-color">${scores.p1}</span> - <span class="p2-color">${scores.p2}</span>`;
    if (scores.p1 >= WIN_SCORE || scores.p2 >= WIN_SCORE) {
        msg.innerHTML = scores.p1 >= WIN_SCORE ? "<span style='color:red'>KIRMIZI</span><br>KAZANDI!" : "<span style='color:blue'>MAVİ</span><br>KAZANDI!";
        msg.style.fontSize = "70px";
    } else {
        msg.innerText = "K.O.";
        setTimeout(() => { round++; document.getElementById('round-num').innerText = round; msg.innerText = "ROUND " + round; setTimeout(startRound, 2000); }, 2000);
    }
}
function updateHUD() {
    if(!p1 || !p2) return;
    document.getElementById('p1-hp').style.width = Math.max(0, p1.hp) + '%';
    document.getElementById('p2-hp').style.width = Math.max(0, p2.hp) + '%';
    document.getElementById('p1-stamina').style.width = p1.stamina + '%';
    document.getElementById('p2-stamina').style.width = p2.stamina + '%';
    const u1 = document.getElementById('p1-ulti'); const u2 = document.getElementById('p2-ulti');
    u1.style.width = p1.ulti + '%'; u2.style.width = p2.ulti + '%';
    p1.ulti >= 100 ? u1.parentElement.classList.add('ulti-ready') : u1.parentElement.classList.remove('ulti-ready');
    p2.ulti >= 100 ? u2.parentElement.classList.add('ulti-ready') : u2.parentElement.classList.remove('ulti-ready');
}

function updateAI() {
    if (!VS_AI || p2.dead || !gameActive || IS_ONLINE) return;
    const dist = Math.abs(p1.mesh.position.x - p2.mesh.position.x);
    p2.velocity.x = 0;
    let attackRate = 0.01; let blockRate = 0.1;
    if (AI_DIFFICULTY === 'normal') { attackRate = 0.03; blockRate = 0.4; } 
    else if (AI_DIFFICULTY === 'hard') { attackRate = 0.06; blockRate = 0.8; }
    if (dist > 2.5) { const dir = p1.mesh.position.x > p2.mesh.position.x ? 1 : -1; p2.velocity.x = p2.speed * dir; } 
    else if (dist < 1.5) { const dir = p1.mesh.position.x > p2.mesh.position.x ? -1 : 1; p2.velocity.x = p2.speed * dir; }
    if (dist < 3.5 && Math.random() < attackRate) p2.attack();
    if (AI_DIFFICULTY !== 'easy' && p2.ulti >= 100 && dist < 4 && Math.random() < 0.1) p2.attack(true);
    if (p1.isAttacking && Math.random() < blockRate) p2.isBlocking = true; else if (!p1.isAttacking) p2.isBlocking = false;
}

// --- TUŞ KONTROLLERİ (Düzeltildi) ---
function handleInput(player, key, isDown) {
    if(isDown) {
        if(key==='left') player.velocity.x = -player.speed;
        if(key==='right') player.velocity.x = player.speed;
        if(key==='jump') player.jump();
        if(key==='block') player.isBlocking = true;
        if(key==='attack') player.attack();
        if(key==='ulti') player.attack(true);
    } else {
        if(key==='left' || key==='right') player.velocity.x = 0;
        if(key==='block') player.isBlocking = false;
    }
}

window.addEventListener('keydown', e => {
    if(!gameActive) return;
    let myAction = null;
    if(e.key==='ArrowRight') myAction = 'right';
    if(e.key==='ArrowLeft') myAction = 'left';
    if(e.key==='ArrowUp') myAction = 'jump';
    if(e.key==='a' || e.key==='A') myAction = 'attack';
    if(e.key==='s' || e.key==='S') myAction = 'block';
    if(e.key==='d' || e.key==='D') {
        // BURASI DEĞİŞTİ: Ulti için SIKI kontrol
        const myPlayer = (IS_ONLINE && !IS_HOST) ? p2 : p1;
        if(myPlayer.ulti >= 100) myAction = 'ulti';
    }

    if(myAction) {
        if(IS_ONLINE) {
            const myPlayer = IS_HOST ? p1 : p2;
            handleInput(myPlayer, myAction, true);
            sendData({ type: 'input', key: myAction, isDown: true });
        } else {
            handleInput(p1, myAction, true);
        }
    }
});

window.addEventListener('keyup', e => {
    let myAction = null;
    if(e.key==='ArrowRight') myAction = 'right';
    if(e.key==='ArrowLeft') myAction = 'left';
    if(e.key==='s' || e.key==='S') myAction = 'block';

    if(myAction) {
        if(IS_ONLINE) {
            const myPlayer = IS_HOST ? p1 : p2;
            handleInput(myPlayer, myAction, false);
            sendData({ type: 'input', key: myAction, isDown: false });
        } else {
            handleInput(p1, myAction, false);
        }
    }
});

function checkHit(atk, def) {
    const range = atk.isUltiActive ? 5.0 : 3.5;
    const dist = Math.abs(atk.mesh.position.x - def.mesh.position.x);
    const facing = (atk.facing === 1 && def.mesh.position.x > atk.mesh.position.x) ||
                   (atk.facing === -1 && def.mesh.position.x < atk.mesh.position.x);
    if (dist < range && facing) {
        def.takeHit(atk.mesh.position.x, atk.isUltiActive);
        if(def.hp <= 0 && !def.dead) {
            def.dead = true; def.mesh.rotation.x = -Math.PI/2; endRound(def);
        }
    }
}
function createParticles(x, y, color) {
    for (let i = 0; i < 10; i++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.2,0.2), new THREE.MeshBasicMaterial({color:color}));
        m.position.set(x,y,0); scene.add(m);
        particles.push({mesh:m, vel:{x:(Math.random()-0.5), y:Math.random(), z:(Math.random()-0.5)}, life:1});
    }
}
function animate() {
    requestAnimationFrame(animate);
    const time = Date.now() * 0.001;
    if (gameActive && p1 && p2) {
        if (VS_AI && !IS_ONLINE) updateAI();
        p1.update(-0.02, time); p2.update(-0.02, time);
        if(p1.isAttacking && !p1.hasHit) { checkHit(p1, p2); p1.hasHit=true; setTimeout(()=>p1.hasHit=false, 200); }
        if(p2.isAttacking && !p2.hasHit) { checkHit(p2, p1); p2.hasHit=true; setTimeout(()=>p2.hasHit=false, 200); }
    }
    if(screenShake>0) {
        camera.position.x = originalCamPos.x + (Math.random()-0.5)*screenShake;
        camera.position.y = originalCamPos.y + (Math.random()-0.5)*screenShake;
        screenShake *= 0.9;
    } else if(p1 && p2) {
        const mid = (p1.mesh.position.x + p2.mesh.position.x)/2;
        camera.position.x += (mid - camera.position.x)*0.05;
    }
    particles.forEach((p,i)=>{
        p.life-=0.05; p.mesh.position.add(p.vel); p.mesh.scale.setScalar(p.life);
        if(p.life<=0){ scene.remove(p.mesh); particles.splice(i,1); }
    });
    renderer.render(scene, camera);
    updateHUD();
}
animate();
window.addEventListener('resize', () => { camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });