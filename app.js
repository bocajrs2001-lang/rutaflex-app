const CONFIG_RUTAFLEX = { whatsapp:"5491123793596", alias:"RUTAFLEX.MP", linkSemanal:"https://mpago.la/2DjaHdB", linkMensual:"https://mpago.la/2aNpJ1B" };
let destinos=[], destinosDetectados=[], emailRecuperacion="", estaVencido=false;

window.togglePass=(id,icon)=>{const i=document.getElementById(id);if(!i)return;i.type=i.type==="password"?"text":"password";icon.innerText=i.type==="text"?"🙈":"👁️"};
function mostrarNotificacion(m,t='info'){const c=document.getElementById('notificaciones');if(!c)return;const n=document.createElement('div');n.className=`${t==='exito'?'bg-green-600':t==='error'?'bg-red-600':'bg-[#4A9FE3]'} text-white px-6 py-3 rounded-xl font-bold text-sm text-center shadow-xl`;n.innerText=m;c.appendChild(n);setTimeout(()=>n.remove(),3500)}

function ocultarTodasLasPantallasExcepto(id){
  ['authScreen','appScreen','pegarTextoScreen','perfilScreen','payment-modal','modalEdicion'].forEach(s=>{
    const el=document.getElementById(s); if(el) el.classList.add('hidden');
  });
  document.getElementById(id)?.classList.remove('hidden');
  window.scrollTo(0,0);
}

function mostrarTab(tab) {
  if(tab === 'home') ocultarTodasLasPantallasExcepto('appScreen');
  if(tab === 'perfil') {
    ocultarTodasLasPantallasExcepto('perfilScreen');
    mostrarPerfil();
  }
  if(tab === 'rutas' || tab === 'historial') {
    mostrarNotificacion("🚧 Sección en desarrollo", "info");
    ocultarTodasLasPantallasExcepto('appScreen');
  }
}

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

// Auth Listeners
document.getElementById('tabLogin')?.addEventListener('click',()=>{
  document.getElementById('formLogin').classList.remove('hidden');
  document.getElementById('formRegistro').classList.add('hidden');
  document.getElementById('tabLogin').className="flex-1 py-3 px-4 rounded-xl font-bold text-[#4A9FE3] bg-white/20 transition-all";
  document.getElementById('tabRegistro').className="flex-1 py-3 px-4 rounded-xl font-bold text-white/60 hover:text-white transition-all";
});
document.getElementById('tabRegistro')?.addEventListener('click',()=>{
  document.getElementById('formRegistro').classList.remove('hidden');
  document.getElementById('formLogin').classList.add('hidden');
  document.getElementById('tabRegistro').className="flex-1 py-3 px-4 rounded-xl font-bold text-[#4A9FE3] bg-white/20 transition-all";
  document.getElementById('tabLogin').className="flex-1 py-3 px-4 rounded-xl font-bold text-white/60 hover:text-white transition-all";
});
document.getElementById('btnOlvideContrasena')?.addEventListener('click',()=>{ ocultarTodasLasPantallasExcepto('authScreen'); /* Lógica recover */ });
document.getElementById('formLogin')?.addEventListener('submit',async(e)=>{
  e.preventDefault();
  const email=document.getElementById('loginEmail').value, password=document.getElementById('loginPassword').value;
  const msg=document.getElementById('authMessage'); msg.innerText="Conectando...";
  try{
    const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({email,password})});
    const d=await r.json();
    if(r.ok){ localStorage.setItem('rutaflex_email',email); mostrarApp(d.usuario.nombre,d.usuario.fecha_vencimiento); }
    else{ msg.innerText=d.error||"Error"; msg.className="text-center text-sm mt-4 font-bold text-red-400"; }
  }catch{ msg.innerText="Error de conexión"; }
});
document.getElementById('btnLogoutDropdown')?.addEventListener('click',hacerLogout);
document.getElementById('btnLogoutPerfil')?.addEventListener('click',hacerLogout);

function mostrarApp(nombre,fechaVencimiento){
  ocultarTodasLasPantallasExcepto('appScreen');
  document.getElementById('userName').innerText=`${nombre} 👋`;
  const diff=Math.ceil((new Date(fechaVencimiento)-new Date())/(1000*60*60*24));
  estaVencido = diff <= 0;
  const contadorEl=document.getElementById('contadorDias');
  if(estaVencido){
    contadorEl.innerText="⚠️ VENCIDO"; contadorEl.className="inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400";
    document.getElementById('bannerVencido').classList.remove('hidden');
  } else if(diff<=1){
    contadorEl.innerText=`⏳ Vence en ${diff} día`; contadorEl.className="inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400";
  } else {
    contadorEl.innerText=`✅ Activo (${diff} días)`; contadorEl.className="inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded-full bg-green-500/20 text-green-400";
  }
  cargarDestinos();
}

async function cargarDestinos(){
  if(estaVencido) return;
  try{
    const r = await fetch('/api/destinos',{credentials:'include'});
    destinos = await r.json();
    renderLista();
  }catch(e){ console.error(e); }
}

// OCR
document.getElementById('fileImg')?.addEventListener('change', async (e) => {
  if (estaVencido) return mostrarNotificacion("⚠️ Plan vencido", "error");
  const file = e.target.files[0]; if (!file) return;
  const btn = document.getElementById('btnCargar'); const txt = btn.innerText;
  btn.innerText = "🤖 Leyendo..."; btn.disabled = true;
  try {
    const { data: { text } } = await Tesseract.recognize(file, 'spa');
    let lineas = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
    let agrupadas = [];
    for (let i = 0; i < lineas.length; i++) {
      let actual = lineas[i]; let siguiente = lineas[i+1] || "";
      if (actual.length < 40 && !/\d{3,4}/.test(actual) && (/\d{2,4}/.test(siguiente) || /(Av\.|Libertador|Rivadavia|Corrientes)/i.test(siguiente))) {
        agrupadas.push(`${actual} - ${siguiente}`); i++;
      } else if (actual.length > 8) { agrupadas.push(actual); }
    }
    destinosDetectados = [...new Set(agrupadas)].filter(l=>l.length>10);
    if (destinosDetectados.length === 0) return mostrarNotificacion("⚠️ No se entendió", "error");
    mostrarNotificacion(`✅ ${destinosDetectados.length} detectados`, "exito");
    mostrarModalEdicion();
  } catch (err) { mostrarNotificacion("❌ Error leyendo", "error");
  } finally { btn.innerText = txt; btn.disabled = false; e.target.value = ''; }
});

function mostrarModalEdicion(){
  const c=document.getElementById('contenedorInputs'); c.innerHTML='';
  destinosDetectados.forEach((dir,i)=>{
    c.innerHTML+=`<div class="flex gap-2 items-start bg-[#0A1220] p-3 rounded-xl border border-[#1E324F]">
      <span class="bg-[#4A9FE3] text-[#0A1220] rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold mt-1">${i+1}</span>
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
    l.innerHTML+=`<li class="bg-[#121E32] border border-[#1E324F] border-l-[4px] border-l-[#4A9FE3] rounded-xl p-3 flex gap-3 items-center mb-2">
      <span class="bg-[#4A9FE3] text-[#0A1220] rounded-full w-7 h-7 flex items-center justify-center text-xs font-black flex-shrink-0">${i+1}</span>
      <div class="flex-1 min-w-0"><b class="block truncate text-white text-sm">${d.direccion||d.dirección}</b></div>
      <button onclick="borrarDestino('${d._id}')" class="text-gray-400 hover:text-red-400 p-1">✕</button>
    </li>`;
  });
}
window.borrarDestino=async(id)=>{await fetch(`/api/destinos/${id}`,{method:'DELETE',credentials:'include'});await cargarDestinos()};

// ==========================================
// 📋 MÓDULO PEGAR TEXTO (OPTIMIZADO CON GPS Y TRAMOS)
// ==========================================
document.getElementById('btnPegarTexto')?.addEventListener('click', () => {
  ocultarTodasLasPantallasExcepto('pegarTextoScreen');
  document.getElementById('pegarTextoStep1').classList.remove('hidden');
  document.getElementById('pegarTextoLoading').classList.add('hidden');
  document.getElementById('pegarTextoResult').classList.add('hidden');
  document.getElementById('textoDirecciones').value = '';
});

document.getElementById('btnVolverPegarTexto')?.addEventListener('click', () => { ocultarTodasLasPantallasExcepto('appScreen'); });
document.getElementById('btnReiniciarPegar')?.addEventListener('click', () => {
  document.getElementById('pegarTextoStep1').classList.remove('hidden');
  document.getElementById('pegarTextoLoading').classList.add('hidden');
  document.getElementById('pegarTextoResult').classList.add('hidden');
  document.getElementById('textoDirecciones').value = '';
});

const limpiarTextoSucio = (t) => t.replace(/[\u{1F600}-\u{1F6FF}\u{2600}-\u{26FF}]/gu, '')
  .replace(/\b(hola|buen dia|che|capo|gracias|mañana|hoy)\b/gi, '')
  .replace(/\b\d{2,4}[- ]?\d{3,4}[- ]?\d{4}\b/g, '').replace(/\$\s?\d+/g, '')
  .split('\n').map(l => l.trim()).filter(l => l.length > 8).join('\n');

document.getElementById('btnProcesarTexto')?.addEventListener('click', async () => {
  const texto = document.getElementById('textoDirecciones').value;
  if (!texto.trim()) return mostrarNotificacion("⚠️ Pegá algún texto primero", "error");

  document.getElementById('pegarTextoStep1').classList.add('hidden');
  document.getElementById('pegarTextoLoading').classList.remove('hidden');

  // 1. Obtener GPS del usuario
  let userLat = -34.6037, userLon = -58.3816; // Default CABA
  try {
    const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, {enableHighAccuracy:true, timeout:10000}));
    userLat = pos.coords.latitude; userLon = pos.coords.longitude;
  } catch(e) { console.log("GPS no disponible, usando default"); }

  // 2. Limpiar y extraer
  const limpio = limpiarTextoSucio(texto);
  const regex = /([A-Za-zÁÉÍÓÚáéíóúÑñ\. ]{3,}\s+\d{1,5}[A-Za-z]?)(\s*,\s*[A-Za-z ]+)?/g;
  const candidatas = [...limpio.matchAll(regex)].map(m => m[0].trim()).slice(0, 50);
  const unicas = [...new Set(candidatas)];
  
  const validadas = [];
  let descartadas = 0;

  // 3. Validar con Nominatim
  for (const dir of unicas) {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(dir + ', Buenos Aires, Argentina')}&limit=1`, {headers: {'User-Agent': 'RutaFlexApp/1.0'}});
      const d = await r.json();
      if (d[0]?.importance > 0.4) {
        validadas.push({ original: dir, display: d[0].display_name, lat: parseFloat(d[0].lat), lon: parseFloat(d[0].lon) });
      } else { descartadas++; }
    } catch (e) { descartadas++; }
  }

  // 4. Ordenar por distancia desde el usuario (Haversine)
  const toRad = v => v * Math.PI / 180;
  validadas.sort((a, b) => {
    const R = 6371;
    const dLat1 = toRad(a.lat - userLat), dLon1 = toRad(a.lon - userLon);
    const dLat2 = toRad(b.lat - userLat), dLon2 = toRad(b.lon - userLon);
    const distA = R * 2 * Math.asin(Math.sqrt(Math.sin(dLat1/2)**2 + Math.cos(toRad(userLat)) * Math.cos(toRad(a.lat)) * Math.sin(dLon1/2)**2));
    const distB = R * 2 * Math.asin(Math.sqrt(Math.sin(dLat2/2)**2 + Math.cos(toRad(userLat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon2/2)**2));
    return distA - distB;
  });

  // 5. Renderizar resultados
  document.getElementById('pegarTextoLoading').classList.add('hidden');
  document.getElementById('pegarTextoResult').classList.remove('hidden');
  document.getElementById('countValidas').innerText = validadas.length;
  document.getElementById('countDescartadas').innerText = descartadas;
  document.getElementById('statParadasPegadas').innerText = validadas.length;
  document.getElementById('statDistanciaPegadas').innerText = (validadas.length * 1.5).toFixed(1);
  document.getElementById('statTiempoPegadas').innerText = Math.round(validadas.length * 3.5);

  const listaEl = document.getElementById('listaPegadas');
  listaEl.innerHTML = '';
  validadas.forEach((r, i) => {
    listaEl.innerHTML += `<div class="bg-[#121E32] rounded-xl p-3 flex gap-3 border border-[#1E324F]">
      <div class="w-7 h-7 rounded-full bg-[#00E5FF] text-[#0A1220] font-black flex items-center justify-center flex-shrink-0 text-sm">${i + 1}</div>
      <div class="min-w-0"><p class="font-bold text-sm text-white truncate">${r.original}</p><p class="text-xs text-gray-400 truncate">${r.display}</p></div>
    </div>`;
  });

  // 6. Generar tramos de 10 en 10 para Maps y Waze
  const tramosContainer = document.getElementById('tramosContainer');
  tramosContainer.innerHTML = '';
  
  const CHUNK = 9; // 1 destino final + 8 waypoints = 9
  for (let i = 0; i < validadas.length; i += CHUNK) {
    const chunk = validadas.slice(i, i + CHUNK);
    const tramoNum = Math.floor(i / CHUNK) + 1;
    const totalTramos = Math.ceil(validadas.length / CHUNK);
    
    // Google Maps URL con optimize:true
    const origin = `${userLat},${userLon}`;
    const dest = `${chunk[chunk.length-1].lat},${chunk[chunk.length-1].lon}`;
    const waypoints = chunk.slice(0, -1).map(p => `${p.lat},${p.lon}`).join('|');
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&waypoints=optimize:true|${waypoints}&travelmode=driving`;
    
    // Waze URL (Waze no soporta waypoints múltiples bien, usamos el primer destino del tramo como referencia)
    const wazeUrl = `https://www.waze.com/es-419/ul?ll=${chunk[0].lat},${chunk[0].lon}&navigate=yes`;

    tramosContainer.innerHTML += `
      <div class="bg-[#121E32] rounded-xl p-4 border border-[#1E324F]">
        <p class="text-[#00E5FF] font-bold text-sm mb-3 text-center">Tramo ${tramoNum} de ${totalTramos} (${chunk.length} paradas)</p>
        <div class="grid grid-cols-2 gap-3">
          <a href="${mapsUrl}" target="_blank" class="bg-[#00E5FF] text-[#0A1220] font-black py-3 rounded-xl text-center text-sm hover:bg-[#00c8e0] transition-all flex items-center justify-center gap-2">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            GOOGLE MAPS
          </a>
          <a href="${wazeUrl}" target="_blank" class="bg-[#33CCFF] text-white font-black py-3 rounded-xl text-center text-sm hover:bg-[#2ab8e6] transition-all flex items-center justify-center gap-2">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
            WAZE
          </a>
        </div>
      </div>
    `;
  }
});

// Utilidades
async function abrirCamara(){
  const v=document.getElementById('camara'); v.classList.remove('hidden');
  try{ v.srcObject=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}}); }
  catch{ mostrarNotificacion("No se pudo abrir cámara","error"); }
}

const logoMenuBtn=document.getElementById('logoMenuBtn'), logoDropdown=document.getElementById('logoDropdown');
logoMenuBtn?.addEventListener('click',e=>{e.stopPropagation();logoDropdown.classList.toggle('hidden');logoDropdown.classList.toggle('flex')});
document.addEventListener('click',e=>{if(logoDropdown&&!logoDropdown.contains(e.target)&&!logoMenuBtn.contains(e.target)){logoDropdown.classList.add('hidden');logoDropdown.classList.remove('flex')}});
document.getElementById('btnIrPerfil')?.addEventListener('click',()=>{logoDropdown.classList.add('hidden');logoDropdown.classList.remove('flex');mostrarTab('perfil')});

function mostrarPerfil(){
  const email=localStorage.getItem('rutaflex_email')||'usuario@rutaflex.com';
  document.getElementById('perfilNombre').innerText=email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1);
  document.getElementById('perfilEmail').innerText=email;
}

if('serviceWorker' in navigator){ window.addEventListener('load',()=>{ navigator.serviceWorker.register('/service-worker.js',{scope:'/'}).catch(()=>{}); }); }
