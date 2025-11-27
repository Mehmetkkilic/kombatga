// --- GLOBAL DEĞİŞKENLER ---
let VS_AI = true;
let IS_ONLINE = false;
let IS_HOST = false;
let AI_DIFFICULTY = 'normal';
const WIN_SCORE = 3;
let gameActive = false;
let p1, p2; // Oyuncular
let particles = [];
let screenShake = 0;
let round = 1;
let scores = { p1: 0, p2: 0 };
// --- SES MOTORU ---
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
       const bSize = audioCtx.sampleRate * duration; const b = audioCtx.createBuffer(1, bSize, audioCtx.sampleRate);
       const d = b.getChannelData(0); for(let i=0; i<bSize; i++) d[i] = Math.random() * 2 - 1;
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
// --- KARAKTER SINIFI (ANATOMİK) ---
class Boxer {
   constructor(color, xPos, isFacingRight) {
       this.color = color;
       this.skinColor = 0xffccaa;
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
       this.mesh = new THREE.Group();
       this.mesh.position.set(xPos, 0, 0);
       this.mesh.scale.set(1.2, 1.2, 1.2);
       // Gövde Parçaları
       const chestGeo = new THREE.BoxGeometry(1.0, 1.0, 0.6);
       const chestMat = new THREE.MeshStandardMaterial({ color: this.skinColor });
       this.chest = new THREE.Mesh(chestGeo, chestMat);
       this.chest.position.y = 2.3; this.chest.castShadow = true;
       this.mesh.add(this.chest);
       const absGeo = new THREE.BoxGeometry(0.9, 0.8, 0.55);
       const absMat = new THREE.MeshStandardMaterial({ color: color });
       this.abs = new THREE.Mesh(absGeo, absMat);
       this.abs.position.y = -0.9; this.chest.add(this.abs);
       const headGeo = new THREE.BoxGeometry(0.5, 0.6, 0.55);
       const headMat = new THREE.MeshStandardMaterial({ color: this.skinColor });
       this.head = new THREE.Mesh(headGeo, headMat);
       this.head.position.y = 0.8; this.chest.add(this.head);
       const eyeGeo = new THREE.BoxGeometry(0.1, 0.05, 0.05);
       const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
       const eye1 = new THREE.Mesh(eyeGeo, eyeMat); eye1.position.set(0.15, 0.1, 0.28);
       const eye2 = new THREE.Mesh(eyeGeo, eyeMat); eye2.position.set(-0.15, 0.1, 0.28);
       this.head.add(eye1); this.head.add(eye2);
       this.leftArm = this.createArm(); this.leftArm.position.set(0.65, 0.3, 0); this.chest.add(this.leftArm);
       this.rightArm = this.createArm(); this.rightArm.position.set(-0.65, 0.3, 0); this.chest.add(this.rightArm);
       this.leftLeg = this.createLeg(); this.leftLeg.position.set(0.3, -1.4, 0); this.abs.add(this.leftLeg);
       this.rightLeg = this.createLeg(); this.rightLeg.position.set(-0.3, -1.4, 0); this.abs.add(this.rightLeg);
       this.shield = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.0, 32), new THREE.MeshBasicMaterial({ color: 0xffff00, side: THREE.DoubleSide, transparent: true, opacity: 0 }));
       this.shield.position.set(0, 0, 1); this.chest.add(this.shield);
       const auraGeo = new THREE.CylinderGeometry(1, 1, 4, 16, 1, true);
       const auraMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0, side: THREE.DoubleSide });
       this.aura = new THREE.Mesh(auraGeo, auraMat);
       this.mesh.add(this.aura);
       scene.add(this.mesh);
   }
   createArm() {
       const shoulder = new THREE.Group();
       const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.7), new THREE.MeshStandardMaterial({ color: this.skinColor }));
       upper.position.y = -0.35; shoulder.add(upper);
       const elbow = new THREE.Group(); elbow.position.y = -0.35; upper.add(elbow);
       const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.6), new THREE.MeshStandardMaterial({ color: this.skinColor }));
       lower.position.y = -0.3; elbow.add(lower);
       const glove = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.4), new THREE.MeshStandardMaterial({ color: 0xffffff }));
       glove.position.y = -0.4; lower.add(glove);
       shoulder.elbow = elbow; shoulder.glove = glove;
       return shoulder;
   }
   createLeg() {
       const hip = new THREE.Group();
       const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.8), new THREE.MeshStandardMaterial({ color: this.color }));
       thigh.position.y = -0.4; hip.add(thigh);
       const knee = new THREE.Group(); knee.position.y = -0.4; thigh.add(knee);
       const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.8), new THREE.MeshStandardMaterial({ color: this.skinColor }));
       shin.position.y = -0.4; knee.add(shin);
       const foot = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.4), new THREE.MeshStandardMaterial({ color: 0x111111 }));
       foot.position.set(0, -0.45, 0.1); shin.add(foot);
       hip.knee = knee;
       return hip;
   }
   update(gravity, time) {
       if(this.dead) return;
       if(this.stamina < 100 && !this.isAttacking && !this.isBlocking) this.stamina += 0.2;
       const isTired = this.stamina <= 10;
       this.speed = isTired || this.isBlocking ? 0.05 : 0.12;
       this.shield.material.opacity = this.isBlocking ? 0.6 : 0;
       let targetLeftArmRot = { x: 0, z: 0 };
       let targetRightArmRot = { x: 0, z: 0 };
       let targetLeftElbow = -2.5; let targetRightElbow = -2.5;
       if (this.isBlocking) {
           targetLeftArmRot = { x: -0.5, z: 0.5 }; targetRightArmRot = { x: -0.5, z: -0.5 };
       } else if (!this.isAttacking) {
           const breath = Math.sin(time * 5) * 0.1;
           targetLeftArmRot = { x: 0.5 + breath, z: 0.2 }; targetRightArmRot = { x: 0.5 + breath, z: -0.2 };
           targetLeftElbow = -2.0; targetRightElbow = -2.0;
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
           this.leftLeg.rotation.x = 0; this.rightLeg.rotation.x = 0;
           this.leftLeg.knee.rotation.x = 0; this.rightLeg.knee.rotation.x = 0;
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
           activeArm.glove.scale.set(3,3,3); activeArm.glove.material.color.setHex(0x00ffff);
           activeArm.rotation.x = -1.5; activeArm.elbow.rotation.x = 0;
           setTimeout(() => {
               activeArm.glove.scale.set(1,1,1); activeArm.glove.material.color.setHex(0xffffff);
               this.isAttacking = false;
           }, 400);
       } else {
           SoundManager.swing();
           activeArm.rotation.x = -1.5; activeArm.elbow.rotation.x = -0.2;
           this.chest.rotation.y = useRight ? -0.5 : 0.5;
           setTimeout(() => {
               this.isAttacking = false; this.chest.rotation.y = 0;
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
       const push = attackerX < this.mesh.position.x ? 1 : -1;
       this.velocity.x = push * (isUltiHit ? 1.0 : 0.2);
       this.velocity.y = isUltiHit ? 0.5 : 0.2;
       this.head.rotation.x = -0.5; setTimeout(() => this.head.rotation.x = 0, 200);
       this.chest.material.color.setHex(0xffffff); setTimeout(() => this.chest.material.color.set(this.skinColor), 100);
   }
}