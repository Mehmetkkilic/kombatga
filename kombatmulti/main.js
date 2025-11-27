// --- MENÜ YÖNETİMİ ---
window.startLocalGame = function(difficulty) {
   VS_AI = true; IS_ONLINE = false; AI_DIFFICULTY = difficulty;
   document.getElementById('p2-name-label').innerText = "BOT (" + difficulty.toUpperCase() + ")";
   startGame();
}
window.showOnlineMenu = function() {
   document.getElementById('menu-buttons').style.display = 'none';
   document.getElementById('online-lobby').style.display = 'block';
   if(window.initPeer) window.initPeer();
}
window.hideOnlineMenu = function() {
   document.getElementById('online-lobby').style.display = 'none';
   document.getElementById('menu-buttons').style.display = 'block';
}
window.startGame = function() {
   document.getElementById('main-menu').style.display = 'none';
   document.getElementById('game-hud').style.display = 'block';
   try{SoundManager.init();}catch(e){}
   if(IS_ONLINE) {
       document.getElementById('p1-name').innerText = IS_HOST ? "SEN (HOST)" : "RAKİP";
       document.getElementById('p2-name-label').innerText = IS_HOST ? "RAKİP" : "SEN (CLIENT)";
   }
   startRound();
}
// --- OYUN DÖNGÜSÜ ---
function startRound() {
   if(p1) scene.remove(p1.mesh);
   if(p2) scene.remove(p2.mesh);
   // P1 her zaman Kırmızı, P2 her zaman Mavi
   p1 = new Boxer(0xd32f2f, -4, true);
   p2 = new Boxer(0x1976d2, 4, false);
   gameActive = true;
   document.getElementById('msg-overlay').style.display = 'none';
   updateHUD();
}
function updateHUD() {
   if(!p1 || !p2) return;
   document.getElementById('p1-hp').style.width = Math.max(0, p1.hp) + '%';
   document.getElementById('p2-hp').style.width = Math.max(0, p2.hp) + '%';
   document.getElementById('p1-stamina').style.width = p1.stamina + '%';
   document.getElementById('p2-stamina').style.width = p2.stamina + '%';
   // Ulti
   const u1 = document.getElementById('p1-ulti'); const u2 = document.getElementById('p2-ulti');
   u1.style.width = p1.ulti + '%'; u2.style.width = p2.ulti + '%';
   p1.ulti >= 100 ? u1.parentElement.classList.add('ulti-ready') : u1.parentElement.classList.remove('ulti-ready');
   p2.ulti >= 100 ? u2.parentElement.classList.add('ulti-ready') : u2.parentElement.classList.remove('ulti-ready');
}
function checkHit(atk, def) {
   const range = atk.isUltiActive ? 5.0 : 3.5;
   const dist = Math.abs(atk.mesh.position.x - def.mesh.position.x);
   const facing = (atk.facing === 1 && def.mesh.position.x > atk.mesh.position.x) ||
                  (atk.facing === -1 && def.mesh.position.x < atk.mesh.position.x);
   if (dist < range && facing) {
       def.takeHit(atk.mesh.position.x, atk.isUltiActive);
       if(def.hp <= 0 && !def.dead) {
           def.dead = true; def.mesh.rotation.x = -Math.PI/2;
           endRound(def);
       }
   }
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
// AI YÖNETİMİ
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
// PARTİKÜL
function createParticles(x, y, color) {
   for (let i = 0; i < 10; i++) {
       const m = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.2,0.2), new THREE.MeshBasicMaterial({color:color}));
       m.position.set(x,y,0); scene.add(m);
       particles.push({mesh:m, vel:{x:(Math.random()-0.5), y:Math.random(), z:(Math.random()-0.5)}, life:1});
   }
}
// ANA DÖNGÜ (ANIMATE)
function animate() {
   requestAnimationFrame(animate);
   const time = Date.now() * 0.001;
   if (gameActive && p1 && p2) {
       if (VS_AI && !IS_ONLINE) updateAI();
       p1.update(-0.02, time);
       p2.update(-0.02, time);
       // Çarpışma (Hitbox)
       if(p1.isAttacking && !p1.hasHit) { checkHit(p1, p2); p1.hasHit=true; setTimeout(()=>p1.hasHit=false, 200); }
       if(p2.isAttacking && !p2.hasHit) { checkHit(p2, p1); p2.hasHit=true; setTimeout(()=>p2.hasHit=false, 200); }
   }
   // Kamera
   if(screenShake>0) {
       camera.position.x = originalCamPos.x + (Math.random()-0.5)*screenShake;
       camera.position.y = originalCamPos.y + (Math.random()-0.5)*screenShake;
       screenShake *= 0.9;
   } else if(p1 && p2) {
       const mid = (p1.mesh.position.x + p2.mesh.position.x)/2;
       camera.position.x += (mid - camera.position.x)*0.05;
   }
   // Partiküller
   particles.forEach((p,i)=>{
       p.life-=0.05; p.mesh.position.add(p.vel); p.mesh.scale.setScalar(p.life);
       if(p.life<=0){ scene.remove(p.mesh); particles.splice(i,1); }
   });
   renderer.render(scene, camera);
   updateHUD();
}
animate();
window.addEventListener('resize', () => {
   camera.aspect = window.innerWidth/window.innerHeight;
   camera.updateProjectionMatrix();
   renderer.setSize(window.innerWidth, window.innerHeight);
});