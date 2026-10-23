const CONFIG_RUTAFLEX = { whatsapp:"5491123793596", alias:"RUTAFLEX.MP", linkSemanal:"https://mpago.la/2DjaHdB", linkMensual:"https://mpago.la/2aNpJ1B" };
let destinos=[], destinosDetectados=[], emailRecuperacion="", estaVencido=false;

// Fecha de hoy
const hoy = new Date();
const opciones = { day: 'numeric', month: 'short' };
const fechaHoy = hoy.toLocaleDateString('es-AR', opciones).replace('.', '');
const fechaEl = document.getElementById('fechaHoy');
if (fechaEl) fechaEl.innerText = `Hoy, ${fechaHoy}`;

window.togglePass=(id,icon)=>{const i=document.getElementById(id);if(!i)return;i.type=i.type==="password"?"text":"password";icon.innerText=i.type==="text"?"🙈":"️"};

function mostrarNotificacion(m,t='info'){
  const c=document.getElementById('notificaciones');if(!c)return;
  const n=document.createElement('div');
  n.className=`${t==='exito'?'bg-green-600':t==='error'?'bg-red-600':'bg-[#4A9FE3]'} text-white px-6 py-3 rounded-xl font-bold text-sm text-center shadow-xl`;
  n.innerText=m;c.appendChild(n);setTimeout(()=>n.remove(),3500);
}

function ocultarTodasLasPantallasExcepto(id){
  ['authScreen','appScreen','pegarTextoScreen','perfilScreen','payment-modal','modalEdicion'].forEach(s=>{
    const el=document.getElementById(s); if(el) el.classList.add('hidden');
  });
  document.getElementById(id)?.classList.remove('hidden');
  window.scrollTo(0,0);
}

function actualizarNav(tabActivo) {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    if (btn.dataset.tab === tabActivo) {
      btn.classList.remove('text-gray-500');
      btn.classList.add('text-[#00E5FF]');
    } else {
      btn.classList.remove('text-[#00E5FF]');
      btn.classList.add('text-gray-500');
    }
  });
}

// ✅ FUNCIÓN DE NAVEGACIÓN CON HISTORIAL
function mostrarTab(tab, pushState = true) {
  if(tab === 'home') {
    ocultarTodasLasPantallasExcepto('appScreen');
    actualizarNav('home');
    if (pushState) history.pushState({tab: 'home'}, '', '#home');
  }
  if(tab === 'perfil') {
    ocultarTodasLasPantallasExcepto('perfilScreen');
    mostrarPerfil();
    actualizarNav('perfil');
    if (pushState) history.pushState({tab: 'perfil'}, '', '#perfil');
  }
  if(tab === 'rutas' || tab === 'historial') {
    mostrarNotificacion("🚧 Sección en desarrollo", "info");
  }
}

// ✅ DETECTAR BOTÓN ATRÁS DEL NAVEGADOR
window.addEventListener('popstate', (event) => {
  if (event.state && event.state.tab) {
    mostrarTab(event.state.tab, false);
  } else {
    // Si no hay estado, volver al home
    mostrarTab('home', false);
  }
});

window.abrirModalPagos=(plan,precio)=>{
  document.getElementById('modal-plan-texto').innerText=`Plan ${plan} - $${precio}`;
  document.getElementById('modal-alias-texto').innerText=CONFIG_RUTAFLEX.alias;
  document.getElementById('btn-wsp-pago').href=`https://wa.me/${CONFIG_RUTAFLEX.whatsapp}?text=${encodeURIComponent(`Hola RutaFlex! Comprobante Plan ${plan} $${precio}`)}`;
  document.getElementById('btn-mp-pago').href=plan==='Semanal'?CONFIG_RUTAFLEX.linkSemanal:CONFIG_RUTAFLEX.linkMensual;
  document.getElementById('payment-modal').classList.remove('hidden');
};
window.cerrarModalPagos=()=>document.getElementById('payment-modal').classList.add('hidden');
window.copiarAlias=()=>{navigator.clipboard.writeText(CONFIG_RUTAFLEX.alias).then(()=>mostrarNotificacion("✅ Alias copiado","exito"))};

window.addEventListener('load',async()=>{
  const e=localStorage.getItem('rutaflex_email');
  if(e&&document.getElementById('loginEmail')) document.getElementById('loginEmail').value=e;
  try{
    const r=await fetch('/api/yo',{credentials:'include'});
    const d=await r.json();
    if(d.ok) mostrarApp(d.nombre,d.fecha_vencimiento);
  }catch{}
});

async function hacerLogout(){
  await fetch('/api/logout',{method:'POST',credentials:'include'});
  localStorage.removeItem('rutaflex_email');
  location.reload();
}

// Auth
document.getElementById('tabLogin')?.addEventListener('click',()=>{
  document.getElementById('formLogin').classList.remove('hidden');
  document.getElementById('formRegistro').classList.add('hidden');
  document.getElementById('tabLogin').className="flex-1 py-3 px-4 rounded-xl font-bold text-[#4A9FE3] bg-[#1E324F] transition-all";
  document.getElementById('tabRegistro').className="flex-1 py-3 px-4 rounded-xl font-bold text-gray-400 hover:text-white transition-all";
});
document.getElementById('tabRegistro')?.addEventListener('click',()=>{
  document.getElementById('formRegistro').classList.remove('hidden');
  document.getElementById('formLogin').classList.add('hidden');
  document.getElementById('tabRegistro').className="flex-1 py-3 px-4 rounded-xl font-bold text-[#4A9FE3] bg-[#1E324F] transition-all";
  document.getElementById('tabLogin').className="flex-1 py-3 px-4 rounded-xl font-bold text-gray-400 hover:text-white transition-all";
});

document.getElementById('formLogin')?.addEventListener('submit',async(e)=>{
  e.preventDefault();
  const email=document.getElementById('loginEmail').value, password=document.getElementById('loginPassword').value;
  const msg=document.getElementById('authMessage'); msg.innerText="Conectando...";
  try{
    const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({email,password})});
    const d=await r.json();
    if(r.ok){ localStorage.setItem('rutaflex_email',email); mostrarApp(d.usuario.nombre,d.usuario.fecha_vencimiento); }
    else{ msg.innerText=d.error||"Error"; }
  }catch{ msg.innerText="Error de conexión"; }
});

document.getElementById('btnLogoutPerfil')?.addEventListener('click',hacerLogout);
document.getElementById('btnPromo')?.addEventListener('click',async()=>{
  const codigo=document.getElementById('promo').value;if(!codigo)return;
  const r=await fetch('/api/validar-promo',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({codigo})});
  const d=await r.json();mostrarNotificacion(d.mensaje,d.valido?'exito':'error');
});

function mostrarApp(nombre,fechaVencimiento){
  ocultarTodasLasPantallasExcepto('appScreen');
  actualizarNav('home');
  history.replaceState({tab: 'home'}, '', '#home');
  document.getElementById('userName').innerText=`¡Hola, ${nombre}! `;
  const diff=Math.ceil((new Date(fechaVencimiento)-new Date())/(1000*60*60*24));
  estaVencido = diff <= 0;
  const contadorEl=document.getElementById('contadorDias');
  if(estaVencido){
    contadorEl.innerText="⚠️ VENCIDO"; contadorEl.className="inline-block mt-2 text-xs font-bold px-3 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30";
    document.getElementById('bannerVencido').classList.remove('hidden');
  } else if(diff<=3){
    contadorEl.innerText=`⏳ Vence en ${diff} días`; contadorEl.className="inline-block mt-2 text-xs font-bold px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30";
  } else {
    contadorEl.innerText=`✅ Activo (${diff} días)`; contadorEl.className="inline-block mt-2 text-xs font-bold px-3 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30";
  }
  cargarDestinos();
}

async function cargarDestinos(){
  if(estaVencido) return;
  try{
    const r = await fetch('/api/destinos',{credentials:'include'});
    destinos = await r.json();
    renderLista();
    actualizarRecientes();
  }catch(e){ console.error(e); }
}

function actualizarRecientes() {
  if (destinos.length > 0) {
    const titulo = document.getElementById('recienteTitulo');
    const sub = document.getElementById('recienteSub');
    if (titulo) titulo.innerText = `${destinos[0].direccion || 'Ruta'} → ${destinos[destinos.length-1].direccion || 'Final'}`;
    if (sub) sub.innerText = `Creada ahora • ${destinos.length} paradas`;
  }
}

// OCR
document.getElementById('fileImg')?.addEventListener('change', async (e) => {
  if (estaVencido) return mostrarNotificacion("⚠️ Plan vencido", "error");
  const file = e.target.files[0]; if (!file) return;
  mostrarNotificacion("🤖 Leyendo imagen...", "info");
  try {
    const { data: { text } } = await Tesseract.recognize(file, 'spa');
    let lineas = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
    let agrupadas = [];
    for (let i = 0; i < lineas.length; i++) {
      let actual = lineas[i]; let siguiente = lineas[i+1] || "";
      if (actual.length < 40 && !/\d{3,4}/.test(actual) && (/\d{2,4}/.test(siguiente) || /(Av\.|Libertador|Rivadavia|Corrientes|Santa Fe)/i.test(siguiente))) {
        agrupadas.push(`${actual} - ${siguiente}`); i++;
      } else if (actual.length > 8) { agrupadas.push(actual); }
    }
    destinosDetectados = [...new Set(agrupadas)].filter(l=>l.length>10);
    if (destinosDetectados.length === 0) return mostrarNotificacion("⚠️ No se entendió", "error");
    mostrarNotificacion(`✅ ${destinosDetectados.length} detectados`, "exito");
    mostrarModalEdicion();
  } catch (err) { mostrarNotificacion("❌ Error leyendo", "error");
  } finally { e.target.value = ''; }
});

function mostrarModalEdicion(){
  const c=document.getElementById('contenedorInputs'); c.innerHTML='';
  destinosDetectados.forEach((dir,i)=>{
    c.innerHTML+=`<div class="flex gap-2 items-start bg-[#0A1220] p-3 rounded-xl border border-[#1E324F]">
      <span class="bg-[#00E5FF] text-[#0A1220] rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold mt-1 flex-shrink-0">${i+1}</span>
      <input type="text" value="${dir.replace(/"/g,'&quot;')}" class="input-direccion flex-1 bg-[#121E32] border border-[#1E324F] rounded-lg px-3 py-2 text-sm text-white" placeholder="Dirección">
      <button onclick="eliminarLinea(${i})" class="text-red-400 p-2">🗑️</button>
    </div>`;
  });
  document.getElementById('modalEdicion').classList.remove('hidden');
}
window.eliminarLinea=i=>{destinosDetectados.splice(i,1);mostrarModalEdicion()};

document.getElementById('btnGuardarEdicion')?.addEventListener('click',async()=>{
  const dirs=document.querySelectorAll('.input-direccion'); 
  const finales=[...dirs].map(d=>d.value.trim()).filter(d=>d.length>3);
  if(finales.length===0) return mostrarNotificacion("Ingresá al menos una","error");
  const btn=document.getElementById('btnGuardarEdicion'); btn.innerText="💾 Guardando..."; btn.disabled=true;
  try{
    for(const d of finales) await fetch('/api/destinos',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({direccion:d})});
    mostrarNotificacion(`✅ ${finales.length} guardadas`,"exito");
    document.getElementById('modalEdicion').classList.add('hidden');
    await cargarDestinos();
  }catch{ mostrarNotificacion("❌ Error","error"); }
  finally{ btn.innerText="✅ Guardar"; btn.disabled=false; }
});
document.getElementById('btnCancelarEdicion')?.addEventListener('click',()=>{document.getElementById('modalEdicion').classList.add('hidden');});
document.getElementById('btnCerrarModal')?.addEventListener('click',()=>{document.getElementById('modalEdicion').classList.add('hidden');});

function renderLista(){
  const l=document.getElementById('lista'); if(!l)return; l.innerHTML="";
  destinos.forEach((d,i)=>{
    l.innerHTML+=`<li class="bg-[#121E32] border border-[#1E324F] border-l-[4px] border-l-[#00E5FF] rounded-xl p-3 flex gap-3 items-center mb-2">
      <span class="bg-[#00E5FF] text-[#0A1220] rounded-full w-7 h-7 flex items-center justify-center text-xs font-black flex-shrink-0">${i+1}</span>
      <div class="flex-1 min-w-0"><b class="block truncate text-white text-sm">${d.direccion||d.dirección}</b></div>
      <button onclick="borrarDestino('${d._id}')" class="text-gray-400 hover:text-red-400 p-1">✕</button>
    </li>`;
  });
}
window.borrarDestino=async(id)=>{await fetch(`/api/destinos/${id}`,{method:'DELETE',credentials:'include'});await cargarDestinos()};

// ==========================================
// 📋 MÓDULO PEGAR TEXTO (OPTIMIZADO)
// ==========================================
document.getElementById('btnPegarTexto')?.addEventListener('click', () => {
  ocultarTodasLasPantallasExcepto('pegarTextoScreen');
  history.pushState({tab: 'pegar'}, '', '#pegar');
  document.getElementById('pegarTextoStep1').classList.remove('hidden');
  document.getElementById('pegarTextoLoading').classList.add('hidden');
  document.getElementById('pegarTextoResult').classList.add('hidden');
  document.getElementById('textoDirecciones').value = '';
});

document.getElementById('btnVolverPegarTexto')?.addEventListener('click', () => { 
  ocultarTodasLasPantallasExcepto('appScreen'); 
  actualizarNav('home');
  history.pushState({tab: 'home'}, '', '#home');
});
document.getElementById('btnReiniciarPegar')?.addEventListener('click', () => {
  document.getElementById('pegarTextoStep1').classList.remove('hidden');
  document.getElementById('pegarTextoLoading').classList.add('hidden');
  document.getElementById('pegarTextoResult').classList.add('hidden');
  document.getElementById('textoDirecciones').value = '';
});

const limpiarTextoSucio = (t) => t.replace(/[\u{1F600}-\u{1F6FF}\u{2600}-\u{26FF}]/gu, '')
  .replace(/\b(hola|buen dia|che|capo|gracias|mañana|hoy|como estas)\b/gi, '')
  .replace(/\b\d{2,4}[- ]?\d{3,4}[- ]?\d{4}\b/g, '').replace(/\$\s?\d+/g, '')
  .split('\n').map(l => l.trim()).filter(l => l.length > 8).join('\n');

document.getElementById('btnProcesarTexto')?.addEventListener('click', async () => {
  const texto = document.getElementById('textoDirecciones').value;
  if (!texto.trim()) return mostrarNotificacion("⚠️ Pegá algún texto primero", "error");

  document.getElementById('pegarTextoStep1').classList.add('hidden');
  document.getElementById('pegarTextoLoading').classList.remove('hidden');

  // 1. GPS
  let userLat = -34.6037, userLon = -58.3816;
  try {
    const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, {enableHighAccuracy:true, timeout:10000}));
    userLat = pos.coords.latitude; userLon = pos.coords.longitude;
  } catch(e) { console.log("GPS no disponible"); }

  // 2. Extraer
  const limpio = limpiarTextoSucio(texto);
  const regex = /([A-Za-zÁÉÍÓÚáéíóúÑñ\. ]{3,}\s+\d{1,5}[A-Za-z]?)(\s*,\s*[A-Za-z ]+)?/g;
  const candidatas = [...limpio.matchAll(regex)].map(m => m[0].trim()).slice(0, 50);
  const unicas = [...new Set(candidatas)];
  
  const validadas = [];
  let descartadas = 0;

  // 3. Validar Nominatim
  for (const dir of unicas) {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(dir + ', Buenos Aires, Argentina')}&limit=1`, {headers: {'User-Agent': 'RutaFlexApp/1.0'}});
      const d = await r.json();
      if (d[0]?.importance > 0.4) {
        validadas.push({ original: dir, display: d[0].display_name, lat: parseFloat(d[0].lat), lon: parseFloat(d[0].lon) });
      } else { descartadas++; }
    } catch (e) { descartadas++; }
  }

  // 4. Ordenar por distancia (Haversine)
  const toRad = v => v * Math.PI / 180;
  const distHaversine = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };
  validadas.sort((a, b) => distHaversine(userLat, userLon, a.lat, a.lon) - distHaversine(userLat, userLon, b.lat, b.lon));

  // 5. Renderizar
  document.getElementById('pegarTextoLoading').classList.add('hidden');
  document.getElementById('pegarTextoResult').classList.remove('hidden');
  document.getElementById('countValidas').innerText = validadas.length;
  document.getElementById('statParadasPegadas').innerText = validadas.length;
  const distTotal = (validadas.length * 2.1).toFixed(0);
  const tiempoTotal = (validadas.length * 0.13).toFixed(1);
  document.getElementById('statDistanciaPegadas').innerText = distTotal;
  document.getElementById('statTiempoPegadas').innerText = tiempoTotal;

  const listaEl = document.getElementById('listaPegadas');
  listaEl.innerHTML = '';
  
  validadas.forEach((r, i) => {
    const tipo = i === 0 ? 'Recogida' : 'Entrega';
    const tiempo = `${Math.floor(Math.random()*15+8)} min`;
    listaEl.innerHTML += `
      <div class="bg-[#121E32] rounded-xl p-3 flex gap-3 items-center border border-[#1E324F]">
        <div class="w-8 h-8 rounded-full bg-[#00E5FF] text-[#0A1220] font-black flex items-center justify-center flex-shrink-0 text-sm">${i + 1}</div>
        <div class="flex-1 min-w-0">
          <p class="font-bold text-sm text-white truncate">${r.original}</p>
          <p class="text-xs text-gray-400 truncate">${tipo} • ${tiempo}</p>
        </div>
        <svg class="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
      </div>
    `;
  });

  // 6. Tramos de 10 en 10
  const tramosContainer = document.getElementById('tramosContainer');
  tramosContainer.innerHTML = '';
  
  const CHUNK = 9;
  for (let i = 0; i < validadas.length; i += CHUNK) {
    const chunk = validadas.slice(i, i + CHUNK);
    const tramoNum = Math.floor(i / CHUNK) + 1;
    const totalTramos = Math.ceil(validadas.length / CHUNK);
    
    const origin = `${userLat},${userLon}`;
    const dest = `${chunk[chunk.length-1].lat},${chunk[chunk.length-1].lon}`;
    const waypoints = chunk.slice(0, -1).map(p => `${p.lat},${p.lon}`).join('|');
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&waypoints=optimize:true|${waypoints}&travelmode=driving`;
    const wazeUrl = `https://www.waze.com/es-419/ul?ll=${chunk[0].lat},${chunk[0].lon}&navigate=yes`;

    tramosContainer.innerHTML += `
      <div class="bg-[#121E32] rounded-xl p-4 border border-[#1E324F]">
        <p class="text-[#00E5FF] font-bold text-sm mb-3 text-center">Tramo ${tramoNum} de ${totalTramos} (${chunk.length} paradas)</p>
        <div class="grid grid-cols-2 gap-3">
          <a href="${mapsUrl}" target="_blank" class="bg-[#00E5FF] text-[#0A1220] font-black py-4 rounded-xl text-center text-sm hover:bg-[#00c8e0] transition-all flex items-center justify-center gap-2 active:scale-95">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            ABRIR EN<br>GOOGLE MAPS
          </a>
          <a href="${wazeUrl}" target="_blank" class="bg-transparent border-2 border-[#00E5FF] text-[#00E5FF] font-black py-4 rounded-xl text-center text-sm hover:bg-[#00E5FF]/10 transition-all flex items-center justify-center gap-2 active:scale-95">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 3.5c-2-1-4.5-1.5-7-1.5s-5 .5-7 1.5C3 5.5 1 8.5 1 12c0 2.5 1 5 2.5 7L2 22l3.5-1.5c2 1 4.5 1.5 7 1.5 5.5 0 10-4.5 10-10 0-3.5-2-6.5-4.5-8.5z"/></svg>
            ABRIR EN<br>WAZE
          </a>
        </div>
      </div>
    `;
  }
});

async function abrirCamara(){
  const v=document.getElementById('camara'); v.classList.remove('hidden');
  try{ v.srcObject=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}}); }
  catch{ mostrarNotificacion("No se pudo abrir cámara","error"); }
}

function mostrarPerfil(){
  const email=localStorage.getItem('rutaflex_email')||'usuario@rutaflex.com';
  document.getElementById('perfilNombre').innerText=email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1);
  document.getElementById('perfilEmail').innerText=email;
}

if('serviceWorker' in navigator){ window.addEventListener('load',()=>{ navigator.serviceWorker.register('/service-worker.js',{scope:'/'}).catch(()=>{}); }); }
