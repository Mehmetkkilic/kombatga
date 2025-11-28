function startGame() {
   goFullscreen();  // ekledik
   document.getElementById('main-menu').style.display = 'none';
   document.getElementById('game-hud').style.display = 'block';
   ...
}
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

// --- BAĞLANTI DEĞİŞKENLERİ ---
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

// --- MENÜ YÖNETİMİ (DÜZELTİLDİ) ---
// Bu fonksiyonlar HTML butonları tarafından çağrılır
window.startLocalGame = function(difficulty) {
    VS_AI = true;
    IS_ONLINE = false;
    AI_DIFFICULTY = difficulty;
    
    // P2 ismini güncelle
    const p2Name = document.getElementById('p2-name');
    if(p2Name) p2Name.innerText = "BOT (" + difficulty.toUpperCase() + ")";
    
    startGame();
}

window.showOnlineMenu = function() {
    document.getElementById('menu-buttons').style.display = 'none';
    document.getElementById('online-lobby').style.display = 'block';
    if(!peer) initPeer();
}

window.hideOnlineMenu = function() {
    document.getElementById('online-lobby').style.display = 'none';
    document.getElementById('menu-buttons').style.display = 'block';
}

window.startGame = function() {
    // Menüyü gizle
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('game-hud').style.display = 'block';

    // Sesi başlatmaya çalış (Hata verirse oyunu durdurmasın)
    try { SoundManager.init(); } catch (e) {}
    
    // Oyunu başlat
    startRound();
};

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

// --- GELİŞMİŞ KARAKTER SINIFI (EKLEMLİ) ---
class Boxer {
    constructor(color, xPos, isFacingRight) {
        this.color = color;
        this.skinColor = 0xffccaa; // Ten Rengi
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
        
        // --- İSKELET YAPISI ---
        this.mesh = new THREE.Group();
        this.mesh.position.set(xPos, 0, 0);
        this.mesh.scale.set(1.2, 1.2, 1.2);

        // 1. GÖVDE (TORSO)
        const chestGeo = new THREE.BoxGeometry(1.0, 1.0, 0.6);
        const chestMat = new THREE.MeshStandardMaterial({ color: this.skinColor });
        this.chest = new THREE.Mesh(chestGeo, chestMat);
        this.chest.position.y = 2.3;
        this.chest.castShadow = true;
        this.mesh.add(this.chest);

        // Karın (Şort Rengi)
        const absGeo = new THREE.BoxGeometry(0.9, 0.8, 0.55);
        const absMat = new THREE.MeshStandardMaterial({ color: color });
        this.abs = new THREE.Mesh(absGeo, absMat);
        this.abs.position.y = -0.9;
        this.chest.add(this.abs);

        // 2. KAFA
        const headGeo = new THREE.BoxGeometry(0.5, 0.6, 0.55);
        const headMat = new THREE.MeshStandardMaterial({ color: this.skinColor });
        this.head = new THREE.Mesh(headGeo, headMat);
        this.head.position.y = 0.8;
        this.chest.add(this.head);

        const eyeGeo = new THREE.BoxGeometry(0.1, 0.05, 0.05);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const eye1 = new THREE.Mesh(eyeGeo, eyeMat); eye1.position.set(0.15, 0.1, 0.28);
        const eye2 = new THREE.Mesh(eyeGeo, eyeMat); eye2.position.set(-0.15, 0.1, 0.28);
        this.head.add(eye1); this.head.add(eye2);

        // 3. KOLLAR
        this.leftArm = this.createArm(true);
        this.leftArm.position.set(0.65, 0.3, 0);
        this.chest.add(this.leftArm);

        this.rightArm = this.createArm(false);
        this.rightArm.position.set(-0.65, 0.3, 0);
        this.chest.add(this.rightArm);

        // 4. BACAKLAR
        this.leftLeg = this.createLeg(true);
        this.leftLeg.position.set(0.3, -1.4, 0);
        this.abs.add(this.leftLeg);

        this.rightLeg = this.createLeg(false);
        this.rightLeg.position.set(-0.3, -1.4, 0);
        this.abs.add(this.rightLeg);

        // EFEKTLER
        this.shield = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.0, 32), new THREE.MeshBasicMaterial({ color: 0xffff00, side: THREE.DoubleSide, transparent: true, opacity: 0 }));
        this.shield.position.set(0, 0, 1);
        this.chest.add(this.shield);

        const auraGeo = new THREE.CylinderGeometry(1, 1, 4, 16, 1, true);
        const auraMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0, side: THREE.DoubleSide });
        this.aura = new THREE.Mesh(auraGeo, auraMat);
        this.mesh.add(this.aura);

        scene.add(this.mesh);
    }

    createArm(isLeft) {
        const shoulder = new THREE.Group();
        
        const upperGeo = new THREE.CylinderGeometry(0.18, 0.16, 0.7);
        const limbMat = new THREE.MeshStandardMaterial({ color: this.skinColor });
        const upper = new THREE.Mesh(upperGeo, limbMat);
        upper.position.y = -0.35; 
        shoulder.add(upper);

        const elbow = new THREE.Group();
        elbow.position.y = -0.35;
        upper.add(elbow);

        const lowerGeo = new THREE.CylinderGeometry(0.15, 0.12, 0.6);
        const lower = new THREE.Mesh(lowerGeo, limbMat);
        lower.position.y = -0.3;
        elbow.add(lower);

        const gloveGeo = new THREE.BoxGeometry(0.35, 0.35, 0.4);
        const gloveMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const glove = new THREE.Mesh(gloveGeo, gloveMat);
        glove.position.y = -0.4;
        lower.add(glove);

        shoulder.elbow = elbow;
        shoulder.glove = glove;
        return shoulder;
    }

    createLeg(isLeft) {
        const hip = new THREE.Group();

        const thighGeo = new THREE.CylinderGeometry(0.22, 0.18, 0.8);
        const thighMat = new THREE.MeshStandardMaterial({ color: this.color });
        const thigh = new THREE.Mesh(thighGeo, thighMat);
        thigh.position.y = -0.4;
        hip.add(thigh);

        const knee = new THREE.Group();
        knee.position.y = -0.4;
        thigh.add(knee);

        const shinGeo = new THREE.CylinderGeometry(0.18, 0.15, 0.8);
        const skinMat = new THREE.MeshStandardMaterial({ color: this.skinColor });
        const shin = new THREE.Mesh(shinGeo, skinMat);
        shin.position.y = -0.4;
        knee.add(shin);

        const footGeo = new THREE.BoxGeometry(0.25, 0.15, 0.4);
        const footMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const foot = new THREE.Mesh(footGeo, footMat);
        foot.position.set(0, -0.45, 0.1);
        shin.add(foot);

        hip.knee = knee;
        return hip;
    }

    update(gravity, time) {
        if(this.dead) return;
        
        if(this.stamina < 100 && !this.isAttacking && !this.isBlocking) this.stamina += 0.2; 
        const isTired = this.stamina <= 10;
        this.speed = isTired || this.isBlocking ? 0.05 : 0.12;
        this.shield.material.opacity = this.isBlocking ? 0.6 : 0;
        
        // ANİMASYONLAR
        let targetLeftArmRot = { x: 0, z: 0 };
        let targetRightArmRot = { x: 0, z: 0 };
        let targetLeftElbow = -2.5;
        let targetRightElbow = -2.5;

        if (this.isBlocking) {
            targetLeftArmRot = { x: -0.5, z: 0.5 };
            targetRightArmRot = { x: -0.5, z: -0.5 };
        } else if (!this.isAttacking) {
            const breath = Math.sin(time * 5) * 0.1;
            targetLeftArmRot = { x: 0.5 + breath, z: 0.2 };
            targetRightArmRot = { x: 0.5 + breath, z: -0.2 };
            targetLeftElbow = -2.0;
            targetRightElbow = -2.0;
        }

        if (Math.abs(this.velocity.x) > 0.01 && this.isGrounded) {
            const walkSpeed = 15;
            this.leftLeg.rotation.x = Math.sin(time * walkSpeed) * 0.8;
            this.rightLeg.rotation.x = Math.cos(time * walkSpeed) * 0.8;
            this.leftLeg.knee.rotation.x = Math.abs(Math.sin(time * walkSpeed)) * 1.5;
            this.rightLeg.knee.rotation.x = Math.abs(Math.cos(time * walkSpeed)) * 1.5;
            targetLeftArmRot.x += Math.cos(time * walkSpeed) * 0.3;
            targetRightArmRot.x += Math.sin(time * walkSpeed) * 0.3;
        } else {
            this.leftLeg.rotation.x = 0;
            this.rightLeg.rotation.x = 0;
            this.leftLeg.knee.rotation.x = 0;
            this.rightLeg.knee.rotation.x = 0;
        }

        if(!this.isAttacking) {
            this.leftArm.rotation.x += (targetLeftArmRot.x - this.leftArm.rotation.x) * 0.1;
            this.leftArm.rotation.z += (targetLeftArmRot.z - this.leftArm.rotation.z) * 0.1;
            this.leftArm.elbow.rotation.x += (targetLeftElbow - this.leftArm.elbow.rotation.x) * 0.1;
            this.rightArm.rotation.x += (targetRightArmRot.x - this.rightArm.rotation.x) * 0.1;
            this.rightArm.rotation.z += (targetRightArmRot.z - this.rightArm.rotation.z) * 0.1;
            this.rightArm.elbow.rotation.x += (targetRightElbow - this.rightArm.elbow.rotation.x) * 0.1;
        }

        this.aura.material.opacity = this.ulti >= 100 ? 0.4 : 0;
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

        const useRight = Math.random() > 0.5;
        const activeArm = useRight ? this.rightArm : this.leftArm;
        
        if (isUlti) {
            this.ulti = 0; SoundManager.ulti();
            activeArm.glove.scale.set(3,3,3); 
            activeArm.glove.material.color.setHex(0x00ffff);
            activeArm.rotation.x = -1.5;
            activeArm.elbow.rotation.x = 0; 
            setTimeout(() => {
                activeArm.glove.scale.set(1,1,1); 
                activeArm.glove.material.color.setHex(0xffffff);
                this.isAttacking = false;
            }, 400);
        } else {
            SoundManager.swing();
            activeArm.rotation.x = -1.5;
            activeArm.elbow.rotation.x = -0.2; 
            this.chest.rotation.y = useRight ? -0.5 : 0.5;
            setTimeout(() => {
                this.isAttacking = false;
                this.chest.rotation.y = 0;
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
        
        this.head.rotation.x = -0.5;
        setTimeout(() => this.head.rotation.x = 0, 200);
        this.chest.material.color.setHex(0xffffff);
        setTimeout(() => this.chest.material.color.set(this.skinColor), 100);
    }
}

// --- OYUN DÖNGÜSÜ & KONTROLLER ---
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

// --- KONTROLLER (Ortak) ---
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

// Klavye Dinleyicileri
window.addEventListener('keydown', e => {
    if(!gameActive) return;
    let myAction = null;
    if(e.key==='ArrowRight') myAction = 'right';
    if(e.key==='ArrowLeft') myAction = 'left';
    if(e.key==='ArrowUp') myAction = 'jump';
    if(e.key==='a' || e.key==='A') myAction = 'attack';
    if(e.key==='s' || e.key==='S') myAction = 'block';
    if(e.key==='d' || e.key==='D') {
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

// --- MOBİL DOKUNMATİK ---
function setupMobileControls() {
    const buttons = [
        { id: 'btn-left', action: 'left' }, { id: 'btn-right', action: 'right' }, { id: 'btn-jump', action: 'jump' },
        { id: 'btn-atk', action: 'attack' }, { id: 'btn-block', action: 'block' }, { id: 'btn-ulti', action: 'ulti' }
    ];
    buttons.forEach(btn => {
        const el = document.getElementById(btn.id);
        if(!el) return;
        el.addEventListener('touchstart', (e) => { e.preventDefault(); triggerGameInput(btn.action, true); }, { passive: false });
        el.addEventListener('touchend', (e) => { e.preventDefault(); triggerGameInput(btn.action, false); }, { passive: false });
    });
}
function triggerGameInput(action, isDown) {
    if(!gameActive) return;
    if(IS_ONLINE) {
        const myPlayer = IS_HOST ? p1 : p2;
        if(action === 'ulti' && myPlayer.ulti < 100) return;
        handleInput(myPlayer, action, isDown);
        sendData({ type: 'input', key: action, isDown: isDown });
    } else {
        if(action === 'ulti' && p1.ulti < 100) return;
        handleInput(p1, action, isDown);
    }
}
setupMobileControls();

// --- YAPAY ZEKA ---
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

// --- ONLINE MANTIK (PEERJS) ---
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
window.joinGame = function() {
    const friendId = document.getElementById('friend-id').value;
    if(!friendId) return alert("Lütfen bir ID gir!");
    conn = peer.connect(friendId);
    IS_HOST = false;
    setupConnection();
}
function setupConnection() {
    document.getElementById('status-text').innerText = "BAĞLANDI! OYUN BAŞLIYOR...";
    document.getElementById('status-text').style.color = "#00ff00";
    
    conn.on('open', () => {
        conn.on('data', (data) => {
            if(data.type === 'input') {
                const targetPlayer = IS_HOST ? p2 : p1; 
                handleInput(targetPlayer, data.key, data.isDown);
            }
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
    if(IS_ONLINE && conn && conn.open) { conn.send(data); }
}
window.copyId = function() {
    const idText = document.getElementById('my-id').innerText;
    navigator.clipboard.writeText(idText);
    alert("ID Kopyalandı!");
}

// --- OYUN DÖNGÜSÜ ---
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
