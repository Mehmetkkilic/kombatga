// --- KONTROLLER ---
// Ortak hareket işleyici
function handleInput(player, key, isDown) {
   if(isDown) {
       if(key==='left') player.velocity.x = -player.speed;
       if(key==='right') player.velocity.x = player.speed;
       if(key==='jump') player.jump();
       if(key==='block') player.isBlocking = true;
       if(key==='attack') player.attack();
       if(key==='ulti') player.attack(true);
   } else {
       // Tuş bırakılınca durma mantığı
       if(key==='left' || key==='right') player.velocity.x = 0;
       if(key==='block') player.isBlocking = false;
   }
}
// KLAVYE BASILINCA (KEYDOWN)
window.addEventListener('keydown', e => {
   if(!gameActive) return;
   // BENİM KONTROLLERİM
   let myAction = null;
   // --- YENİ TUŞ HARİTASI ---
   // Hareket: Yön Tuşları
   if(e.key === 'ArrowRight') myAction = 'right';
   if(e.key === 'ArrowLeft') myAction = 'left';
   if(e.key === 'ArrowUp') myAction = 'jump';
   // Aksiyon: D, S, A
   if(e.key === 'd' || e.key === 'D') myAction = 'attack'; // Yumruk
   if(e.key === 's' || e.key === 'S') myAction = 'block';  // Savunma
   if(e.key === 'a' || e.key === 'A') {                    // Ulti
       // Ulti kontrolü (Sadece bar doluysa)
       const myPlayer = (IS_ONLINE && !IS_HOST) ? p2 : p1;
       if(myPlayer.ulti >= 100) myAction = 'ulti';
   }
   if(myAction) {
       if(IS_ONLINE) {
           const myPlayer = IS_HOST ? p1 : p2;
           handleInput(myPlayer, myAction, true);
           sendData({ type: 'input', key: myAction, isDown: true });
       } else {
           // Tek Kişilik Modda Ben P1'im
           handleInput(p1, myAction, true);
       }
   }
});
// KLAVYE BIRAKILINCA (KEYUP)
window.addEventListener('keyup', e => {
   if(!gameActive) return;
   let myAction = null;
   if(e.key === 'ArrowRight') myAction = 'right';
   if(e.key === 'ArrowLeft') myAction = 'left';
   if(e.key === 's' || e.key === 'S') myAction = 'block';
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
       { id: 'btn-left', action: 'left' },
       { id: 'btn-right', action: 'right' },
       { id: 'btn-jump', action: 'jump' },
       { id: 'btn-atk', action: 'attack' },
       { id: 'btn-block', action: 'block' },
       { id: 'btn-ulti', action: 'ulti' }
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
   // Hangi oyuncu olduğunu bul
   let myPlayer = p1;
   if(IS_ONLINE && !IS_HOST) myPlayer = p2;
   // Ulti kontrolü
   if(action === 'ulti' && myPlayer.ulti < 100) return;
   handleInput(myPlayer, action, isDown);
   if(IS_ONLINE) sendData({ type: 'input', key: action, isDown: isDown });
}
setupMobileControls();