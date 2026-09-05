const DB='minimusic-v2', VER=1, STORE='songs';
let db, songs=[], current=-1, shuffle=false, repeat=false, url=null;
const $=s=>document.querySelector(s);
const audio=$('#audio');

function openDB(){return new Promise((resolve,reject)=>{let r=indexedDB.open(DB,VER);r.onupgradeneeded=()=>{let d=r.result;if(!d.objectStoreNames.contains(STORE))d.createObjectStore(STORE,{keyPath:'id'})};r.onsuccess=()=>{db=r.result;resolve()};r.onerror=()=>reject(r.error)})}
function getAll(){return new Promise((res,rej)=>{let r=db.transaction(STORE).objectStore(STORE).getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function put(x){return new Promise((res,rej)=>{let r=db.transaction(STORE,'readwrite').objectStore(STORE).put(x);r.onsuccess=res;r.onerror=()=>rej(r.error)})}
function remove(id){return new Promise((res,rej)=>{let r=db.transaction(STORE,'readwrite').objectStore(STORE).delete(id);r.onsuccess=res;r.onerror=()=>rej(r.error)})}
function fmt(sec){if(!Number.isFinite(sec))return'0:00';return Math.floor(sec/60)+':'+String(Math.floor(sec%60)).padStart(2,'0')}
function toast(t){const x=$('#toast');x.textContent=t;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),2200)}
function bytes(n){return n<1048576?Math.round(n/1024)+' KB':(n/1048576).toFixed(1)+' MB'}

async function refresh(){
 songs=await getAll();
 const q=$('#search').value.toLowerCase().trim(), sort=$('#sort').value;
 let view=songs.filter(s=>s.title.toLowerCase().includes(q)||(s.artist||'').toLowerCase().includes(q));
 view.sort(sort==='newest'?(a,b)=>b.createdAt-a.createdAt:(a,b)=>a.title.localeCompare(b.title,'de'));
 $('#songCount').textContent=songs.length;
 const lib=$('#library');lib.innerHTML='';
 if(!view.length){lib.innerHTML='<div class="empty">Noch keine passenden Songs.<br>Füge oben deine Musik hinzu.</div>';return}
 view.forEach(s=>{
  const i=songs.findIndex(x=>x.id===s.id), row=document.createElement('div');row.className='song';
  row.innerHTML='<div class="song-art">♪</div><div><div class="song-title"></div><div class="song-sub"></div></div><div class="song-actions"><button class="fav">♡</button><button class="play-song">▶</button></div><div class="song-actions"><button class="delete">×</button></div>';
  row.querySelector('.song-title').textContent=s.title;
  row.querySelector('.song-sub').textContent=(s.artist||'Unbekannter Artist')+' • '+bytes(s.size)+' • offline';
  row.querySelector('.play-song').onclick=()=>play(i);
  row.querySelector('.delete').onclick=async()=>{await remove(s.id);if(current===i)stop();await refresh();toast('Song gelöscht')};
  const fav=row.querySelector('.fav');fav.textContent=s.favorite?'♥':'♡';fav.onclick=async()=>{s.favorite=!s.favorite;await put(s);await refresh()};
  lib.appendChild(row);
 });
}
async function play(i){
 if(!songs[i])return;
 current=i;if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(songs[i].blob);audio.src=url;
 audio.play();$('#bottomPlayer').hidden=false;updatePlayer();
}
function updatePlayer(){
 if(current<0||!songs[current])return;
 const s=songs[current];$('#heroTitle').textContent=s.title;$('#heroArtist').textContent=s.artist||'Unbekannter Artist';
 $('#miniTitle').textContent=s.title;$('#miniArtist').textContent=s.artist||'Unbekannter Artist';$('#play').textContent=audio.paused?'▶':'⏸';$('#miniPlay').textContent=audio.paused?'▶':'⏸';
}
function stop(){audio.pause();audio.removeAttribute('src');if(url)URL.revokeObjectURL(url);url=null;current=-1;$('#bottomPlayer').hidden=true;$('#progress').value=0}
function next(){
 if(!songs.length)return;
 if(repeat&&current>=0){play(current);return}
 let n=shuffle?Math.floor(Math.random()*songs.length):(current+1)%songs.length;play(n)
}
async function importFiles(list){
 const files=[...list];if(!files.length)return;
 toast('Speichere '+files.length+' Song'+(files.length>1?'s':'')+'…');
 for(const f of files){if(!f.type.startsWith('audio/'))continue;let name=f.name.replace(/\.[^.]+$/,'');await put({id:crypto.randomUUID(),title:name,artist:'',size:f.size,type:f.type,blob:f,createdAt:Date.now(),favorite:false})}
 await refresh();toast('Musik offline gespeichert ✓')
}
$('#importBtn').onclick=()=>$('#fileInput').click();$('#heroImport').onclick=()=>$('#fileInput').click();
$('#fileInput').onchange=e=>{importFiles(e.target.files);e.target.value=''};
$('#play').onclick=()=>{if(current<0){if(songs.length)play(0);return}audio.paused?audio.play():audio.pause();updatePlayer()};
$('#miniPlay').onclick=()=>$('#play').click();$('#prev').onclick=()=>{if(!songs.length)return;play((current-1+songs.length)%songs.length)};$('#miniPrev').onclick=()=>$('#prev').click();
$('#next').onclick=next;$('#miniNext').onclick=next;
$('#shuffle').onclick=()=>{shuffle=!shuffle;$('#shuffle').textContent=shuffle?'⌘ Shuffle: An':'⌘ Shuffle'};
$('#repeat').onclick=()=>{repeat=!repeat;$('#repeat').textContent='↻ Repeat: '+(repeat?'An':'Aus')};
audio.onplay=updatePlayer;audio.onpause=updatePlayer;audio.onended=next;
audio.ontimeupdate=()=>{$('#progress').value=audio.duration?audio.currentTime/audio.duration*100:0;$('#elapsed').textContent=fmt(audio.currentTime);$('#duration').textContent=fmt(audio.duration)};
$('#progress').oninput=()=>{if(audio.duration)audio.currentTime=audio.duration*$('#progress').value/100};
$('#search').oninput=refresh;$('#sort').onchange=refresh;

async function sync(){
 if(!navigator.onLine){toast('Kein Internet — Offline-Modus');return}
 const base=window.MINIMUSIC_API_BASE||'';
 if(!base){$('#syncText').textContent='Kein Server hinterlegt. Die Offline-Bibliothek funktioniert trotzdem.';toast('Sync-Server noch nicht eingerichtet');return}
 $('#syncText').textContent='Verbinde…';
 try{
   const r=await fetch(base.replace(/\/$/,'')+'/api/songs',{credentials:'include'});
   if(!r.ok)throw new Error('HTTP '+r.status);
   const remote=await r.json();let have=new Set(songs.map(s=>s.id)), added=0;
   for(const s of remote){if(have.has(s.id))continue;const fr=await fetch(s.downloadUrl,{credentials:'include'});const blob=await fr.blob();await put({...s,blob,size:blob.size,createdAt:s.createdAt||Date.now()});added++}
   await refresh();$('#syncText').textContent=added?added+' neue Songs gespeichert.':'Alles aktuell.';toast(added+' neue Songs synchronisiert ✓');
 }catch(e){$('#syncText').textContent='Sync fehlgeschlagen: '+e.message;toast('Sync fehlgeschlagen')}
}
$('#syncBtn').onclick=sync;$('#heroSync').onclick=sync;
$('#settingsBtn').onclick=async()=>{$('#settingsDialog').showModal();if(navigator.storage?.estimate){const e=await navigator.storage.estimate();$('#storageInfo').textContent=(e.usage/1048576).toFixed(1)+' MB verwendet'+(e.quota?' von ca. '+(e.quota/1048576).toFixed(0)+' MB verfügbar':'') }};
$('#closeSettings').onclick=()=>$('#settingsDialog').close();
$('#wifiOnly').onchange=e=>localStorage.setItem('wifiOnly',e.target.checked?'1':'0');
$('#wifiOnly').checked=localStorage.getItem('wifiOnly')!=='0';
window.addEventListener('online',()=>{$('#connection').textContent='● ONLINE • SYNC READY'});
window.addEventListener('offline',()=>{$('#connection').textContent='● OFFLINE READY'});

if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
openDB().then(refresh);
