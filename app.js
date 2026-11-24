const CONFIG_RUTAFLEX = { whatsapp:"5491135933984", alias:"RUTAFLEX.MP", linkSemanal:"https://mpago.la/2DjaHdB", linkMensual:"https://mpago.la/2aNpJ1B" };
let destinos=[], destinosDetectados=[], estaVencido=false, camaraStream=null, mapaLeaflet=null;
let ubicacionActual = null;
let rutaOptimizada = [];
let tramoActual = 0;
let duplicadosDetectados = [];
let direccionesInvalidas = new Set();
let abriendoReciente = false;

// ============================================================
// NIVEL 1 PRO - REPORTE DE ERRORES CRITICOS (SOLO SISTEMA)
// ============================================================
let erroresCriticos = [];
let ultimoEnvioError = {};
function esErrorDeUsuario(detalle = '') {
  const d = (detalle || '').toLowerCase();
  const ignorar = ['no se encontró','no se encontro','revisá número','revisa numero','duplicada','duplicado','sin ubicación','sin ubicacion','ingresá al menos','pegá algún texto','pega algun texto','imagen sin texto','pdf sin texto','no se detectaron direcciones','no hay direcciones','no hay rutas recientes','sin rutas recientes','no se pudo abrir la cámara','no se pudo obtener dirección','error de conexión','plan vencido','email o contraseña'];
  return ignorar.some(p => d.includes(p));
}
function reportarErrorCritico(tipo, detalle) {
  try {
    if (!tipo || !detalle) return;
    if (esErrorDeUsuario(detalle)) return;
    const ahora = Date.now();
    const usuario = localStorage.getItem('rutaflex_email') || 'anonimo';
    erroresCriticos.push({ tipo, detalle: String(detalle).slice(0,200), hora: ahora, usuario });
    erroresCriticos = erroresCriticos.filter(e => ahora - e.hora < 10*60*1000);
    const recientes = erroresCriticos.filter(e => e.tipo === tipo);
    if (recientes.length >= 3) {
      if (ultimoEnvioError[tipo] && ahora - ultimoEnvioError[tipo] < 15*60*1000) return;
      ultimoEnvioError[tipo] = ahora;
      const usuariosUnicos = [...new Set(recientes.map(r=>r.usuario))];
      const payload = { tipo, detalle: String(detalle).slice(0,300), cantidad: recientes.length, usuarios: usuariosUnicos, fecha: new Date().toISOString(), userAgent: navigator.userAgent.slice(0,150) };
      try { localStorage.setItem('rutaflex_last_critical', JSON.stringify(payload)); } catch {}
      fetch('/api/report-error', { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify(payload) }).catch(()=>{});
      erroresCriticos = erroresCriticos.filter(e => e.tipo !== tipo);
    }
  } catch(e) {}
}
window.addEventListener('error', (e) => {
  const msg = e.message || '';
  if (!msg || esErrorDeUsuario(msg)) return;
  if (msg.includes('Script error') || msg.includes('ResizeObserver')) return;
  reportarErrorCritico('JS_ERROR', msg + ' @ ' + (e.filename||'').split('/').pop());
});
window.addEventListener('unhandledrejection', (e) => {
  const msg = e.reason?.message || String(e.reason||'');
  if (!msg || esErrorDeUsuario(msg)) return;
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) reportarErrorCritico('API_O_FETCH_CAIDO', msg);
  else reportarErrorCritico('PROMISE_RECHAZADA', msg);
});

// ============ UTILIDADES ============
window.togglePass=(id,icon)=>{
  const i=document.getElementById(id);
  if(!i)return;
  i.type=i.type==="password"?"text":"password";
  icon.innerText=i.type==="text"?"🙈":"👁️";
};
function mostrarNotificacion(m,t='info'){
  const c=document.getElementById('notificaciones');
  if(!c)return;
  const n=document.createElement('div');
  n.className=`${t==='exito'?'bg-green-600':t==='error'?'bg-red-600':'bg-[#00E5FF]'} text-white px-6 py-3 rounded-xl font-bold text-sm text-center shadow-xl`;
  n.innerText=m; c.appendChild(n); setTimeout(()=>n.remove(),3500);
}
function ocultarTodasLasPantallasExcepto(id){
  ['authScreen','appScreen','pegarTextoScreen','perfilScreen','payment-modal','modalEdicion','modalMapa'].forEach(s=>{ const el=document.getElementById(s); if(el) el.classList.add('hidden'); });
  document.getElementById(id)?.classList.remove('hidden'); window.scrollTo(0,0);
}
function actualizarNav(tabActivo) {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('text-[#00E5FF]', btn.dataset.tab === tabActivo);
    btn.classList.toggle('text-white/30', btn.dataset.tab !== tabActivo);
  });
}
function mostrarTab(tab, pushState = true) {
  if(tab === 'home') { ocultarTodasLasPantallasExcepto('appScreen'); actualizarNav('home'); if (pushState) history.pushState({tab:'home'}, '', '#home'); }
  if(tab === 'perfil') { ocultarTodasLasPantallasExcepto('perfilScreen'); mostrarPerfil(); actualizarNav('perfil'); if (pushState) history.pushState({tab:'perfil'}, '', '#perfil'); }
  if(tab === 'historial') mostrarNotificacion("🚧 Sección en desarrollo", "info");
}
window.addEventListener('popstate', (e) => { if (e.state && e.state.tab) mostrarTab(e.state.tab, false); else mostrarTab('home', false); });

// ============ CACHE ============
function getCacheCoords(){ try { return JSON.parse(localStorage.getItem('rutaflex_coords_cache') || '{}'); } catch { return {}; } }
function setCacheCoords(direccion, coords){ try { const c = getCacheCoords(); c[normalizarDireccion(direccion)] = coords; localStorage.setItem('rutaflex_coords_cache', JSON.stringify(c)); } catch {} }

// ============ GPS ============
async function obtenerUbicacionActual() {
  if (ubicacionActual && (Date.now() - ubicacionActual.timestamp < 300000)) return ubicacionActual.coords;
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve({ lat: -34.6037, lon: -58.3816 }); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { ubicacionActual = { coords: { lat: pos.coords.latitude, lon: pos.coords.longitude }, timestamp: Date.now() }; resolve(ubicacionActual.coords); },
      (err) => { console.warn('GPS error:', err); resolve({ lat: -34.6037, lon: -58.3816 }); },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  });
}

// ============ MOTOR DIRECCIONES - CORREGIDO ============
function limpiarTextoSucio(t) {
  return t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').replace(/\b(hola|buen dia|buenas|che|capo|dale|gracias|mañana|hoy|como estas|favor|por favor|ok|listo|avisame|envio|entrega|reparto|turno|pedido|factura|urgente|importante|recordar)\b/gi, '').replace(/\b\d{2,4}[- ]?\d{3,4}[- ]?\d{4}\b/g, '').replace(/\b11[- ]?\d{4}[- ]?\d{4}\b/g, '').replace(/\$\s?\d+([.,]\d+)?/g, '').replace(/\s{2,}/g, ' ').trim();
}
function normalizarDireccion(d) {
  let s = (d||'').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[.,#\-]/g," ").replace(/\s+/g," ").trim();
  s = s.replace(/^(palermo|belgrano|nunez|caballito|recoleta|la boca|centro|san telmo|villa crespo|almagro|flores|barracas|san nicolas|retiro)\s+/g, "");
  s = s.replace(/\s+av$/,"").replace(/\s+avenida$/,"");
  s = s.replace(/\b(av|avenida|avda)\b/g,"av").replace(/\b(calle)\b/g,"").replace(/\s+/g," ").trim();
  const correcciones = { "arribenos":"", "arribennos":"" };
  Object.keys(correcciones).forEach(k=>{ if(correcciones[k]==="") s = s.replace(new RegExp("\\b"+k+"\\b","g"),""); });
  return s.replace(/\s+/g," ").trim();
}
function claveDuplicado(d){
  const n = normalizarDireccion(d);
  const m = n.match(/([a-z\s]+?)\s+(\d{1,5})/);
  if(m) return m[1].trim().replace(/\s+/g," ") + " " + m[2];
  return n;
}
function detectarDuplicados(lista) {
  const vistos = new Map(); const dups = []; const unicas = [];
  lista.forEach((dir, idx) => { const norm = claveDuplicado(dir); if (vistos.has(norm)) { dups.push({ original: dir, indice: idx, primeraVez: vistos.get(norm) }); } else { vistos.set(norm, idx); unicas.push(dir); } });
  return { unicas, dups };
}
function quitarDuplicadosDeLista(lista){
  const vistos = new Set(); const out = [];
  (lista||[]).forEach(d=>{
    const k = claveDuplicado(typeof d==='string'? d : (d.direccion||d.texto||''));
    if(!vistos.has(k)){ vistos.add(k); out.push(d); }
  });
  return out;
}
function extraerDirecciones(texto) {
  const lineas = texto.split(/[\n;]+/).map(l => l.trim()).filter(l => l.length > 5);
  const direcciones = [];
  const regexDir = /(?:^|\s)(?:Av\.?|Avenida|Avda\.?|Calle|Pasaje|Pje\.?|Bv\.?|Bulevar|Cam\.?|Rambla|Rua|R\.?)?\s*[A-Za-zÁÉÍÓÚáéíóúÑñ][A-Za-zÁÉÍÓÚáéíóúÑñ\.\s]{2,30}?\s+\d{1,5}[A-Za-z]?(?:\s*(?:bis|BIS|b|º|°|\/\d+))?(?:\s*,\s*[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+)?/gi;
  lineas.forEach(linea => {
    const limpia = limpiarTextoSucio(linea);
    if(!limpia) return;
    const matches = [...limpia.matchAll(regexDir)].map(m=>m[0].replace(/\s+/g,' ').trim()).filter(x=>x.length>6 && /\d/.test(x));
    if(matches.length>0){
      direcciones.push(matches[0]);
    } else if (/\d{1,5}/.test(limpia) && limpia.length > 6 && limpia.length < 80 && /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(limpia)) {
      direcciones.push(limpia);
    }
  });
  return quitarDuplicadosDeLista(direcciones).map(d=>typeof d==='string'?d:d.texto).slice(0, 100);
}
function generarVariantesDireccion(direccionOriginal){
  const base = (direccionOriginal||'').trim();
  const sinBarrioExtra = base.replace(/^(Palermo|Belgrano|Núñez|Nunez|La Boca|Centro|Recoleta|Caballito)\s+/i,'').replace(/\s+(Av|Av\.|Avenida)\s*$/i,'').trim();
  const limpio = sinBarrioExtra.replace(/Arribenos|Arribennos/gi,'').replace(/\s{2,}/g,' ').replace(/,\s*,/g,',').trim();
  const variantes = [];
  const push = v => { v=v.trim().replace(/^,|,$/g,'').trim(); if(v && !variantes.includes(v)) variantes.push(v); };
  push(limpio + ", CABA, Buenos Aires, Argentina");
  push(limpio + ", Buenos Aires, Argentina");
  push(base + ", CABA, Buenos Aires, Argentina");
  push(base + ", Buenos Aires, Argentina");
  const sinComa = limpio.split(',')[0].trim();
  push(sinComa + ", CABA, Buenos Aires, Argentina");
  return variantes;
}

// ============ OCR ============
function preprocesarImagen(img) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); const maxDim = 1600; let w = img.width, h = img.height;
    if (w > maxDim || h > maxDim) { const r = maxDim / Math.max(w, h); w = Math.round(w*r); h = Math.round(h*r); }
    canvas.width = w; canvas.height = h; ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h); const d = data.data; let min = 255, max = 0; const grises = new Uint8ClampedArray(w*h);
    for (let i = 0; i < w*h; i++) { const g = Math.round(0.299*d[i*4] + 0.587*d[i*4+1] + 0.114*d[i*4+2]); grises[i] = g; if (g < min) min = g; if (g > max) max = g; }
    const rango = Math.max(1, max - min);
    for (let i = 0; i < w*h; i++) { let g = ((grises[i] - min) * 255 / rango); g = g < 100 ? 0 : 255; d[i*4] = d[i*4+1] = d[i*4+2] = g; d[i*4+3] = 255; }
    ctx.putImageData(data, 0, 0); resolve(canvas.toDataURL('image/png'));
  });
}
async function procesarImagenOCR(src) {
  if (typeof Tesseract === 'undefined') { reportarErrorCritico('OCR_NO_CARGO', 'Tesseract no cargado'); throw new Error('Librería no cargada'); }
  try {
    const img = new Image(); img.crossOrigin = 'anonymous';
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
    const procesada = await preprocesarImagen(img);
    const worker = await Tesseract.createWorker('spa', 1, { logger: m => { if (m.status === 'recognizing text') console.log(`${Math.round(m.progress*100)}%`); } });
    await worker.setParameters({ tessedit_pageseg_mode: '6' });
    const { data: { text } } = await worker.recognize(procesada); await worker.terminate();
    if (!text || text.trim().length < 5) throw new Error('Imagen sin texto legible'); return text;
  } catch(e) { if (!esErrorDeUsuario(e.message)) reportarErrorCritico('OCR_FALLO', e.message); throw e; }
}
async function procesarPDF(file) {
  if (typeof pdfjsLib === 'undefined') { reportarErrorCritico('PDF_NO_CARGO', 'pdfjsLib no cargado'); throw new Error('PDF.js no cargado'); }
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    const arrayBuffer = await file.arrayBuffer(); const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise; let texto = '';
    for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) { const page = await pdf.getPage(i); const content = await page.getTextContent(); texto += content.items.map(it => it.str).join(' ') + '\n'; }
    if (texto.trim().length < 5) throw new Error('PDF sin texto seleccionable'); return texto;
  } catch(e) { if (!esErrorDeUsuario(e.message)) reportarErrorCritico('PDF_FALLO', e.message); throw e; }
}

// ============ RUTAFLEX V2 ============
function distanciaKm(a, b) {
  const R = 6371; const dLat = (b.lat - a.lat) * Math.PI / 180; const dLon = (b.lon - a.lon) * Math.PI / 180;
  const x = Math.sin(dLat/2)**2 + Math.cos(a.lat*Math.PI/180) * Math.cos(b.lat*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.asin(Math.sqrt(x));
}
async function geocodificar(direccion) {
  const cache = getCacheCoords();
  const key = normalizarDireccion(direccion);
  if (cache[key]) return cache[key];
  const variantes = generarVariantesDireccion(direccion);
  for (const variante of variantes) {
    try {
      const q = encodeURIComponent(variante);
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`);
      if (!r.ok) { reportarErrorCritico('NOMINATIM_HTTP', 'Nominatim status ' + r.status); return null; }
      const data = await r.json();
      if (data && data[0]) {
        const lat = parseFloat(data[0].lat), lon = parseFloat(data[0].lon);
        const distBA = distanciaKm({lat:-34.6037, lon:-58.3816}, {lat, lon});
        const res = distBA > 200 ? { lat, lon, dudosa: true, display: data[0].display_name, corregida: variante, original: direccion } : { lat, lon, dudosa: false, display: data[0].display_name, corregida: variante, original: direccion };
        setCacheCoords(direccion, res); return res;
      }
    } catch(e) { if (e.message && (e.message.includes('fetch') || e.message.includes('Network'))) reportarErrorCritico('NOMINATIM_CAIDO', e.message); }
    await new Promise(r=>setTimeout(r,80));
  }
  return null;
}
function mejorarRuta(ruta) {
  try {
    for (let k = 0; k < 2; k++) {
      for (let i = 1; i < ruta.length - 2; i++) {
        for (let j = i + 1; j < ruta.length - 1; j++) {
          const a = ruta[i-1], b = ruta[i], c = ruta[j], d = ruta[j+1];
          if (!a.lat || !b.lat || !c.lat || !d.lat) continue;
          const antes = distanciaKm(a,b) + distanciaKm(c,d); const despues = distanciaKm(a,c) + distanciaKm(b,d);
          if (despues < antes) ruta.splice(i, j-i+1, ...ruta.slice(i, j+1).reverse());
        }
      }
    }
  } catch(e) { reportarErrorCritico('OPTIMIZADOR_FALLO', e.message); }
  return ruta;
}
window.abrirRecienteRapido = function(){
  if (abriendoReciente) return;
  abriendoReciente = true; setTimeout(()=>{ abriendoReciente = false; }, 800);
  try {
    const g = localStorage.getItem('rutaflex_ruta');
    if (g) { const data = JSON.parse(g); if (data.ordenadas && data.ordenadas.length > 0) { rutaOptimizada = quitarDuplicadosDeLista(data.ordenadas); tramoActual = data.tramo || 0; mostrarPantallaTramos(data.gps || {lat:-34.6037, lon:-58.3816}); return; } }
  } catch(e) { reportarErrorCritico('RECIENTE_CORRUPTO', e.message); }
  if (destinos.length > 0) { comenzarViaje(); return; }
  mostrarNotificacion("⚠️ No hay rutas recientes", "error");
};
window.eliminarReciente = function(){
  if (!confirm("¿Eliminar esta ruta reciente?")) return;
  localStorage.removeItem('rutaflex_ruta'); rutaOptimizada = []; tramoActual = 0; destinos = [];
  const titulo = document.getElementById('recienteTitulo'); const sub = document.getElementById('recienteSub');
  if (titulo) titulo.innerText = "Sin rutas recientes"; if (sub) sub.innerText = "Creá tu primera ruta";
  document.getElementById('bannerContinuarRuta')?.classList.add('hidden'); mostrarNotificacion("🗑️ Ruta eliminada", "exito");
};
window.borrarTodoHistorial = function(){
  if (!confirm("¿Borrar TODO el historial? Se van a eliminar la ruta guardada y las coordenadas guardadas.")) return;
  localStorage.removeItem('rutaflex_ruta'); localStorage.removeItem('rutaflex_coords_cache'); rutaOptimizada = []; tramoActual = 0; destinos = [];
  const titulo = document.getElementById('recienteTitulo'); const sub = document.getElementById('recienteSub');
  if (titulo) titulo.innerText = "Sin rutas recientes"; if (sub) sub.innerText = "Creá tu primera ruta";
  document.getElementById('bannerContinuarRuta')?.classList.add('hidden'); mostrarNotificacion("🗑️ Historial borrado", "exito");
};
async function comenzarViaje() {
  if (destinos.length === 0) return mostrarNotificacion("⚠️ No hay direcciones cargadas", "error");
  try {
    destinos = quitarDuplicadosDeLista(destinos);
    mostrarNotificacion("📍 Obteniendo tu ubicación...", "info");
    const gps = await obtenerUbicacionActual();
    mostrarNotificacion("🧭 Ordenando de la más cercana a la más lejana...", "info");
    let conCoords = []; let fallaronGeo = 0; let corregidasAuto = 0;
    for (let idx=0; idx<destinos.length; idx++) {
      const d = destinos[idx]; const texto = d.direccion || d.dirección || '';
      const c = await geocodificar(texto);
      if (!c) fallaronGeo++;
      if (c && c.corregida && normalizarDireccion(c.corregida) !== normalizarDireccion(texto + ", CABA, Buenos Aires, Argentina")) corregidasAuto++;
      conCoords.push({ texto, textoOriginal: texto, lat: c ? c.lat : null, lon: c ? c.lon : null, dudosa: c ? c.dudosa : false, sinUbicacion: !c, corregida: c ? c.corregida : null, indiceOriginal: idx });
      const barra = document.getElementById('barraProgreso'); const txtP = document.getElementById('textoProgreso');
      if (barra) barra.style.width = Math.round(((idx+1)/destinos.length)*100)+'%';
      if (txtP) txtP.innerText = `${idx+1} de ${destinos.length} direcciones ubicadas...`;
      await new Promise(r => setTimeout(r, 60));
    }
    if (destinos.length >= 5 && fallaronGeo === destinos.length) {
      reportarErrorCritico('NOMINATIM_CAIDO', `Fallaron ${fallaronGeo}/${destinos.length} geocodificaciones en comenzarViaje`);
      mostrarNotificacion("⚠️ No pudimos ubicar ninguna. Probá de nuevo en unos minutos", "error"); return;
    }
    if (destinos.length >= 10 && fallaronGeo / destinos.length > 0.9) reportarErrorCritico('NOMINATIM_PARCIAL', `Fallaron ${fallaronGeo}/${destinos.length} geocodificaciones`);
    let ordenadas = []; let actual = { lat: gps.lat, lon: gps.lon };
    let pendientes = conCoords.filter(c => c.lat !== null);
    let sinCoords = conCoords.filter(c => c.lat === null);
    while (pendientes.length > 0) {
      let mejorIdx = 0, mejorDist = Infinity;
      pendientes.forEach((p, i) => { const dist = distanciaKm(actual, p); if (dist < mejorDist) { mejorDist = dist; mejorIdx = i; } });
      const elegida = pendientes.splice(mejorIdx, 1)[0]; elegida.distDesdeAnterior = mejorDist; ordenadas.push(elegida); actual = elegida;
    }
    ordenadas = mejorarRuta(ordenadas);
    if (sinCoords.length > 0) {
      sinCoords.forEach(s => {
        const pos = Math.min(s.indiceOriginal, ordenadas.length);
        ordenadas.splice(pos, 0, s);
      });
    }
    ordenadas = quitarDuplicadosDeLista(ordenadas);
    rutaOptimizada = ordenadas; tramoActual = 0;
    try { localStorage.setItem('rutaflex_ruta', JSON.stringify({ gps, ordenadas, tramo: 0, fecha: Date.now() })); } catch(e) { reportarErrorCritico('GUARDADO_RUTA_FALLO', e.message); }
    destinos = ordenadas.map(o => ({ direccion: o.texto }));
    mostrarPantallaTramos(gps);
    const dudosas = ordenadas.filter(o=>o.dudosa).length;
    const sinUb = ordenadas.filter(o=>o.sinUbicacion).length;
    if (sinUb>0) mostrarNotificacion(`⚠️ ${sinUb} sin ubicación quedaron en su lugar en rojo - tocalas para corregir`, "error");
    else if (dudosas>0) mostrarNotificacion(`⚠️ ${dudosas} direcciones parecen de otra zona, revisalas`, "error");
    else if (corregidasAuto>0) mostrarNotificacion(`✅ ${corregidasAuto} direcciones corregidas automáticamente`, "exito");
    else mostrarNotificacion(`🚀 Lista lista: ${ordenadas.length} paradas ordenadas`, "exito");
  } catch(e) { if (!esErrorDeUsuario(e.message)) reportarErrorCritico('COMENZAR_VIAJE_FALLO', e.message); mostrarNotificacion("❌ No se pudo armar la ruta, intentá de nuevo", "error"); }
}
function mostrarPantallaTramos(gps) {
  try {
    rutaOptimizada = quitarDuplicadosDeLista(rutaOptimizada);
    const totalTramos = Math.ceil(rutaOptimizada.length / 9);
    const tramosContainer = document.getElementById('tramosContainer'); if (!tramosContainer) return;
    tramosContainer.innerHTML = '';
    const listaEl = document.getElementById('listaPegadas');
    if (listaEl) {
      listaEl.innerHTML = '';
      rutaOptimizada.forEach((d, i) => {
        const numTramo = Math.floor(i / 9) + 1;
        const esDudosa = d.dudosa ? 'border-red-500/50' : 'border-white/10';
        const aviso = d.dudosa ? '<p class="text-xs text-red-400 font-bold">⚠️ Verificar - parece de otra zona</p>' : '';
        const sinCoord = (!d.lat || d.sinUbicacion) ? '<p class="text-xs text-yellow-400 font-bold">⚠️ Sin ubicación - quedó en su lugar, tocá para corregir</p>' : '';
        const corregidaTxt = d.corregida && d.textoOriginal && d.corregida !== d.textoOriginal ? `<p class="text-xs text-green-400 font-bold">✅ Corregida automáticamente</p>` : '';
        listaEl.innerHTML += `<div class="bg-[#111C31]/80 rounded-xl p-3 flex gap-3 items-center border ${esDudosa}"><div class="w-8 h-8 rounded-full bg-[#00E5FF] text-[#0A1220] font-black flex items-center justify-center text-sm">${i+1}</div><div class="flex-1 min-w-0"><p class="font-bold text-sm text-white truncate">${d.texto}</p><p class="text-xs text-white/50">Tramo ${numTramo} • ${d.distDesdeAnterior ? d.distDesdeAnterior.toFixed(1)+' km desde anterior' : ''}</p>${aviso}${sinCoord}${corregidaTxt}</div></div>`;
      });
    }
    const esPrimero = tramoActual === 0;
    tramosContainer.innerHTML += `
      <div class="bg-[#00E5FF] rounded-xl p-4 mb-3 text-center">
        <p class="text-[#0A1220] font-black text-base">${esPrimero ? '▶️ EMPEZAR RECORRIDO' : '➡️ CONTINUAR CON TRAMO ' + (tramoActual+1) + ' de ' + totalTramos}</p>
        <p class="text-[#0A1220]/70 text-xs font-bold mt-1">Tramo ${tramoActual+1} de ${totalTramos} • Paradas ${tramoActual*9+1} a ${Math.min((tramoActual+1)*9, rutaOptimizada.length)}</p>
        <button onclick="abrirTramoActual()" class="bg-[#0A1220] text-white font-black py-4 px-6 rounded-xl w-full mt-3 text-sm">ABRIR EN GOOGLE MAPS</button>
        <p class="text-[#0A1220]/70 text-xs mt-2">Cuando termines este tramo, volvé acá y apretá continuar</p>
      </div>
      <button onclick="reoptimizarDesdeAqui()" class="w-full bg-[#111C31]/80 border border-[#00E5FF]/40 text-[#00E5FF] font-bold py-3 rounded-xl text-sm mb-3">🔄 RE-OPTIMIZAR DESDE DONDE ESTOY AHORA</button>
      <p class="text-center text-white/50 text-xs mb-1">Usalo si te agregaron direcciones nuevas o te desviaste. Reordena solo lo que te falta desde tu GPS actual.</p>
      <div class="text-center text-white/60 text-xs mb-3">Todos los tramos ya quedaron guardados y ordenados</div>`;
    const r = document.getElementById('pegarTextoResult'); if (r) r.classList.remove('hidden');
    const rv = document.getElementById('resumenValidas'); if (rv) rv.innerText = rutaOptimizada.length;
    const rd = document.getElementById('resumenDescartadas'); if (rd) rd.innerText = '0';
    const spp = document.getElementById('statParadasPegadas'); if (spp) spp.innerText = rutaOptimizada.length;
    let distTotal = rutaOptimizada.reduce((a,o)=>a+(o.distDesdeAnterior||0),0);
    const sdp = document.getElementById('statDistanciaPegadas'); if (sdp) sdp.innerText = '~'+distTotal.toFixed(1)+' km';
    const stp = document.getElementById('statTiempoPegadas'); if (stp) stp.innerText = '~'+Math.round(distTotal/0.5)+' min';
    ocultarTodasLasPantallasExcepto('pegarTextoScreen');
  } catch(e) { reportarErrorCritico('MOSTRAR_TRAMOS_FALLO', e.message); }
}
window.abrirTramoActual = function() {
  try {
    const i = tramoActual * 9; const tramo = rutaOptimizada.slice(i, i+9);
    if (tramo.length === 0) return mostrarNotificacion("✅ ¡Recorrido terminado!", "exito");
    let origen;
    if (tramoActual === 0) { const guardado = JSON.parse(localStorage.getItem('rutaflex_ruta') || '{}'); origen = guardado.gps ? `${guardado.gps.lat},${guardado.gps.lon}` : encodeURIComponent("Mi ubicación"); }
    else { const anterior = rutaOptimizada[i-1]; origen = anterior.lat ? `${anterior.lat},${anterior.lon}` : encodeURIComponent(anterior.texto); }
    const destinoFinal = tramo[tramo.length-1];
    if (!destinoFinal || (!destinoFinal.texto && !destinoFinal.lat)) { reportarErrorCritico('MAPS_SIN_DESTINO', 'Tramo sin destino final'); return mostrarNotificacion("❌ Este tramo no tiene destino", "error"); }
    const destination = destinoFinal.lat ? `${destinoFinal.lat},${destinoFinal.lon}` : encodeURIComponent(destinoFinal.texto);
    const waypoints = tramo.slice(0,-1).map(d => d.lat ? `${d.lat},${d.lon}` : encodeURIComponent(d.texto)).join('|');
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origen}&destination=${destination}&waypoints=${waypoints}&travelmode=driving`;
    if (!url.includes('destination=')) { reportarErrorCritico('MAPS_URL_MALFORMADA', 'URL de Maps sin destination'); return mostrarNotificacion("❌ No se pudo armar el link de Maps", "error"); }
    tramoActual++;
    const guardadoPrevio = JSON.parse(localStorage.getItem('rutaflex_ruta')||'{}');
    localStorage.setItem('rutaflex_ruta', JSON.stringify({ gps: guardadoPrevio.gps, ordenadas: rutaOptimizada, tramo: tramoActual, fecha: Date.now() }));
    setTimeout(() => { if (tramoActual < Math.ceil(rutaOptimizada.length/9)) { const g = JSON.parse(localStorage.getItem('rutaflex_ruta')||'{}'); mostrarPantallaTramos(g.gps); mostrarNotificacion(`✅ Tramo ${tramoActual} listo. Seguí con Tramo ${tramoActual+1}`, "exito"); } else mostrarNotificacion("🎉 ¡Recorrido completo!", "exito"); }, 1000);
    const win = window.open(url, '_blank'); if (!win) reportarErrorCritico('MAPS_BLOQUEADO', 'window.open bloqueado por navegador');
  } catch(e) { reportarErrorCritico('MAPS_NO_ABRE', e.message); mostrarNotificacion("❌ No se pudo abrir Google Maps", "error"); }
};
window.reoptimizarDesdeAqui = async function() {
  if (rutaOptimizada.length === 0) return mostrarNotificacion("⚠️ No hay ruta activa", "error");
  try {
    mostrarNotificacion("📍 Obteniendo tu ubicación actual...", "info"); ubicacionActual = null;
    const gpsNuevo = await obtenerUbicacionActual(); const yaHechas = tramoActual * 9;
    if (yaHechas >= rutaOptimizada.length) return mostrarNotificacion("✅ Ya terminaste toda la ruta", "exito");
    const hechas = rutaOptimizada.slice(0, yaHechas); let falta = rutaOptimizada.slice(yaHechas);
    let reordenadas = []; let actual = { lat: gpsNuevo.lat, lon: gpsNuevo.lon }; let pendientes = falta.filter(c=>c.lat!==null); let sinCoords = falta.filter(c=>c.lat===null);
    while (pendientes.length > 0) { let mejorIdx=0, mejorDist=Infinity; pendientes.forEach((p,i)=>{ const dist=distanciaKm(actual,p); if(dist<mejorDist){mejorDist=dist; mejorIdx=i;} }); const elegida = pendientes.splice(mejorIdx,1)[0]; elegida.distDesdeAnterior = mejorDist; reordenadas.push(elegida); actual = elegida; }
    reordenadas = mejorarRuta(reordenadas);
    sinCoords.forEach((s,idx)=>{ const pos = Math.min(idx, reordenadas.length); reordenadas.splice(pos,0,s); });
    reordenadas = quitarDuplicadosDeLista(reordenadas);
    rutaOptimizada = [...hechas, ...reordenadas];
    localStorage.setItem('rutaflex_ruta', JSON.stringify({ gps: gpsNuevo, ordenadas: rutaOptimizada, tramo: tramoActual, fecha: Date.now() }));
    mostrarPantallaTramos(gpsNuevo); mostrarNotificacion(`🔄 Re-ordenado desde donde estás: quedan ${falta.length} paradas`, "exito");
  } catch(e) { reportarErrorCritico('REOPTIMIZAR_FALLO', e.message); }
};
window.quitarDuplicados = function() {
  const inputs = [...document.querySelectorAll('.input-direccion')]; const vistos = new Set(); let quitados = 0;
  inputs.forEach(inp => { const norm = claveDuplicado(inp.value.trim()); if (vistos.has(norm)) { inp.closest('div').remove(); quitados++; } else vistos.add(norm); });
  destinosDetectados = [...document.querySelectorAll('.input-direccion')].map(i=>i.value.trim());
  document.querySelectorAll('.input-direccion').forEach((inp, idx) => { const num = inp.closest('div').querySelector('span'); if(num) num.innerText = idx+1; });
  mostrarNotificacion(`✅ Se quitaron ${quitados} duplicados`, "exito"); document.getElementById('alertaDuplicados')?.remove();
};
document.getElementById('fileImg')?.addEventListener('change', async (e) => {
  if (estaVencido) return mostrarNotificacion("⚠️ Plan vencido", "error");
  const file = e.target.files[0]; if (!file) return;
  if (!file.type.startsWith('image/')) return mostrarNotificacion("⚠️ Archivo inválido", "error");
  if (file.size > 10*1024*1024) return mostrarNotificacion("⚠️ Imagen muy grande (máx 10MB)", "error");
  mostrarNotificacion("🤖 Leyendo imagen...", "info");
  try { const url = URL.createObjectURL(file); const texto = await procesarImagenOCR(url); URL.revokeObjectURL(url); const direcciones = extraerDirecciones(limpiarTextoSucio(texto)); if (direcciones.length === 0) throw new Error('No se detectaron direcciones'); destinosDetectados = quitarDuplicadosDeLista(direcciones); mostrarModalEdicionConGPS(); }
  catch(err) { if (!esErrorDeUsuario(err.message)) reportarErrorCritico('OCR_FALLO', err.message); mostrarNotificacion(`❌ ${err.message}`, "error"); } finally { e.target.value = ''; }
});
document.getElementById('filePdf')?.addEventListener('change', async (e) => {
  if (estaVencido) return mostrarNotificacion("⚠️ Plan vencido", "error");
  const file = e.target.files[0]; if (!file) return; mostrarNotificacion("📄 Leyendo PDF...", "info");
  try { const texto = await procesarPDF(file); const direcciones = extraerDirecciones(limpiarTextoSucio(texto)); if (direcciones.length === 0) throw new Error('No se detectaron direcciones'); destinosDetectados = quitarDuplicadosDeLista(direcciones); mostrarModalEdicionConGPS(); }
  catch(err) { if (!esErrorDeUsuario(err.message)) reportarErrorCritico('PDF_FALLO', err.message); mostrarNotificacion(`❌ ${err.message}`, "error"); } finally { e.target.value = ''; }
});
document.getElementById('btnCamara')?.addEventListener('click', async () => {
  const panel = document.getElementById('panelCamara'); const v = document.getElementById('camara'); panel.classList.remove('hidden');
  try { camaraStream = await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment", width:{ideal:1920}}}); v.srcObject = camaraStream; }
  catch { panel.classList.add('hidden'); mostrarNotificacion("❌ No se pudo abrir la cámara", "error"); }
});
document.getElementById('btnCerrarCamara')?.addEventListener('click', () => { if (camaraStream) camaraStream.getTracks().forEach(t => t.stop()); document.getElementById('panelCamara').classList.add('hidden'); });
document.getElementById('btnCapturar')?.addEventListener('click', async () => {
  const v = document.getElementById('camara'); const canvas = document.createElement('canvas'); canvas.width = v.videoWidth; canvas.height = v.videoHeight; canvas.getContext('2d').drawImage(v, 0, 0);
  if (camaraStream) camaraStream.getTracks().forEach(t => t.stop()); document.getElementById('panelCamara').classList.add('hidden'); mostrarNotificacion("🤖 Procesando foto...", "info");
  try { const texto = await procesarImagenOCR(canvas.toDataURL('image/png')); const direcciones = extraerDirecciones(limpiarTextoSucio(texto)); if (direcciones.length === 0) throw new Error('No se detectaron direcciones'); destinosDetectados = quitarDuplicadosDeLista(direcciones); mostrarModalEdicionConGPS(); }
  catch(err) { if (!esErrorDeUsuario(err.message)) reportarErrorCritico('OCR_FALLO', err.message); mostrarNotificacion(`❌ ${err.message}`, "error"); }
});
document.getElementById('btnMapa')?.addEventListener('click', async () => {
  document.getElementById('modalMapa').classList.remove('hidden'); await new Promise(r => setTimeout(r, 100));
  if (!mapaLeaflet) {
    try {
      const gps = await obtenerUbicacionActual(); mapaLeaflet = L.map('mapaLeaflet').setView([gps.lat, gps.lon], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19}).addTo(mapaLeaflet);
      L.marker([gps.lat, gps.lon]).addTo(mapaLeaflet).bindPopup('📍 Tu ubicación').openPopup();
      mapaLeaflet.on('click', async (e) => {
        try { const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${e.latlng.lat}&lon=${e.latlng.lon}`); const d = await r.json(); const dir = d.display_name?.split(',').slice(0,2).join(', ') || `${e.latlng.lat.toFixed(4)}, ${e.latlng.lon.toFixed(4)}`; destinosDetectados.push(dir); mostrarNotificacion(`✅ ${dir}`, "exito"); L.marker([e.latlng.lat, e.latlng.lon]).addTo(mapaLeaflet); }
        catch { mostrarNotificacion("❌ No se pudo obtener dirección", "error"); }
      });
    } catch(e) { reportarErrorCritico('MAPA_LEAFLET_FALLO', e.message); }
  }
  setTimeout(() => mapaLeaflet.invalidateSize(), 200);
});
document.getElementById('btnCerrarMapa')?.addEventListener('click', () => { document.getElementById('modalMapa').classList.add('hidden'); });
document.getElementById('btnMiUbicacion')?.addEventListener('click', async () => { const gps = await obtenerUbicacionActual(); if (mapaLeaflet) mapaLeaflet.setView([gps.lat, gps.lon], 16); });
document.getElementById('btnListoMapa')?.addEventListener('click', () => { document.getElementById('modalMapa').classList.add('hidden'); if (destinosDetectados.length > 0) mostrarModalEdicionConGPS(); });
function mostrarModalEdicionConGPS() {
  const c = document.getElementById('contenedorInputs'); c.innerHTML = '';
  destinosDetectados = quitarDuplicadosDeLista(destinosDetectados);
  const { unicas, dups } = detectarDuplicados(destinosDetectados); duplicadosDetectados = dups;
  if (dups.length > 0) { c.innerHTML += `<div id="alertaDuplicados" class="bg-yellow-500/20 border border-yellow-500/40 rounded-xl p-3 mb-2"><p class="text-yellow-300 font-bold text-sm">⚠️ Encontré ${dups.length} duplicadas</p><p class="text-yellow-200/80 text-xs mt-1">${dups.slice(0,3).map(d=>d.original).join('<br>')}${dups.length>3 ? '<br>...' : ''}</p><button onclick="quitarDuplicados()" class="w-full mt-2 bg-yellow-500 text-black font-black py-2 rounded-lg text-sm">QUITAR DUPLICADAS Y DEJAR UNA SOLA</button></div>`; }
  destinosDetectados.forEach((dir, i) => {
    const norm = claveDuplicado(dir); const esDup = dups.some(d=>claveDuplicado(d.original)===norm && d.indice===i);
    const claseDup = esDup ? 'border-yellow-500/60 bg-yellow-500/10' : 'border-white/10 bg-[#0A1220]/80';
    c.innerHTML += `<div class="flex gap-2 items-start ${claseDup} p-3 rounded-xl border"><span class="bg-[#00E5FF] text-[#0A1220] rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold mt-1 flex-shrink-0">${i+1}</span><div class="flex-1 min-w-0"><input type="text" value="${dir.replace(/"/g,'&quot;')}" class="input-direccion w-full bg-[#111C31]/80 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"><p class="texto-validacion text-xs mt-1 hidden font-bold"></p></div><button onclick="eliminarLinea(${i})" class="text-red-400 p-2">🗑️</button></div>`;
  });
  document.getElementById('modalEdicion').classList.remove('hidden'); validarDireccionesEnModal();
}
async function validarDireccionesEnModal() {
  const inputs = [...document.querySelectorAll('.input-direccion')];
  for (let idx=0; idx<inputs.length; idx++) {
    const inp = inputs[idx]; const texto = inp.value.trim(); if (!texto) continue;
    const c = await geocodificar(texto); const aviso = inp.parentElement.querySelector('.texto-validacion'); if (!aviso) continue;
    if (!c) { aviso.classList.remove('hidden'); aviso.className = 'texto-validacion text-xs mt-1 font-bold text-red-400'; aviso.innerText = '❌ No se encontró - revisá número y localidad'; inp.style.borderColor = '#ef4444'; }
    else if (c.dudosa) { aviso.classList.remove('hidden'); aviso.className = 'texto-validacion text-xs mt-1 font-bold text-yellow-400'; aviso.innerText = '⚠️ Parece de otra zona: ' + (c.display?.split(',').slice(0,2).join(', ') || ''); inp.style.borderColor = '#eab308'; }
    else { aviso.classList.remove('hidden'); aviso.className = 'texto-validacion text-xs mt-1 font-bold text-green-400'; aviso.innerText = '✅ Ubicada'; inp.style.borderColor = ''; }
    await new Promise(r=>setTimeout(r,100));
  }
}
// FIX FINAL: Guardar con REEMPLAZAR, no con for + POST individual (eso triplicaba)
document.getElementById('btnGuardarEdicion')?.addEventListener('click', async () => {
  const dirs = document.querySelectorAll('.input-direccion'); const finales = [...dirs].map(d => d.value.trim()).filter(d => d.length > 3);
  if (finales.length === 0) return mostrarNotificacion("Ingresá al menos una", "error");
  const check = detectarDuplicados(finales); let aGuardar = quitarDuplicadosDeLista(finales);
  if (check.dups.length > 0) { const ok = confirm(`Encontré ${check.dups.length} direcciones duplicadas. ¿Querés guardar sin duplicados?`); if (ok) aGuardar = check.unicas; }
  const btn = document.getElementById('btnGuardarEdicion'); btn.innerText = "💾 Guardando..."; btn.disabled = true;
  try {
    const rReemplazar = await fetch('/api/destinos/reemplazar', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      credentials: 'include',
      body: JSON.stringify({ direcciones: aGuardar })
    });
    if (!rReemplazar.ok) throw new Error('Error al guardar ruta');
    const resp = await rReemplazar.json().catch(()=>({}));
    mostrarNotificacion(`✅ ${resp.cantidad || aGuardar.length} direcciones guardadas`, "exito");
    document.getElementById('modalEdicion').classList.add('hidden'); destinosDetectados = []; await cargarDestinos(); setTimeout(() => comenzarViaje(), 500);
  } catch(e) { if (!esErrorDeUsuario(e.message)) reportarErrorCritico('API_DESTINOS_CAIDO', e.message); mostrarNotificacion("❌ Error al guardar", "error"); } finally { btn.innerText = "✅ Guardar"; btn.disabled = false; }
});
window.eliminarLinea = (i) => { destinosDetectados.splice(i, 1); const c = document.getElementById('contenedorInputs'); const inputs = c.querySelectorAll('.input-direccion'); if (inputs[i]) inputs[i].closest('div').remove(); c.querySelectorAll('.input-direccion').forEach((inp, idx) => { const num = inp.closest('div').querySelector('span'); if (num) num.innerText = idx + 1; }); };
document.getElementById('btnAgregarLinea')?.addEventListener('click', () => {
  destinosDetectados.push(''); const c = document.getElementById('contenedorInputs'); const idx = c.querySelectorAll('.input-direccion').length;
  const div = document.createElement('div'); div.className = 'flex gap-2 items-start bg-[#0A1220]/80 p-3 rounded-xl border border-white/10';
  div.innerHTML = `<span class="bg-[#00E5FF] text-[#0A1220] rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold mt-1 flex-shrink-0">${idx+1}</span><input type="text" value="" class="input-direccion flex-1 bg-[#111C31]/80 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"><button onclick="eliminarLinea(${idx})" class="text-red-400 p-2">🗑️</button>`; c.appendChild(div);
});
document.getElementById('btnCancelarEdicion')?.addEventListener('click', () => { document.getElementById('modalEdicion').classList.add('hidden'); destinosDetectados = []; });
document.getElementById('btnCerrarModal')?.addEventListener('click', () => { document.getElementById('modalEdicion').classList.add('hidden'); });
document.getElementById('btnPegarTexto')?.addEventListener('click', () => {
  ocultarTodasLasPantallasExcepto('pegarTextoScreen'); history.pushState({tab:'pegar'}, '', '#pegar');
  document.getElementById('pegarTextoStep1').classList.remove('hidden'); document.getElementById('pegarTextoLoading').classList.add('hidden'); document.getElementById('pegarTextoResult').classList.add('hidden'); document.getElementById('textoDirecciones').value = '';
});
document.getElementById('btnReiniciarPegar')?.addEventListener('click', () => {
  document.getElementById('pegarTextoStep1').classList.remove('hidden'); document.getElementById('pegarTextoResult').classList.add('hidden'); document.getElementById('textoDirecciones').value = '';
  localStorage.removeItem('rutaflex_ruta'); rutaOptimizada = []; tramoActual = 0;
});
document.getElementById('btnProcesarTexto')?.addEventListener('click', async () => {
  const texto = document.getElementById('textoDirecciones').value;
  if (!texto.trim()) return mostrarNotificacion("⚠️ Pegá algún texto primero", "error");
  document.getElementById('pegarTextoStep1').classList.add('hidden'); document.getElementById('pegarTextoLoading').classList.remove('hidden'); document.getElementById('loadingMensaje').innerText = 'Extrayendo direcciones...';
  try { const direcciones = extraerDirecciones(limpiarTextoSucio(texto)); if (direcciones.length === 0) throw new Error('No se detectaron direcciones'); destinosDetectados = quitarDuplicadosDeLista(direcciones); document.getElementById('pegarTextoLoading').classList.add('hidden'); mostrarModalEdicionConGPS(); }
  catch(err) { if (!esErrorDeUsuario(err.message)) reportarErrorCritico('EXTRAER_DIRECCIONES_FALLO', err.message); mostrarNotificacion(`❌ ${err.message}`, "error"); document.getElementById('pegarTextoStep1').classList.remove('hidden'); document.getElementById('pegarTextoLoading').classList.add('hidden'); }
});
document.getElementById('tabLogin')?.addEventListener('click', () => { document.getElementById('formLogin').classList.remove('hidden'); document.getElementById('formRegistro').classList.add('hidden'); });
document.getElementById('tabRegistro')?.addEventListener('click', () => { document.getElementById('formRegistro').classList.remove('hidden'); document.getElementById('formLogin').classList.add('hidden'); });
document.getElementById('formLogin')?.addEventListener('submit', async (e) => {
  e.preventDefault(); const email = document.getElementById('loginEmail').value; const password = document.getElementById('loginPassword').value; const msg = document.getElementById('authMessage');
  msg.innerText = "Conectando..."; msg.className = "text-center text-sm mt-4 font-bold text-[#00E5FF] min-h-[20px]";
  try {
    const r = await fetch('/api/login', { method: 'POST', headers: {'Content-Type': 'application/json'}, credentials: 'include', body: JSON.stringify({email, password}) });
    if (!r.ok && r.status >= 500) reportarErrorCritico('API_LOGIN_CAIDO', 'POST /api/login status ' + r.status);
    const d = await r.json();
    if (r.ok && d.ok) { localStorage.setItem('rutaflex_email', email); mostrarApp(d.usuario.nombre, d.usuario.fecha_vencimiento); }
    else { msg.innerText = d.error || "Email o contraseña incorrectos"; msg.className = "text-center text-sm mt-4 font-bold text-red-400 min-h-[20px]"; }
  } catch(err) { if (err.message && err.message.includes('fetch')) reportarErrorCritico('API_LOGIN_CAIDO', err.message); msg.innerText = "Error de conexión"; msg.className = "text-center text-sm mt-4 font-bold text-red-400 min-h-[20px]"; }
});
document.getElementById('btnLogoutPerfil')?.addEventListener('click', hacerLogout);
document.getElementById('btnPromo')?.addEventListener('click', async () => {
  const codigo = document.getElementById('promo').value; if (!codigo) return;
  try { const r = await fetch('/api/validar-promo', { method: 'POST', headers: {'Content-Type': 'application/json'}, credentials: 'include', body: JSON.stringify({codigo}) }); if (!r.ok && r.status >= 500) reportarErrorCritico('API_PROMO_CAIDO', 'POST /api/validar-promo status ' + r.status); const d = await r.json(); mostrarNotificacion(d.mensaje, d.valido ? 'exito' : 'error'); }
  catch(e) { reportarErrorCritico('API_PROMO_CAIDO', e.message); }
});
window.abrirModalPagos = (plan, precio) => {
  document.getElementById('modal-plan-texto').innerText = `Plan ${plan} - $${precio}`;
  document.getElementById('modal-alias-texto').innerText = CONFIG_RUTAFLEX.alias;
  document.getElementById('btn-wsp-pago').href = `https://wa.me/${CONFIG_RUTAFLEX.whatsapp}?text=${encodeURIComponent(`Hola RutaFlex! Comprobante Plan ${plan} $${precio}`)}`;
  document.getElementById('btn-mp-pago').href = plan === 'Semanal' ? CONFIG_RUTAFLEX.linkSemanal : CONFIG_RUTAFLEX.linkMensual;
  document.getElementById('payment-modal').classList.remove('hidden');
};
window.cerrarModalPagos = () => document.getElementById('payment-modal').classList.add('hidden');
window.copiarAlias = () => { navigator.clipboard.writeText(CONFIG_RUTAFLEX.alias).then(() => mostrarNotificacion("✅ Alias copiado", "exito")); };
async function hacerLogout() { try { await fetch('/api/logout', {method: 'POST', credentials: 'include'}); } catch(e) {} localStorage.removeItem('rutaflex_email'); location.reload(); }
function mostrarApp(nombre, fechaVencimiento) {
  ocultarTodasLasPantallasExcepto('appScreen'); actualizarNav('home'); history.replaceState({tab: 'home'}, '', '#home');
  const userNameEl = document.getElementById('userName'); if (userNameEl) userNameEl.innerText = `¡Hola, ${nombre}!`;
  const diff = Math.ceil((new Date(fechaVencimiento) - new Date()) / (1000*60*60*24)); estaVencido = diff <= 0;
  const contadorEl = document.getElementById('contadorDias');
  if (contadorEl) {
    if (estaVencido) { contadorEl.innerHTML = "⚠️ VENCIDO"; contadorEl.className = "mt-4 inline-flex items-center gap-1.5 bg-red-500/15 border border-red-500/30 text-red-400 px-3.5 py-1.5 rounded-full text-[13px] font-bold"; const banner = document.getElementById('bannerVencido'); if (banner) banner.classList.remove('hidden'); }
    else { contadorEl.innerHTML = `✅ Activo (${diff} días)`; contadorEl.className = "mt-4 inline-flex items-center gap-1.5 bg-[#00C950]/15 border border-[#00C950]/30 text-[#00D084] px-3.5 py-1.5 rounded-full text-[13px] font-bold"; }
  }
  cargarDestinos();
}
async function cargarDestinos() {
  if (estaVencido) return;
  try {
    const r = await fetch('/api/destinos', {credentials: 'include'});
    if (!r.ok) { if (r.status >= 500) reportarErrorCritico('API_DESTINOS_CAIDO', 'GET /api/destinos status ' + r.status); throw new Error('Error al cargar destinos'); }
    destinos = quitarDuplicadosDeLista(await r.json());
    const titulo = document.getElementById('recienteTitulo'); const sub = document.getElementById('recienteSub');
    if (destinos.length > 0 && titulo && sub) { titulo.innerText = `${destinos[0].direccion} → ${destinos[destinos.length-1].direccion}`; sub.innerText = `${destinos.length} paradas`; }
    else if (titulo && sub) { try { const g = localStorage.getItem('rutaflex_ruta'); if (g) { const data = JSON.parse(g); if (data.ordenadas?.length) { titulo.innerText = `${data.ordenadas[0].texto} → ${data.ordenadas[data.ordenadas.length-1].texto}`; sub.innerText = `${data.ordenadas.length} paradas • Guardada`; } } } catch {} }
  } catch(e) { if (e.message && e.message.includes('fetch')) reportarErrorCritico('API_DESTINOS_CAIDO', e.message); console.error('Error en cargarDestinos:', e); }
}
function mostrarPerfil() {
  const email = localStorage.getItem('rutaflex_email') || 'usuario@rutaflex.com';
  const nombreEl = document.getElementById('perfilNombre'); const emailEl = document.getElementById('perfilEmail');
  if (nombreEl) nombreEl.innerText = email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1);
  if (emailEl) emailEl.innerText = email;
}
window.addEventListener('load', async () => {
  const hoy = new Date(); const fechaEl = document.getElementById('fechaHoy');
  if (fechaEl) fechaEl.innerText = `Hoy, ${hoy.getDate()} ${hoy.toLocaleDateString('es-AR', {month: 'short'}).replace('.','')}`;
  try { const r = await fetch('/api/yo', {credentials: 'include'}); if (!r.ok && r.status >= 500) reportarErrorCritico('API_YO_CAIDO', 'GET /api/yo status ' + r.status); const d = await r.json(); if (d.ok) mostrarApp(d.nombre, d.fecha_vencimiento); }
  catch(err) { if (err.message && err.message.includes('fetch')) reportarErrorCritico('API_YO_CAIDO', err.message); console.error('Error al verificar sesión:', err); }
  try { const g = localStorage.getItem('rutaflex_ruta'); if (g) { const data = JSON.parse(g); if (data.ordenadas && Date.now() - data.fecha < 12*60*60*1000) { rutaOptimizada = quitarDuplicadosDeLista(data.ordenadas); tramoActual = data.tramo || 0; if (tramoActual > 0 && tramoActual < Math.ceil(rutaOptimizada.length/9)) { setTimeout(() => mostrarPantallaTramos(data.gps), 800); } } } } catch(e) { reportarErrorCritico('RECIENTE_CORRUPTO', e.message); }
});
if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('/service-worker.js', {scope: '/'}).catch(() => {}); }); }
