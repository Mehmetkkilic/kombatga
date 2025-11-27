// --- ONLINE BAĞLANTI MANTIĞI ---
let peer = null;
let conn = null;
function updateStatus(msg, color="white") {
   const el = document.getElementById('status-text');
   if(el) { el.innerText = msg; el.style.color = color; }
}
function initPeer() {
   updateStatus("SUNUCUYA BAĞLANILIYOR...");
   peer = new Peer(null, { debug: 1, secure: true, sameSite: 'none' });
   peer.on('open', (id) => {
       document.getElementById('my-id').innerText = id;
       updateStatus("HAZIR (ID BEKLENİYOR)", "#00e5ff");
   });
   peer.on('connection', (connection) => {
       conn = connection;
       IS_HOST = true;
       updateStatus("BİRİSİ BAĞLANIYOR...", "yellow");
       conn.on('open', () => {
           conn.on('data', (data) => {
               // El Sıkışma (Handshake)
               if (data.type === 'READY_TO_START') {
                   VS_AI = false; IS_ONLINE = true;
                   startGame(); // Host oyunu açar
                   conn.send({ type: 'START_GAME_NOW' }); // Client'a da aç der
               } else if (data.type === 'input') {
                   handleNetworkData(data);
               }
           });
       });
   });
   peer.on('error', (err) => updateStatus("HATA: " + err.type, "red"));
}
window.joinGame = function() {
   const friendId = document.getElementById('friend-id').value.trim();
   if(!friendId) return alert("Lütfen bir ID gir!");
   updateStatus("BAĞLANILIYOR...", "yellow");
   conn = peer.connect(friendId);
   IS_HOST = false;
   conn.on('open', () => {
       updateStatus("BAĞLANDI! ONAY BEKLENİYOR...", "#00ff00");
       conn.send({ type: 'READY_TO_START' }); // Host'a hazır ol mesajı
       conn.on('data', (data) => {
           if (data.type === 'START_GAME_NOW') {
               VS_AI = false; IS_ONLINE = true;
               startGame();
           } else if (data.type === 'input') {
               handleNetworkData(data);
           }
       });
   });
}
function sendData(data) {
   if(IS_ONLINE && conn && conn.open) conn.send(data);
}
function handleNetworkData(data) {
   if(data.type === 'input') {
       const targetPlayer = IS_HOST ? p2 : p1; // Hostsam gelen veri P2'dir
       handleInput(targetPlayer, data.key, data.isDown);
   }
}
window.copyId = function() {
   navigator.clipboard.writeText(document.getElementById('my-id').innerText);
   alert("Kopyalandı!");
}