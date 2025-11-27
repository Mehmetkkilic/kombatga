// --- KONTROLLER ---
// Bu fonksiyon bir oyuncuyu (p1 veya p2) hareket ettirir
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
// KLAVYE BASILINCA (KEYDOWN)
window.addEventListener('keydown', e => {
   if(!gameActive) return;
   // 1. WASD KONTROLLERİ (Her zaman P1 için)
   // Sadece online değilsek veya online'da Host isek P1'i kontrol ederiz
   if(!IS_ONLINE || IS_HOST) {
       if(e.key === 'a' || e.key === 'A') handleInput(p1, 'left', true);
       if(e.key === 'd' || e.key === 'D') handleInput(p1, 'right', true);
       if(e.key === 'w' || e.key === 'W') handleInput(p1, 'jump', true);
       if(e.key === 's' || e.key === 'S') handleInput(p1, 'block', true);
       if(e.key === ' ') handleInput(p1, 'attack', true); // Space = Yumruk
       if(e.key === 'Shift') { // Shift = Ulti
            if(p1.ulti >= 100) handleInput(p1, 'ulti', true);
       }
       // Online ise bu tuşları karşıya gönder
       if(IS_ONLINE && IS_HOST) {
           // Hangi tuşun basıldığını bulup gönderelim
           let action = null;
           if(e.key==='a' || e.key==='A') action='left';
           if(e.key==='d' || e.key==='D') action='right';
           if(e.key==='w' || e.key==='W') action='jump';
           if(e.key==='s' || e.key==='S') action='block';
           if(e.key===' ') action='attack';
           if(e.key==='Shift' && p1.ulti >= 100) action='ulti';
           if(action) sendData({ type: 'input', key: action, isDown: true });
       }
   }
   // 2. YÖN TUŞLARI KONTROLLERİ (P2 için veya Online'da Client için)
   // Eğer yerel oynuyorsak (VS_AI false) veya Online Client isek
   const isLocalMultiplayer = !VS_AI && !IS_ONLINE;
   const isOnlineClient = IS_ONLINE && !IS_HOST;
   if(isLocalMultiplayer || isOnlineClient) {
       let target = isOnlineClient ? p2 : p2; // Client kendi ekranında P2'dir ama kendi inputunu P2'ye uygular
       // Online Client isek, biz aslında P2'yi kontrol ediyoruz ama ekranda "BEN (CLIENT)" P2'dir.
       // Client kendi karakterini (p2) kontrol eder
       if(isOnlineClient) target = p2;
       if(e.key === 'ArrowLeft') handleInput(target, 'left', true);
       if(e.key === 'ArrowRight') handleInput(target, 'right', true);
       if(e.key === 'ArrowUp') handleInput(target, 'jump', true);
       if(e.key === 'ArrowDown') handleInput(target, 'block', true);
       if(e.key === 'Enter') handleInput(target, 'attack', true);
       if(e.key === 'Control') {
            if(target.ulti >= 100) handleInput(target, 'ulti', true);
       }
       // Online Client isek veriyi Host'a gönder
       if(isOnlineClient) {
           let action = null;
           if(e.key==='ArrowLeft') action='left';
           if(e.key==='ArrowRight') action='right';
           if(e.key==='ArrowUp') action='jump';
           if(e.key==='ArrowDown') action='block';
           if(e.key==='Enter') action='attack';
           if(e.key==='Control' && target.ulti >= 100) action='ulti';
           if(action) sendData({ type: 'input', key: action, isDown: true });
       }
   }
});
// KLAVYE BIRAKILINCA (KEYUP)
window.addEventListener('keyup', e => {
   // P1 (WASD) DURMA
   if(!IS_ONLINE || IS_HOST) {
       if(e.key === 'a' || e.key === 'A') handleInput(p1, 'left', false);
       if(e.key === 'd' || e.key === 'D') handleInput(p1, 'right', false);
       if(e.key === 's' || e.key === 'S') handleInput(p1, 'block', false);
       if(IS_ONLINE && IS_HOST) {
           let action = null;
           if(e.key==='a'||e.key==='A') action='left';
           if(e.key==='d'||e.key==='D') action='right';
           if(e.key==='s'||e.key==='S') action='block';
           if(action) sendData({ type: 'input', key: action, isDown: false });
       }
   }
   // P2 (OKLAR) DURMA
   const isLocalMultiplayer = !VS_AI && !IS_ONLINE;
   const isOnlineClient = IS_ONLINE && !IS_HOST;
   if(isLocalMultiplayer || isOnlineClient) {
       let target = p2;
       if(e.key === 'ArrowLeft') handleInput(target, 'left', false);
       if(e.key === 'ArrowRight') handleInput(target, 'right', false);
       if(e.key === 'ArrowDown') handleInput(target, 'block', false);
       if(isOnlineClient) {
           let action = null;
           if(e.key==='ArrowLeft') action='left';
           if(e.key==='ArrowRight') action='right';
           if(e.key==='ArrowDown') action='block';
           if(action) sendData({ type: 'input', key: action, isDown: false });
       }
   }
});
// MOBİL DOKUNMATİK
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
   // Online durumuna göre hangi oyuncuyu kontrol ettiğimizi seç
   // Host isem P1, Client isem P2
   let myPlayer = p1;
   if(IS_ONLINE && !IS_HOST) myPlayer = p2;
   if(action === 'ulti' && myPlayer.ulti < 100) return;
   handleInput(myPlayer, action, isDown);
   if(IS_ONLINE) sendData({ type: 'input', key: action, isDown: isDown });
}
setupMobileControls();