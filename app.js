const CONFIG_RUTAFLEX = { whatsapp:"5491123793596", alias:"RUTAFLEX.MP", linkSemanal:"https://mpago.la/2DjaHdB", linkMensual:"https://mpago.la/2aNpJ1B" };
let destinos=[], destinosDetectados=[], estaVencido=false, camaraStream=null, mapaLeaflet=null;
let ubicacionActual = null;
let rutaOptimizada = [];
let tramoActual = 0;

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
  n.innerText=m;
  c.appendChild(n);
  setTimeout(()=>n.remove(),3500);
}

function ocultarTodasLasPantallasExcepto(id){
  ['authScreen','appScreen','pegarTextoScreen','perfilScreen','payment-modal','modalEdicion','modalMapa'].forEach(s=>{
    const el=document.getElementById(s);
    if(el) el.classList.add('hidden');
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

// ============ 🎯 GPS ============
async function obtenerUbicacionActual() {
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
        resolve({ lat: -34.6037, lon: -58.3816 });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  });
}

// ============ MOTOR DE DIRECCIONES ============
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
  const regexDir = /(?:^|\s)(?:Av\.?|Avenida|Avda\.?|Calle|Pasaje|Pje\.?|Bv\.?|Bulevar|Cam\.?|Rambla|Rua|R\.?)?\s*[A-Za-zÁÉÍÓÚáéíóúÑñ][A-Za-zÁÉÍÓÚáéíóúÑñ\.\s]{2,30}?\s+\d{1,5}[A-Za-z]?(?:\s*(?:bis|BIS|b|º|°|\/\d+))?(?:\s*,\s*[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+)?/gi;
  lineas.forEach(linea => {
    const limpia = limpiarTextoSucio(linea);
    const matches = limpia.matchAll(regexDir);
    for (const m of matches) {
      const dir = m[0].replace(/\s+/g, ' ').trim();
      if (dir.length > 6 && /\d/.test(dir)) {
        direcciones.push(dir);
      }
    }
    if (!direcciones.includes(limpia) && /\d{1,5}/.test(limpia) && limpia.length > 6 && limpia.length < 80 && /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(limpia)) {
      direcciones.push(limpia);
    }
  });
  return [...new Set(direcciones)].slice(0, 100);
}

// ============ OCR ============
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
  if (typeof Tesseract === 'undefined') throw new Error('Librería no cargada');
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

// ============ 🚀 RUTAFLEX V2 - TRAMOS GUARDADOS Y CONTINUOS ============
function distanciaKm(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const x = Math.sin(dLat/2)**2 + Math.cos(a.lat*Math.PI/180) * Math.cos(b.lat*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.asin(Math.sqrt(x));
}

async function geocodificar(direccion) {
  try {
    const q = encodeURIComponent(direccion + ", Buenos Aires, Argentina");
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`);
    const data = await r.json();
    if (data && data[0]) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch(e) {}
  return null;
}

function mejorarRuta(ruta) {
  for (let k = 0; k < 2; k++) {
    for (let i = 1; i < ruta.length - 2; i++) {
      for (let j = i + 1; j < ruta.length - 1; j++) {
        const a = ruta[i-1], b = ruta[i], c = ruta[j], d = ruta[j+1];
        if (!a.lat || !b.lat || !c.lat || !d.lat) continue;
        const antes = distanciaKm(a,b) + distanciaKm(c,d);
        const despues = distanciaKm(a,c) + distanciaKm(b,d);
        if (despues < antes) {
          ruta.splice(i, j-i+1, ...ruta.slice(i, j+1).reverse());
        }
      }
    }
  }
  return ruta;
}

async function comenzarViaje() {
  if (destinos.length === 0) return mostrarNotificacion("⚠️ No hay direcciones cargadas", "error");
  mostrarNotificacion("📍 Obteniendo tu ubicación...", "info");
  const gps = await obtenerUbicacionActual();
  mostrarNotificacion("🧭 Ordenando de la más cercana a la más lejana...", "info");

  let conCoords = [];
  for (let d of destinos) {
    const texto = d.direccion || d.dirección || '';
    const c = await geocodificar(texto);
    conCoords.push({ texto, lat: c ? c.lat : null, lon: c ? c.lon : null });
    await new Promise(r => setTimeout(r, 120));
  }

  let ordenadas = [];
  let actual = { lat: gps.lat, lon: gps.lon };
  let pendientes = conCoords.filter(c => c.lat !== null);
  let sinCoords = conCoords.filter(c => c.lat === null);
  while (pendientes.length > 0) {
    let mejorIdx = 0, mejorDist = Infinity;
    pendientes.forEach((p, i) => {
      const dist = distanciaKm(actual, p);
      if (dist < mejorDist) { mejorDist = dist; mejorIdx = i; }
    });
    const elegida = pendientes.splice(mejorIdx, 1)[0];
    elegida.distDesdeAnterior = mejorDist;
    ordenadas.push(elegida);
    actual = elegida;
  }
  ordenadas = mejorarRuta(ordenadas);
  ordenadas = [...ordenadas, ...sinCoords];

  rutaOptimizada = ordenadas;
  tramoActual = 0;
  localStorage.setItem('rutaflex_ruta', JSON.stringify({ gps, ordenadas, tramo: 0, fecha: Date.now() }));
  destinos = ordenadas.map(o => ({ direccion: o.texto }));
  mostrarPantallaTramos(gps);
  mostrarNotificacion(`🚀 Lista lista: ${ordenadas.length} paradas ordenadas`, "exito");
}

function mostrarPantallaTramos(gps) {
  const totalTramos = Math.ceil(rutaOptimizada.length / 9);
  const tramosContainer = document.getElementById('tramosContainer');
  if (!tramosContainer) return;
  tramosContainer.innerHTML = '';
  const listaEl = document.getElementById('listaPegadas');
  if (listaEl) {
    listaEl.innerHTML = '';
    rutaOptimizada.forEach((d, i) => {
      const numTramo = Math.floor(i / 9) + 1;
      listaEl.innerHTML += `
        <div class="bg-[#111C31]/80 rounded-xl p-3 flex gap-3 items-center border border-white/10">
          <div class="w-8 h-8 rounded-full bg-[#00E5FF] text-[#0A1220] font-black flex items-center justify-center text-sm">${i+1}</div>
          <div class="flex-1 min-w-0">
            <p class="font-bold text-sm text-white truncate">${d.texto}</p>
            <p class="text-xs text-white/50">Tramo ${numTramo} • ${d.distDesdeAnterior ? d.distDesdeAnterior.toFixed(1)+' km desde anterior' : ''}</p>
          </div>
        </div>`;
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
    <div class="text-center text-white/60 text-xs mb-3">Todos los tramos ya quedaron guardados y ordenados</div>
  `;
  const r = document.getElementById('pegarTextoResult');
  if (r) r.classList.remove('hidden');
  const rv = document.getElementById('resumenValidas'); if (rv) rv.innerText = rutaOptimizada.length;
  const rd = document.getElementById('resumenDescartadas'); if (rd) rd.innerText = '0';
  const spp = document.getElementById('statParadasPegadas'); if (spp) spp.innerText = rutaOptimizada.length;
  let distTotal = rutaOptimizada.reduce((a,o)=>a+(o.distDesdeAnterior||0),0);
  const sdp = document.getElementById('statDistanciaPegadas'); if (sdp) sdp.innerText = '~'+distTotal.toFixed(1)+' km';
  const stp = document.getElementById('statTiempoPegadas'); if (stp) stp.innerText = '~'+Math.round(distTotal/0.5)+' min';
  ocultarTodasLasPantallasExcepto('pegarTextoScreen');
}

window.abrirTramoActual = function() {
  const i = tramoActual * 9;
  const tramo = rutaOptimizada.slice(i, i+9);
  if (tramo.length === 0) return mostrarNotificacion("✅ ¡Recorrido terminado!", "exito");
  let origen;
  if (tramoActual === 0) {
    const guardado = JSON.parse(localStorage.getItem('rutaflex_ruta') || '{}');
    origen = guardado.gps ? `${guardado.gps.lat},${guardado.gps.lon}` : encodeURIComponent("Mi ubicación");
  } else {
    const anterior = rutaOptimizada[i-1];
    origen = anterior.lat ? `${anterior.lat},${anterior.lon}` : encodeURIComponent(anterior.texto);
  }
  const destinoFinal = tramo[tramo.length-1];
  const destination = destinoFinal.lat ? `${destinoFinal.lat},${destinoFinal.lon}` : encodeURIComponent(destinoFinal.texto);
  const waypoints = tramo.slice(0,-1).map(d => d.lat ? `${d.lat},${d.lon}` : encodeURIComponent(d.texto)).join('|');
  const url = `https://www.google.com/maps/dir/?api=1&origin=${origen}&destination=${destination}&waypoints=${waypoints}&travelmode=driving`;
  tramoActual++;
  const guardadoPrevio = JSON.parse(localStorage.getItem('rutaflex_ruta')||'{}');
  localStorage.setItem('rutaflex_ruta', JSON.stringify({ gps: guardadoPrevio.gps, ordenadas: rutaOptimizada, tramo: tramoActual, fecha: Date.now() }));
  setTimeout(() => {
    if (tramoActual < Math.ceil(rutaOptimizada.length/9)) {
      const g = JSON.parse(localStorage.getItem('rutaflex_ruta')||'{}');
      mostrarPantallaTramos(g.gps);
      mostrarNotificacion(`✅ Tramo ${tramoActual} listo. Seguí con Tramo ${tramoActual+1}`, "exito");
    } else {
      mostrarNotificacion("🎉 ¡Recorrido completo!", "exito");
    }
  }, 1000);
  window.open(url, '_blank');
};

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
    const direcciones = extraerDirecciones(limpiarTextoSucio(texto));
    if (direcciones.length === 0) throw new Error('No se detectaron direcciones');
    destinosDetectados = direcciones;
    mostrarModalEdicionConGPS();
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
    const direcciones = extraerDirecciones(limpiarTextoSucio(texto));
    if (direcciones.length === 0) throw new Error('No se detectaron direcciones');
    destinosDetectados = direcciones;
    mostrarModalEdicionConGPS();
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
    const direcciones = extraerDirecciones(limpiarTextoSucio(texto));
    if (direcciones.length === 0) throw new Error('No se detectaron direcciones');
    destinosDetectados = direcciones;
    mostrarModalEdicionConGPS();
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
    mostrarModalEdicionConGPS();
  }
});

// ============ MODAL EDICIÓN ============
function mostrarModalEdicionConGPS() {
  const c = document.getElementById('contenedorInputs');
  c.innerHTML = '';
  destinosDetectados.forEach((dir, i) => {
    c.innerHTML += `<div class="flex gap-2 items-start bg-[#0A1220]/80 p-3 rounded-xl border border-white/10">
      <span class="bg-[#00E5FF] text-[#0A1220] rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold mt-1 flex-shrink-0">${i+1}</span>
      <input type="text" value="${dir.replace(/"/g,'&quot;')}" class="input-direccion flex-1 bg-[#111C31]/80 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
      <button onclick="eliminarLinea(${i})" class="text-red-400 p-2">🗑️</button>
    </div>`;
  });
  document.getElementById('modalEdicion').classList.remove('hidden');
}

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
    setTimeout(() => comenzarViaje(), 500);
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
  localStorage.removeItem('rutaflex_ruta');
  rutaOptimizada = []; tramoActual = 0;
});

document.getElementById('btnProcesarTexto')?.addEventListener('click', async () => {
  const texto = document.getElementById('textoDirecciones').value;
  if (!texto.trim()) return mostrarNotificacion("⚠️ Pegá algún texto primero", "error");
  document.getElementById('pegarTextoStep1').classList.add('hidden');
  document.getElementById('pegarTextoLoading').classList.remove('hidden');
  document.getElementById('loadingMensaje').innerText = 'Extrayendo direcciones...';
  try {
    const direcciones = extraerDirecciones(limpiarTextoSucio(texto));
    if (direcciones.length === 0) throw new Error('No se detectaron direcciones');
    destinosDetectados = direcciones;
    document.getElementById('pegarTextoLoading').classList.add('hidden');
    mostrarModalEdicionConGPS();
  } catch(err) {
    mostrarNotificacion(`❌ ${err.message}`, "error");
    document.getElementById('pegarTextoStep1').classList.remove('hidden');
    document.getElementById('pegarTextoLoading').classList.add('hidden');
  }
});

// ============ AUTH ============
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
  msg.className = "text-center text-sm mt-4 font-bold text-[#00E5FF] min-h-[20px]";
  try {
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      credentials: 'include',
      body: JSON.stringify({email, password})
    });
    const d = await r.json();
    if (r.ok && d.ok) {
      localStorage.setItem('rutaflex_email', email);
      mostrarApp(d.usuario.nombre, d.usuario.fecha_vencimiento);
    } else {
      msg.innerText = d.error || "Email o contraseña incorrectos";
      msg.className = "text-center text-sm mt-4 font-bold text-red-400 min-h-[20px]";
    }
  } catch {
    msg.innerText = "Error de conexión";
    msg.className = "text-center text-sm mt-4 font-bold text-red-400 min-h-[20px]";
  }
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
  const userNameEl = document.getElementById('userName');
  if (userNameEl) userNameEl.innerText = `¡Hola, ${nombre}!`;
  const diff = Math.ceil((new Date(fechaVencimiento) - new Date()) / (1000*60*60*24));
  estaVencido = diff <= 0;
  const contadorEl = document.getElementById('contadorDias');
  if (contadorEl) {
    if (estaVencido) {
      contadorEl.innerHTML = "⚠️ VENCIDO";
      contadorEl.className = "mt-4 inline-flex items-center gap-1.5 bg-red-500/15 border border-red-500/30 text-red-400 px-3.5 py-1.5 rounded-full text-[13px] font-bold";
      const banner = document.getElementById('bannerVencido');
      if (banner) banner.classList.remove('hidden');
    } else {
      contadorEl.innerHTML = `✅ Activo (${diff} días)`;
      contadorEl.className = "mt-4 inline-flex items-center gap-1.5 bg-[#00C950]/15 border border-[#00C950]/30 text-[#00D084] px-3.5 py-1.5 rounded-full text-[13px] font-bold";
    }
  }
  cargarDestinos();
}

async function cargarDestinos() {
  if (estaVencido) return;
  try {
    const r = await fetch('/api/destinos', {credentials: 'include'});
    if (!r.ok) throw new Error('Error al cargar destinos');
    destinos = await r.json();
    const titulo = document.getElementById('recienteTitulo');
    const sub = document.getElementById('recienteSub');
    if (destinos.length > 0 && titulo && sub) {
      titulo.innerText = `${destinos[0].direccion} → ${destinos[destinos.length-1].direccion}`;
      sub.innerText = `${destinos.length} paradas`;
    }
  } catch(e) {
    console.error('Error en cargarDestinos:', e);
  }
}

function mostrarPerfil() {
  const email = localStorage.getItem('rutaflex_email') || 'usuario@rutaflex.com';
  const nombreEl = document.getElementById('perfilNombre');
  const emailEl = document.getElementById('perfilEmail');
  if (nombreEl) nombreEl.innerText = email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1);
  if (emailEl) emailEl.innerText = email;
}

window.addEventListener('load', async () => {
  const hoy = new Date();
  const fechaEl = document.getElementById('fechaHoy');
  if (fechaEl) fechaEl.innerText = `Hoy, ${hoy.getDate()} ${hoy.toLocaleDateString('es-AR', {month: 'short'}).replace('.','')}`;
  try {
    const r = await fetch('/api/yo', {credentials: 'include'});
    const d = await r.json();
    if (d.ok) mostrarApp(d.nombre, d.fecha_vencimiento);
  } catch(err) {
    console.error('Error al verificar sesión:', err);
  }
  // RECUPERAR RUTA GUARDADA SI VOLVIÓ DE GOOGLE MAPS
  try {
    const g = localStorage.getItem('rutaflex_ruta');
    if (g) {
      const data = JSON.parse(g);
      if (data.ordenadas && Date.now() - data.fecha < 12*60*60*1000) {
        rutaOptimizada = data.ordenadas;
        tramoActual = data.tramo || 0;
        if (tramoActual > 0 && tramoActual < Math.ceil(rutaOptimizada.length/9)) {
          setTimeout(() => mostrarPantallaTramos(data.gps), 800);
        }
      }
    }
  } catch(e) {}
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js', {scope: '/'}).catch(() => {});
  });
}
