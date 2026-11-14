const CONFIG_RUTAFLEX = { whatsapp:"5491123793596", alias:"RUTAFLEX.MP", linkSemanal:"https://mpago.la/2DjaHdB", linkMensual:"https://mpago.la/2aNpJ1B" };
let destinos=[], destinosDetectados=[], estaVencido=false, camaraStream=null;
let ubicacionActual = null; // GPS cacheado

// ============ UTILIDADES ============
window.togglePass=(id,icon)=>{const i=document.getElementById(id);if(!i)return;i.type=i.type==="password"?"text":"password";icon.innerText=i.type==="text"?"🙈":"👁️"};

function mostrarNotificacion(m,t='info'){
  const c=document.getElementById('notificaciones');if(!c)return;
  const n=document.createElement('div');
  n.className=`${t==='exito'?'bg-green-600':t==='error'?'bg-red-600':'bg-[#00E5FF]'} text-white px-6 py-3 rounded-xl font-bold text-sm text-center shadow-xl`;
  n.innerText=m;c.appendChild(n);setTimeout(()=>n.remove(),3500);
}

function ocultarTodasLasPantallasExcepto(id){
  ['authScreen','appScreen','pegarTextoScreen','perfilScreen','payment-modal','modalEdicion','modalMapa'].forEach(s=>{
    const el=document.getElementById(s); if(el) el.classList.add('hidden');
  });
  document.getElementById(id)?.classList.remove('hidden');
  window.scrollTo(0,0);
}

function actualizarNav(tabActivo) {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('text-[#00E5FF]', btn.dataset.tab === tabActivo);
    btn.classList.toggle('text-white/30', btn.dataset.tab !== tabActivo);
  });
}

function mostrarTab(tab, pushState = true) {
  if(tab === 'home') {
    ocultarTodasLasPantallasExcepto('appScreen');
    actualizarNav('home');
    if (pushState) history.pushState({tab:'home'}, '', '#home');
  }
  if(tab === 'perfil') {
    ocultarTodasLasPantallasExcepto('perfilScreen');
    mostrarPerfil();
    actualizarNav('perfil');
    if (pushState) history.pushState({tab:'perfil'}, '', '#perfil');
  }
  if(tab === 'historial') mostrarNotificacion("🚧 Sección en desarrollo", "info");
}

window.addEventListener('popstate', (e) => {
  if (e.state && e.state.tab) mostrarTab(e.state.tab, false);
  else mostrarTab('home', false);
});

// ============ 🎯 OBTENER GPS ACTUAL (SIEMPRE PRIMERO) ============
async function obtenerUbicacionActual() {
  // Si ya tenemos una ubicación reciente (menos de 5 min), reutilizarla
  if (ubicacionActual && (Date.now() - ubicacionActual.timestamp < 300000)) {
    return ubicacionActual.coords;
  }
  
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: -34.6037, lon: -58.3816 });
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        ubicacionActual = {
          coords: { lat: pos.coords.latitude, lon: pos.coords.longitude },
          timestamp: Date.now()
        };
        resolve(ubicacionActual.coords);
      },
      (err) => {
        console.warn('GPS error:', err);
        resolve({ lat: -34.6037, lon: -58.3816 }); // Fallback: CABA
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  });
}

// ============ MOTOR RÁPIDO DE DIRECCIONES (SIN NOMINATIM) ============
function limpiarTextoSucio(t) {
  return t
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\b(hola|buen dia|buenas|che|capo|dale|gracias|mañana|hoy|como estas|favor|por favor|ok|listo|avisame|envio|entrega|reparto|turno|pedido|factura|urgente|importante|recordar)\b/gi, '')
    .replace(/\b\d{2,4}[- ]?\d{3,4}[- ]?\d{4}\b/g, '')
    .replace(/\b11[- ]?\d{4}[- ]?\d{4}\b/g, '')
    .replace(/\$\s?\d+([.,]\d+)?/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function extraerDirecciones(texto) {
  const lineas = texto.split(/[\n;]+/).map(l => l.trim()).filter(l => l.length > 5);
  const direcciones = [];
  
  // Patrones de dirección argentina
  const regexDir = /(?:^|\s)(?:Av\.?|Avenida|Avda\.?|Calle|Pasaje|Pje\.?|Bv\.?|Bulevar|Cam\.?|Rambla|Rua|R\.?)?\s*[A-Za-zÁÉÍÓÚáéíóúÑñ][A-Za-zÁÉÍÓÚáéíóúÑñ\.\s]{2,30}?\s+\d{1,5}[A-Za-z]?(?:\s*(?:bis|BIS|b|º|°|\/\d+))?(?:\s*,\s*[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+)?(?:\s*-\s*[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+)?/gi;
  
  lineas.forEach(linea => {
    const limpia = limpiarTextoSucio(linea);
    const matches = limpia.matchAll(regexDir);
    for (const m of matches) {
      const dir = m[0].replace(/\s+/g, ' ').trim();
      if (dir.length > 6 && /\d/.test(dir)) {
        direcciones.push(dir);
      }
    }
    // Si no matchea regex pero tiene número y parece dirección
    if (!direcciones.includes(limpia) && /\d{1,5}/.test(limpia) && limpia.length > 6 && limpia.length < 80 && /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(limpia)) {
      direcciones.push(limpia);
    }
  });
  
  // Deduplicar
  return [...new Set(direcciones)].slice(0, 50);
}

// ============ 🖼️ OCR MEJORADO (Imagen/Cámara) ============
function preprocesarImagen(img) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const maxDim = 1600;
    let w = img.width, h = img.height;
    if (w > maxDim || h > maxDim) {
      const r = maxDim / Math.max(w, h);
      w = Math.round(w*r); h = Math.round(h*r);
    }
    canvas.width = w; canvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);
    
    const data = ctx.getImageData(0, 0, w, h);
    const d = data.data;
    
    // Escala de grises + contraste
    let min = 255, max = 0;
    const grises = new Uint8ClampedArray(w*h);
    for (let i = 0; i < w*h; i++) {
      const g = Math.round(0.299*d[i*4] + 0.587*d[i*4+1] + 0.114*d[i*4+2]);
      grises[i] = g;
      if (g < min) min = g;
      if (g > max) max = g;
    }
    const rango = Math.max(1, max - min);
    for (let i = 0; i < w*h; i++) {
      let g = ((grises[i] - min) * 255 / rango);
      g = g < 100 ? 0 : 255;
      d[i*4] = d[i*4+1] = d[i*4+2] = g;
      d[i*4+3] = 255;
    }
    ctx.putImageData(data, 0, 0);
    resolve(canvas.toDataURL('image/png'));
  });
}

async function procesarImagenOCR(src) {
  if (typeof Tesseract === 'undefined') throw new Error('Librería no cargada. Recargá la página.');
  
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
  
  const procesada = await preprocesarImagen(img);
  
  const worker = await Tesseract.createWorker('spa', 1, {
    logger: m => { if (m.status === 'recognizing text') console.log(`${Math.round(m.progress*100)}%`); }
  });
  await worker.setParameters({ tessedit_pageseg_mode: '6' });
  const { data: { text } } = await worker.recognize(procesada);
  await worker.terminate();
  
  if (!text || text.trim().length < 5) throw new Error('Imagen sin texto legible');
  return text;
}

// ============ 📄 PDF ============
async function procesarPDF(file) {
  if (typeof pdfjsLib === 'undefined') throw new Error('PDF.js no cargado');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
  let texto = '';
  for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    texto += content.items.map(it => it.str).join(' ') + '\n';
  }
  if (texto.trim().length < 5) throw new Error('PDF sin texto seleccionable');
  return texto;
}

// ============ 🚀 PROCESAR Y MOSTRAR RESULTADOS (RÁPIDO) ============
async function procesarYMostrar(textoCrudo, origenNombre) {
  const limpio = limpiarTextoSucio(textoCrudo);
  const direcciones = extraerDirecciones(limpio);
  
  if (direcciones.length === 0) {
    throw new Error('No se detectaron direcciones. Revisá el texto/imagen.');
  }
  
  // Obtener GPS PRIMERO (para que esté listo cuando arme el link)
  const gps = await obtenerUbicacionActual();
  
  destinosDetectados = direcciones;
  mostrarModalEdicionConGPS(gps, direcciones);
}

function mostrarModalEdicionConGPS(gps, direcciones) {
  const c = document.getElementById('contenedorInputs');
  c.innerHTML = `<div class="bg-[#00C950]/10 border border-[#00C950]/30 rounded-xl p-3 mb-3 flex items-center gap-2">
    <span class="text-[#00D084]">📍</span>
    <span class="text-[#00D084] text-sm font-bold">Origen: Tu ubicación actual (${gps.lat.toFixed(4)}, ${gps.lon.toFixed(4)})</span>
  </div>`;
  
  direcciones.forEach((dir, i) => {
    c.innerHTML += `<div class="flex gap-2 items-start bg-[#0A1220]/80 p-3 rounded-xl border border-white/10">
      <span class="bg-[#00E5FF] text-[#0A1220] rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold mt-1 flex-shrink-0">${i+1}</span>
      <input type="text" value="${dir.replace(/"/g,'&quot;')}" class="input-direccion flex-1 bg-[#111C31]/80 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
      <button onclick="eliminarLinea(${i})" class="text-red-400 p-2">🗑️</button>
    </div>`;
  });
  document.getElementById('modalEdicion').classList.remove('hidden');
}

// ============ 🖼️ IMAGEN ============
document.getElementById('fileImg')?.addEventListener('change', async (e) => {
  if (estaVencido) return mostrarNotificacion("⚠️ Plan vencido", "error");
  const file = e.target.files[0]; if (!file) return;
  if (!file.type.startsWith('image/')) return mostrarNotificacion("⚠️ Archivo inválido", "error");
  if (file.size > 10*1024*1024) return mostrarNotificacion("⚠️ Imagen muy grande (máx 10MB)", "error");
  
  mostrarNotificacion("🤖 Leyendo imagen...", "info");
  try {
    const url = URL.createObjectURL(file);
    const texto = await procesarImagenOCR(url);
    URL.revokeObjectURL(url);
    await procesarYMostrar(texto, 'imagen');
  } catch(err) {
    mostrarNotificacion(`❌ ${err.message}`, "error");
  } finally { e.target.value = ''; }
});

// ============ 📄 PDF ============
document.getElementById('filePdf')?.addEventListener('change', async (e) => {
  if (estaVencido) return mostrarNotificacion("⚠️ Plan vencido", "error");
  const file = e.target.files[0]; if (!file) return;
  mostrarNotificacion("📄 Leyendo PDF...", "info");
  try {
    const texto = await procesarPDF(file);
    await procesarYMostrar(texto, 'PDF');
  } catch(err) {
    mostrarNotificacion(`❌ ${err.message}`, "error");
  } finally { e.target.value = ''; }
});

// ============ 📷 CÁMARA ============
document.getElementById('btnCamara')?.addEventListener('click', async () => {
  const panel = document.getElementById('panelCamara');
  const v = document.getElementById('camara');
  panel.classList.remove('hidden');
  try {
    camaraStream = await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment", width:{ideal:1920}}});
    v.srcObject = camaraStream;
  } catch {
    panel.classList.add('hidden');
    mostrarNotificacion("❌ No se pudo abrir la cámara", "error");
  }
});

document.getElementById('btnCerrarCamara')?.addEventListener('click', () => {
  if (camaraStream) camaraStream.getTracks().forEach(t => t.stop());
  document.getElementById('panelCamara').classList.add('hidden');
});

document.getElementById('btnCapturar')?.addEventListener('click', async () => {
  const v = document.getElementById('camara');
  const canvas = document.createElement('canvas');
  canvas.width = v.videoWidth; canvas.height = v.videoHeight;
  canvas.getContext('2d').drawImage(v, 0, 0);
  if (camaraStream) camaraStream.getTracks().forEach(t => t.stop());
  document.getElementById('panelCamara').classList.add('hidden');
  mostrarNotificacion("🤖 Procesando foto...", "info");
  try {
    const texto = await procesarImagenOCR(canvas.toDataURL('image/png'));
    await procesarYMostrar(texto, 'foto');
  } catch(err) {
    mostrarNotificacion(`❌ ${err.message}`, "error");
  }
});

// ============ 📍 MAPA ============
document.getElementById('btnMapa')?.addEventListener('click', async () => {
  document.getElementById('modalMapa').classList.remove('hidden');
  await new Promise(r => setTimeout(r, 100));
  if (!mapaLeaflet) {
    const gps = await obtenerUbicacionActual();
    mapaLeaflet = L.map('mapaLeaflet').setView([gps.lat, gps.lon], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19}).addTo(mapaLeaflet);
    L.marker([gps.lat, gps.lon]).addTo(mapaLeaflet).bindPopup('📍 Tu ubicación').openPopup();
    mapaLeaflet.on('click', async (e) => {
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${e.latlng.lat}&lon=${e.latlng.lon}`);
        const d = await r.json();
        const dir = d.display_name?.split(',').slice(0,2).join(', ') || `${e.latlng.lat.toFixed(4)}, ${e.latlng.lon.toFixed(4)}`;
        destinosDetectados.push(dir);
        mostrarNotificacion(`✅ ${dir}`, "exito");
        L.marker([e.latlng.lat, e.latlng.lon]).addTo(mapaLeaflet);
      } catch { mostrarNotificacion("❌ No se pudo obtener dirección", "error"); }
    });
  }
  setTimeout(() => mapaLeaflet.invalidateSize(), 200);
});

document.getElementById('btnCerrarMapa')?.addEventListener('click', () => {
  document.getElementById('modalMapa').classList.add('hidden');
});

document.getElementById('btnMiUbicacion')?.addEventListener('click', async () => {
  const gps = await obtenerUbicacionActual();
  if (mapaLeaflet) mapaLeaflet.setView([gps.lat, gps.lon], 16);
});

document.getElementById('btnListoMapa')?.addEventListener('click', () => {
  document.getElementById('modalMapa').classList.add('hidden');
  if (destinosDetectados.length > 0) {
    const gps = await obtenerUbicacionActual();
    mostrarModalEdicionConGPS(gps, destinosDetectados);
  }
});

// ============ MODAL EDICIÓN ============
document.getElementById('btnGuardarEdicion')?.addEventListener('click', async () => {
  const dirs = document.querySelectorAll('.input-direccion');
  const finales = [...dirs].map(d => d.value.trim()).filter(d => d.length > 3);
  if (finales.length === 0) return mostrarNotificacion("Ingresá al menos una", "error");
  
  const btn = document.getElementById('btnGuardarEdicion');
  btn.innerText = "💾 Guardando..."; btn.disabled = true;
  
  try {
    for (const d of finales) {
      await fetch('/api/destinos', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        credentials: 'include',
        body: JSON.stringify({direccion: d})
      });
    }
    mostrarNotificacion(`✅ ${finales.length} direcciones guardadas`, "exito");
    document.getElementById('modalEdicion').classList.add('hidden');
    destinosDetectados = [];
    await cargarDestinos();
  } catch {
    mostrarNotificacion("❌ Error al guardar", "error");
  } finally {
    btn.innerText = "✅ Guardar"; btn.disabled = false;
  }
});

window.eliminarLinea = (i) => {
  destinosDetectados.splice(i, 1);
  const c = document.getElementById('contenedorInputs');
  const inputs = c.querySelectorAll('.input-direccion');
  if (inputs[i]) inputs[i].closest('div').remove();
  // Renumerar
  c.querySelectorAll('.input-direccion').forEach((inp, idx) => {
    const num = inp.closest('div').querySelector('span');
    if (num) num.innerText = idx + 1;
  });
};

document.getElementById('btnAgregarLinea')?.addEventListener('click', () => {
  destinosDetectados.push('');
  const c = document.getElementById('contenedorInputs');
  const idx = c.querySelectorAll('.input-direccion').length;
  const div = document.createElement('div');
  div.className = 'flex gap-2 items-start bg-[#0A1220]/80 p-3 rounded-xl border border-white/10';
  div.innerHTML = `<span class="bg-[#00E5FF] text-[#0A1220] rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold mt-1 flex-shrink-0">${idx+1}</span>
    <input type="text" value="" class="input-direccion flex-1 bg-[#111C31]/80 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
    <button onclick="eliminarLinea(${idx})" class="text-red-400 p-2">🗑️</button>`;
  c.appendChild(div);
});

document.getElementById('btnCancelarEdicion')?.addEventListener('click', () => {
  document.getElementById('modalEdicion').classList.add('hidden');
  destinosDetectados = [];
});
document.getElementById('btnCerrarModal')?.addEventListener('click', () => {
  document.getElementById('modalEdicion').classList.add('hidden');
});

// ============ 📋 PEGAR TEXTO ============
document.getElementById('btnPegarTexto')?.addEventListener('click', () => {
  ocultarTodasLasPantallasExcepto('pegarTextoScreen');
  history.pushState({tab:'pegar'}, '', '#pegar');
  document.getElementById('pegarTextoStep1').classList.remove('hidden');
  document.getElementById('pegarTextoLoading').classList.add('hidden');
  document.getElementById('pegarTextoResult').classList.add('hidden');
  document.getElementById('textoDirecciones').value = '';
});

document.getElementById('btnReiniciarPegar')?.addEventListener('click', () => {
  document.getElementById('pegarTextoStep1').classList.remove('hidden');
  document.getElementById('pegarTextoResult').classList.add('hidden');
  document.getElementById('textoDirecciones').value = '';
});

document.getElementById('btnProcesarTexto')?.addEventListener('click', async () => {
  const texto = document.getElementById('textoDirecciones').value;
  if (!texto.trim()) return mostrarNotificacion("⚠️ Pegá algún texto primero", "error");
  
  // Mostrar loading rápido
  document.getElementById('pegarTextoStep1').classList.add('hidden');
  document.getElementById('pegarTextoLoading').classList.remove('hidden');
  document.getElementById('loadingMensaje').innerText = 'Extrayendo direcciones...';
  
  try {
    await procesarYMostrar(texto, 'texto');
    // Ir directo a resultados sin validación lenta
    document.getElementById('pegarTextoLoading').classList.add('hidden');
    mostrarResultadosRapidos(destinosDetectados);
  } catch(err) {
    mostrarNotificacion(`❌ ${err.message}`, "error");
    document.getElementById('pegarTextoStep1').classList.remove('hidden');
    document.getElementById('pegarTextoLoading').classList.add('hidden');
  }
});

function mostrarResultadosRapidos(direcciones) {
  document.getElementById('pegarTextoResult').classList.remove('hidden');
  document.getElementById('resumenValidas').innerText = direcciones.length;
  document.getElementById('resumenDescartadas').innerText = '0';
  document.getElementById('statParadasPegadas').innerText = direcciones.length;
  document.getElementById('statDistanciaPegadas').innerText = '~' + (direcciones.length * 2).toFixed(0);
  document.getElementById('statTiempoPegadas').innerText = '~' + (direcciones.length * 3).toFixed(0);
  
  const listaEl = document.getElementById('listaPegadas');
  listaEl.innerHTML = '';
  direcciones.forEach((dir, i) => {
    listaEl.innerHTML += `
      <div class="bg-[#111C31]/80 backdrop-blur-xl rounded-xl p-3 flex gap-3 items-center border border-white/10">
        <div class="w-8 h-8 rounded-full bg-[#00E5FF] text-[#0A1220] font-black flex items-center justify-center flex-shrink-0 text-sm">${i+1}</div>
        <div class="flex-1 min-w-0">
          <p class="font-bold text-sm text-white truncate">${dir}</p>
        </div>
      </div>`;
  });
  
  generarTramos(direcciones);
}

async function generarTramos(direcciones) {
  const gps = await obtenerUbicacionActual();
  const tramosContainer = document.getElementById('tramosContainer');
  tramosContainer.innerHTML = '';
  
  const CHUNK = 9; // 1 destino final + 8 waypoints
  for (let i = 0; i < direcciones.length; i += CHUNK) {
    const chunk = direcciones.slice(i, i + CHUNK);
    const tramoNum = Math.floor(i/CHUNK) + 1;
    const totalTramos = Math.ceil(direcciones.length/CHUNK);
    
    // ✅ ORIGEN: coordenadas GPS reales (siempre desde donde estás)
    const origin = `${gps.lat},${gps.lon}`;
    // ✅ DESTINO: última dirección del tramo
    const destino = encodeURIComponent(chunk[chunk.length-1]);
    // ✅ WAYPOINTS: las demás, con optimize:true para que Google las ordene de cerca a lejos
    const waypoints = chunk.slice(0, -1).map(d => encodeURIComponent(d)).join('|');
    
    // Link correcto de Google Maps
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destino}&waypoints=optimize:true|${waypoints}&travelmode=driving`;
    
    // Waze: primer destino del tramo
    const wazeUrl = `https://www.waze.com/ul?q=${encodeURIComponent(chunk[0])}&navigate=yes`;
    
    tramosContainer.innerHTML += `
      <div class="bg-[#111C31]/80 backdrop-blur-xl rounded-xl p-4 border border-white/10">
        <p class="text-[#00E5FF] font-bold text-sm mb-3 text-center">Tramo ${tramoNum} de ${totalTramos} (${chunk.length} paradas)</p>
        <p class="text-white/60 text-xs text-center mb-3">📍 Origen: Tu ubicación actual</p>
        <div class="grid grid-cols-2 gap-3">
          <a href="${mapsUrl}" target="_blank" class="bg-[#00E5FF] text-[#0A1220] font-black py-4 rounded-xl text-center text-sm hover:bg-[#00c8e0] transition-all flex items-center justify-center gap-2 active:scale-[0.98]">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            ABRIR EN<br>GOOGLE MAPS
          </a>
          <a href="${wazeUrl}" target="_blank" class="bg-transparent border-2 border-[#00E5FF] text-[#00E5FF] font-black py-4 rounded-xl text-center text-sm hover:bg-[#00E5FF]/10 transition-all flex items-center justify-center gap-2 active:scale-[0.98]">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 3.5c-2-1-4.5-1.5-7-1.5s-5 .5-7 1.5C3 5.5 1 8.5 1 12c0 2.5 1 5 2.5 7L2 22l3.5-1.5c2 1 4.5 1.5 7 1.5 5.5 0 10-4.5 10-10 0-3.5-2-6.5-4.5-8.5z"/></svg>
            ABRIR EN<br>WAZE
          </a>
        </div>
      </div>`;
  }
}

// ============ AUTH Y DESTINOS ============
document.getElementById('tabLogin')?.addEventListener('click', () => {
  document.getElementById('formLogin').classList.remove('hidden');
  document.getElementById('formRegistro').classList.add('hidden');
});
document.getElementById('tabRegistro')?.addEventListener('click', () => {
  document.getElementById('formRegistro').classList.remove('hidden');
  document.getElementById('formLogin').classList.add('hidden');
});

document.getElementById('formLogin')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const msg = document.getElementById('authMessage');
  msg.innerText = "Conectando...";
  try {
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      credentials: 'include',
      body: JSON.stringify({email, password})
    });
    const d = await r.json();
    if (r.ok) {
      localStorage.setItem('rutaflex_email', email);
      mostrarApp(d.usuario.nombre, d.usuario.fecha_vencimiento);
    } else {
      msg.innerText = d.error || "Error";
    }
  } catch { msg.innerText = "Error de conexión"; }
});

document.getElementById('btnLogoutPerfil')?.addEventListener('click', hacerLogout);
document.getElementById('btnPromo')?.addEventListener('click', async () => {
  const codigo = document.getElementById('promo').value;
  if (!codigo) return;
  const r = await fetch('/api/validar-promo', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    credentials: 'include',
    body: JSON.stringify({codigo})
  });
  const d = await r.json();
  mostrarNotificacion(d.mensaje, d.valido ? 'exito' : 'error');
});

window.abrirModalPagos = (plan, precio) => {
  document.getElementById('modal-plan-texto').innerText = `Plan ${plan} - $${precio}`;
  document.getElementById('modal-alias-texto').innerText = CONFIG_RUTAFLEX.alias;
  document.getElementById('btn-wsp-pago').href = `https://wa.me/${CONFIG_RUTAFLEX.whatsapp}?text=${encodeURIComponent(`Hola RutaFlex! Comprobante Plan ${plan} $${precio}`)}`;
  document.getElementById('btn-mp-pago').href = plan === 'Semanal' ? CONFIG_RUTAFLEX.linkSemanal : CONFIG_RUTAFLEX.linkMensual;
  document.getElementById('payment-modal').classList.remove('hidden');
};
window.cerrarModalPagos = () => document.getElementById('payment-modal').classList.add('hidden');
window.copiarAlias = () => {
  navigator.clipboard.writeText(CONFIG_RUTAFLEX.alias).then(() => mostrarNotificacion("✅ Alias copiado", "exito"));
};

async function hacerLogout() {
  await fetch('/api/logout', {method: 'POST', credentials: 'include'});
  localStorage.removeItem('rutaflex_email');
  location.reload();
}

function mostrarApp(nombre, fechaVencimiento) {
  ocultarTodasLasPantallasExcepto('appScreen');
  actualizarNav('home');
  history.replaceState({tab: 'home'}, '', '#home');
  document.getElementById('userName').innerText = `¡Hola, ${nombre}!`;
  const diff = Math.ceil((new Date(fechaVencimiento) - new Date()) / (1000*60*60*24));
  estaVencido = diff <= 0;
  const contadorEl = document.getElementById('contadorDias');
  if (estaVencido) {
    contadorEl.innerHTML = "⚠️ VENCIDO";
    contadorEl.className = "mt-4 inline-flex items-center gap-1.5 bg-red-500/15 border border-red-500/30 text-red-400 px-3.5 py-1.5 rounded-full text-[13px] font-bold";
    document.getElementById('bannerVencido').classList.remove('hidden');
  } else {
    contadorEl.innerHTML = `✅ Activo (${diff} días)`;
    contadorEl.className = "mt-4 inline-flex items-center gap-1.5 bg-[#00C950]/15 border border-[#00C950]/30 text-[#00D084] px-3.5 py-1.5 rounded-full text-[13px] font-bold";
  }
  cargarDestinos();
}

async function cargarDestinos() {
  if (estaVencido) return;
  try {
    const r = await fetch('/api/destinos', {credentials: 'include'});
    destinos = await r.json();
    if (destinos.length > 0) {
      document.getElementById('recienteTitulo').innerText = `${destinos[0].direccion} → ${destinos[destinos.length-1].direccion}`;
      document.getElementById('recienteSub').innerText = `${destinos.length} paradas`;
    }
  } catch(e) { console.error(e); }
}

function mostrarPerfil() {
  const email = localStorage.getItem('rutaflex_email') || 'usuario@rutaflex.com';
  document.getElementById('perfilNombre').innerText = email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1);
  document.getElementById('perfilEmail').innerText = email;
}

window.addEventListener('load', async () => {
  const hoy = new Date();
  document.getElementById('fechaHoy').innerText = `Hoy, ${hoy.getDate()} ${hoy.toLocaleDateString('es-AR', {month: 'short'}).replace('.','')}`;
  try {
    const r = await fetch('/api/yo', {credentials: 'include'});
    const d = await r.json();
    if (d.ok) mostrarApp(d.nombre, d.fecha_vencimiento);
  } catch {}
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js', {scope: '/'}).catch(() => {});
  });
}
