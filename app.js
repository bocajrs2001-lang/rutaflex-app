let destinos = [];
let destinosDetectados = [];
let inicioViaje = null;
let tramoActual = 0;
let emailRecuperacion = ""; 
let estaVencido = false;

// ==========================================
// UTILIDADES UI
// ==========================================
window.togglePass = (inputId, icon) => {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === "password") { input.type = "text"; icon.innerText = ""; } 
  else { input.type = "password"; icon.innerText = "👁️"; }
};

function mostrarNotificacion(mensaje, tipo = 'info') {
  const contenedor = document.getElementById('notificaciones');
  const notif = document.createElement('div');
  let colores = 'bg-blue-600 text-white border-blue-500';
  if (tipo === 'exito') colores = 'bg-green-600 text-white border-green-500';
  if (tipo === 'error') colores = 'bg-red-600 text-white border-red-500';
  if (tipo === 'advertencia') colores = 'bg-yellow-400 text-black border-yellow-300';
  
  notif.className = `${colores} px-6 py-3 rounded-xl shadow-2xl font-bold text-sm text-center toast-anim pointer-events-auto border`;
  notif.innerText = mensaje;
  contenedor.appendChild(notif);
  setTimeout(() => { notif.style.opacity = '0'; notif.style.transform = 'translate(-50%, -20px)'; notif.style.transition = 'all 0.5s ease'; setTimeout(() => notif.remove(), 500); }, 4000);
}

// ==========================================
// INICIALIZACIÓN Y VERIFICACIÓN DE PAGO (PLAN B)
// ==========================================
window.addEventListener('load', async () => {
  const emailGuardado = localStorage.getItem('rutaflex_email');
  if (emailGuardado && document.getElementById('loginEmail')) document.getElementById('loginEmail').value = emailGuardado;

  try {
    const res = await fetch('/api/yo', { credentials: 'include' });
    const data = await res.json();
    if (data.ok) mostrarApp(data.nombre, data.fecha_vencimiento);
  } catch (err) { console.log('Sin sesión activa'); }

  // 🔥 SI VOLVIÓ DE UN PAGO, VERIFICAR AUTOMÁTICAMENTE
  if (sessionStorage.getItem('pagoPendiente') === 'true') {
    sessionStorage.removeItem('pagoPendiente');
    await verificarPagoDirecto();
  }
});

async function verificarPagoDirecto() {
  mostrarNotificacion("Verificando tu pago...", "info");
  try {
    const res = await fetch('/api/verificar-pago-directo', { method: 'POST', credentials: 'include' });
    const data = await res.json();
    
    if (data.ok && data.activado) {
      mostrarNotificacion(`✅ ¡Pago confirmado! Plan activo por ${data.dias} días.`, "exito");
      setTimeout(() => location.reload(), 2000);
    } else {
      mostrarNotificacion("⏳ Procesando pago. Si ya pagaste y sigue vencido, contactá soporte.", "advertencia");
    }
  } catch (err) { console.error("Error verificando pago:", err); }
}

// ==========================================
// NAVEGACIÓN
// ==========================================
function ocultarTodasLasPantallasExcepto(id) { 
  ['authScreen', 'recoverStep1', 'recoverStep2', 'recoverStep3', 'appScreen'].forEach(s => {
    const el = document.getElementById(s); if(el) el.classList.add('hidden');
  }); 
  const target = document.getElementById(id); if(target) target.classList.remove('hidden');
}

if(document.getElementById('tabLogin')) document.getElementById('tabLogin').addEventListener('click', () => { 
  ocultarTodasLasPantallasExcepto('authScreen'); 
  document.getElementById('formLogin').classList.remove('hidden'); document.getElementById('formRegistro').classList.add('hidden'); 
  document.getElementById('tabLogin').className = "flex-1 py-2 px-4 rounded-xl font-bold text-accent bg-white/10 transition-all";
  document.getElementById('tabRegistro').className = "flex-1 py-2 px-4 rounded-xl font-bold text-white/60 hover:text-white transition-all";
  document.getElementById('authMessage').innerText = ''; 
});

if(document.getElementById('tabRegistro')) document.getElementById('tabRegistro').addEventListener('click', () => { 
  ocultarTodasLasPantallasExcepto('authScreen'); 
  document.getElementById('formRegistro').classList.remove('hidden'); document.getElementById('formLogin').classList.add('hidden'); 
  document.getElementById('tabRegistro').className = "flex-1 py-2 px-4 rounded-xl font-bold text-accent bg-white/10 transition-all";
  document.getElementById('tabLogin').className = "flex-1 py-2 px-4 rounded-xl font-bold text-white/60 hover:text-white transition-all";
  document.getElementById('authMessage').innerText = ''; 
});

if(document.getElementById('btnOlvideContrasena')) document.getElementById('btnOlvideContrasena').addEventListener('click', () => { 
  ocultarTodasLasPantallasExcepto('recoverStep1'); 
  if(document.getElementById('recoverEmailInput')) document.getElementById('recoverEmailInput').value = document.getElementById('loginEmail').value || ''; 
  if(document.getElementById('recoverMsg1')) document.getElementById('recoverMsg1').innerText = ''; 
});

if(document.getElementById('btnVolverLogin1')) document.getElementById('btnVolverLogin1').addEventListener('click', () => ocultarTodasLasPantallasExcepto('authScreen'));
if(document.getElementById('btnReenviarCodigo')) document.getElementById('btnReenviarCodigo').addEventListener('click', enviarCodigoRecuperacion);

// ==========================================
// RECUPERACIÓN
// ==========================================
async function enviarCodigoRecuperacion() { 
  const emailInput = document.getElementById('recoverEmailInput'); const msg = document.getElementById('recoverMsg1');
  if(!emailInput || !msg) return;
  const email = emailInput.value; 
  if (!email) { msg.innerText = "Ingresá tu email"; msg.className = "text-red-300 font-bold text-sm mt-4 text-center"; return; } 
  msg.innerText = "Enviando..."; msg.className = "text-blue-300 font-bold text-sm mt-4 text-center"; 
  try { 
    const res = await fetch('/api/enviar-codigo-recuperacion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }); 
    const data = await res.json(); 
    if (res.ok) { emailRecuperacion = email; mostrarNotificacion(" Código enviado", "exito"); ocultarTodasLasPantallasExcepto('recoverStep2'); if(document.getElementById('recoverMsg2')) document.getElementById('recoverMsg2').innerText = ''; } 
    else { msg.innerText = data.error; msg.className = "text-red-300 font-bold text-sm mt-4 text-center"; } 
  } catch (err) { mostrarNotificacion("❌ Error de conexión", "error"); } 
}

if(document.getElementById('formRecoverEmail')) document.getElementById('formRecoverEmail').addEventListener('submit', async (e) => { e.preventDefault(); await enviarCodigoRecuperacion(); });

if(document.getElementById('formRecoverCode')) document.getElementById('formRecoverCode').addEventListener('submit', async (e) => { 
  e.preventDefault(); const codigo = document.getElementById('recoverCodeInput').value; const msg = document.getElementById('recoverMsg2'); 
  msg.innerText = "Verificando..."; msg.className = "text-blue-300 font-bold text-sm mt-4 text-center"; 
  try { 
    const res = await fetch('/api/verificar-codigo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: emailRecuperacion, codigo }) }); 
    const data = await res.json(); 
    if (res.ok) { mostrarNotificacion("✅ Código correcto", "exito"); ocultarTodasLasPantallasExcepto('recoverStep3'); if(document.getElementById('recoverMsg3')) document.getElementById('recoverMsg3').innerText = ''; } 
    else { msg.innerText = data.error; msg.className = "text-red-300 font-bold text-sm mt-4 text-center"; } 
  } catch (err) { mostrarNotificacion("❌ Error", "error"); } 
});

if(document.getElementById('formNewPassword')) document.getElementById('formNewPassword').addEventListener('submit', async (e) => { 
  e.preventDefault(); const nuevaPassword = document.getElementById('newPasswordInput').value; const msg = document.getElementById('recoverMsg3'); 
  msg.innerText = "Guardando..."; msg.className = "text-blue-300 font-bold text-sm mt-4 text-center"; 
  try { 
    const res = await fetch('/api/cambiar-contrasena-final', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: emailRecuperacion, nuevaPassword }) }); 
    const data = await res.json(); 
    if (res.ok) { mostrarNotificacion("¡Contraseña cambiada!", "exito"); setTimeout(() => { ocultarTodasLasPantallasExcepto('authScreen'); if(document.getElementById('loginEmail')) document.getElementById('loginEmail').value = emailRecuperacion; if(document.getElementById('loginPassword')) document.getElementById('loginPassword').value = ''; emailRecuperacion = ""; }, 2000); } 
    else { msg.innerText = data.error; msg.className = "text-red-300 font-bold text-sm mt-4 text-center"; } 
  } catch (err) { mostrarNotificacion("❌ Error", "error"); } 
});

// ==========================================
// AUTENTICACIÓN
// ==========================================
if(document.getElementById('formRegistro')) document.getElementById('formRegistro').addEventListener('submit', async (e) => { 
  e.preventDefault(); const nombre = document.getElementById('regNombre').value; const email = document.getElementById('regEmail').value; const password = document.getElementById('regPassword').value; const msg = document.getElementById('authMessage'); 
  msg.innerText = "Creando cuenta..."; msg.className = "text-blue-300 font-bold text-sm mt-4 text-center"; 
  try { 
    const res = await fetch('/api/registro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ nombre, email, password }) }); 
    const data = await res.json(); 
    if (res.ok) { localStorage.setItem('rutaflex_email', email); mostrarNotificacion("✅ ¡Cuenta creada!", "exito"); setTimeout(() => mostrarApp(data.usuario.nombre, data.usuario.fecha_vencimiento), 1000); } 
    else { msg.innerText = data.error; msg.className = "text-red-300 font-bold text-sm mt-4 text-center"; } 
  } catch (err) { mostrarNotificacion("❌ Error de conexión", "error"); } 
});

if(document.getElementById('formLogin')) document.getElementById('formLogin').addEventListener('submit', async (e) => {
  e.preventDefault(); const email = document.getElementById('loginEmail').value; const password = document.getElementById('loginPassword').value; const msg = document.getElementById('authMessage');
  msg.innerText = "Conectando..."; msg.className = "text-center text-sm mt-4 font-bold text-blue-300";
  const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 15000));
  try {
    const res = await Promise.race([fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ email, password }) }), timeoutPromise]);
    const data = await res.json();
    if (res.ok) { localStorage.setItem('rutaflex_email', email); mostrarNotificacion(`👋 ¡Bienvenido, ${data.usuario.nombre}!`, "exito"); setTimeout(() => mostrarApp(data.usuario.nombre, data.usuario.fecha_vencimiento), 1000); } 
    else { msg.innerText = data.error || "Email o contraseña incorrectos"; msg.className = "text-center text-sm mt-4 font-bold text-red-300"; }
  } catch (err) { 
    if (err.message === 'TIMEOUT') { msg.innerText = "⏳ Servidor despertando (~40 seg). Esperá y probá de nuevo."; msg.className = "text-center text-sm mt-4 font-bold text-yellow-300"; } 
    else { msg.innerText = "❌ Error de conexión."; msg.className = "text-center text-sm mt-4 font-bold text-red-300"; }
  }
});

if(document.getElementById('btnLogout')) document.getElementById('btnLogout').addEventListener('click', async () => { await fetch('/api/logout', { method: 'POST', credentials: 'include' }); mostrarNotificacion("👋 Sesión cerrada.", "info"); setTimeout(() => location.reload(), 1000); });

// CANCELAR SUSCRIPCIÓN (CORREGIDO: No hace logout)
if(document.getElementById('btnCancelarSub')) document.getElementById('btnCancelarSub').addEventListener('click', async () => {
  if (!confirm("¿Cancelar plan? Perderás acceso premium pero podrás seguir usando la app.")) return;
  mostrarNotificacion("Procesando...", "info");
  try {
    const res = await fetch('/api/cancelar-suscripcion', { method: 'POST', credentials: 'include' });
    const data = await res.json();
    if (res.ok) { 
      mostrarNotificacion("Plan cancelado. Podés reactivarlo cuando quieras.", "advertencia"); 
      setTimeout(() => { const n = document.getElementById('userName')?.innerText.replace('¡Hola, ', '').replace('! 👋', '') || "Usuario"; mostrarApp(n, new Date(0)); }, 1500);
    } else { mostrarNotificacion("Error: " + data.error, "error"); }
  } catch (err) { mostrarNotificacion("Error de conexión", "error"); }
});

if(document.getElementById('btnPromo')) document.getElementById('btnPromo').addEventListener('click', async () => { 
  const codigo = document.getElementById('promo').value; if (!codigo) return mostrarNotificacion("⚠️ Escribí un código.", "advertencia"); 
  const msg = document.getElementById('promoMessage'); const res = await fetch('/api/validar-promo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ codigo }) }); const data = await res.json(); 
  if (data.valido) { mostrarNotificacion("✨ " + data.mensaje, "exito"); if(msg) msg.className = "hidden"; } else { mostrarNotificacion("❌ " + data.mensaje, "error"); if(msg) msg.className = "hidden"; } 
});

// PAGO (MARCA PENDIENTE ANTES DE REDIRIGIR)
window.simularPago = async (plan) => {
  mostrarNotificacion("Generando link seguro...", "info");
  try {
    const res = await fetch('/api/crear-preferencia-pago', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ plan }) });
    const data = await res.json();
    if (res.ok && data.init_point) {
      sessionStorage.setItem('pagoPendiente', 'true'); // 🔥 FLAG PARA PLAN B
      window.location.href = data.init_point;
    } else { mostrarNotificacion("Error: " + (data.error || 'Desconocido'), "error"); }
  } catch (err) { mostrarNotificacion("Error de conexión", "error"); }
};

// ==========================================
// DASHBOARD
// ==========================================
function mostrarApp(nombre, fechaVencimiento) {
  ocultarTodasLasPantallasExcepto('appScreen');
  const userNameEl = document.getElementById('userName'); if(userNameEl) userNameEl.innerText = `¡Hola, ${nombre}! 👋`;
  const contadorEl = document.getElementById('contadorDias'); const bannerVencido = document.getElementById('bannerVencido'); const alertaProximo = document.getElementById('alertaProximoVencimiento');
  const seccionDestinos = document.getElementById('seccionDestinos'); const listaContainer = document.getElementById('listaContainer');
  
  const hoy = new Date(); const venc = new Date(fechaVencimiento); const diffDays = Math.ceil((venc - hoy) / (1000 * 60 * 60 * 24)); 
  
  if(bannerVencido) bannerVencido.classList.add('hidden'); if(alertaProximo) alertaProximo.classList.add('hidden');
  if(seccionDestinos) { seccionDestinos.style.opacity = "1"; seccionDestinos.style.pointerEvents = "auto"; }
  if(listaContainer) { listaContainer.style.opacity = "1"; listaContainer.style.pointerEvents = "auto"; }
  estaVencido = false;

  if (!fechaVencimiento || diffDays <= 0) {
    estaVencido = true;
    if(contadorEl) { contadorEl.innerText = "⚠️ VENCIDO"; contadorEl.className = "text-xs font-bold mt-1 px-2 py-0.5 rounded-full inline-block bg-red-600 text-white"; }
    if(bannerVencido) bannerVencido.classList.remove('hidden');
    if(seccionDestinos) { seccionDestinos.style.opacity = "0.3"; seccionDestinos.style.pointerEvents = "none"; }
    if(listaContainer) { listaContainer.style.opacity = "0.3"; listaContainer.style.pointerEvents = "none"; }
    const lista = document.getElementById('lista'); if(lista) lista.innerHTML = '<li class="text-center text-red-500 py-4 font-bold">Renová tu plan para usar el servicio.</li>';
    const count = document.getElementById('count'); if(count) count.innerText = "-";
    const btnViaje = document.getElementById('btnViaje'); if(btnViaje) btnViaje.classList.add('hidden');
    mostrarNotificacion("Tu plan está vencido. Renová abajo 👇", "advertencia");
  } else if (diffDays <= 1) {
    if(contadorEl) { contadorEl.innerText = `⏳ Vence en ${diffDays} día${diffDays !== 1 ? 's' : ''}`; contadorEl.className = "text-xs font-bold mt-1 px-2 py-0.5 rounded-full inline-block bg-yellow-500 text-[#0A2342] animate-pulse"; }
    if(alertaProximo) alertaProximo.classList.remove('hidden'); cargarDestinos();
  } else {
    if(contadorEl) { contadorEl.innerText = `✅ Activo (${diffDays} días)`; contadorEl.className = "text-xs font-bold mt-1 px-2 py-0.5 rounded-full inline-block bg-green-500 text-white"; }
    cargarDestinos();
  }
}

async function cargarDestinos() { if (estaVencido) return; try { const res = await fetch('/api/destinos', { credentials: 'include' }); destinos = await res.json(); renderLista(); } catch (err) { console.error(err); } }

if(document.getElementById('fileImg')) document.getElementById('fileImg').addEventListener('change', async (e) => {
  if (estaVencido) { mostrarNotificacion("⚠️ Plan vencido.", "advertencia"); e.target.value = ''; return; }
  const file = e.target.files[0]; if (!file) return;
  const btn = document.getElementById('btnCargar'); const txt = btn ? btn.innerText : "";
  if(btn) { btn.innerText = "🤖 Leyendo..."; btn.disabled = true; btn.classList.add('opacity-75'); }
  try {
    if (typeof Tesseract === 'undefined') throw new Error('Tesseract no cargó');
    const { data: { text } } = await Tesseract.recognize(file, 'spa');
    const lineas = text.split('\n').map(l => l.trim()).filter(l => l.length > 3);
    if (lineas.length === 0) mostrarNotificacion("⚠️ Texto no detectado.", "advertencia");
    else { destinosDetectados = lineas; mostrarModalEdicion(); }
  } catch (error) { mostrarNotificacion("❌ Error al procesar.", "error"); } 
  finally { if(btn) { btn.innerText = txt; btn.disabled = false; btn.classList.remove('opacity-75'); } e.target.value = ''; }
});

function mostrarModalEdicion() { 
  const c = document.getElementById('contenedorInputs'); if(!c) return; c.innerHTML = ''; 
  if (destinosDetectados.length === 0) c.innerHTML = '<p class="text-center text-gray-500 py-4">Sin direcciones.</p>';
  else destinosDetectados.forEach((dir, i) => { c.innerHTML += `<div class="flex gap-2 items-center bg-gray-50 p-2 rounded-lg border"><span class="text-gray-400 font-bold w-6">${i+1}.</span><input type="text" value="${dir.replace(/"/g, '&quot;')}" class="input-direccion flex-1 bg-transparent border-none p-1 text-sm focus:outline-none focus:bg-white rounded"><button onclick="eliminarLinea(${i})" class="text-red-500 p-2">🗑️</button></div>`; });
  const m = document.getElementById('modalEdicion'); if(m) m.classList.remove('hidden'); 
}
window.eliminarLinea = (i) => { destinosDetectados.splice(i, 1); mostrarModalEdicion(); };

if(document.getElementById('btnGuardarEdicion')) document.getElementById('btnGuardarEdicion').addEventListener('click', async () => {
  if (estaVencido) return mostrarNotificacion("⚠️ Plan vencido.", "advertencia");
  const inputs = document.querySelectorAll('.input-direccion'); const finales = Array.from(inputs).map(i => i.value.trim()).filter(v => v.length > 0);
  if (finales.length === 0) return mostrarNotificacion("⚠️ Sin direcciones.", "advertencia");
  const btn = document.getElementById('btnGuardarEdicion'); const t = btn.innerText; btn.innerText = "Guardando..."; btn.disabled = true;
  try { for (const d of finales) await fetch('/api/destinos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ direccion: d }) }); mostrarNotificacion("✨ Guardado.", "exito"); await cargarDestinos(); } catch(e) { mostrarNotificacion("Error", "error"); }
  finally { btn.innerText = t; btn.disabled = false; const m = document.getElementById('modalEdicion'); if(m) m.classList.add('hidden'); }
});

if(document.getElementById('btnCancelarEdicion')) document.getElementById('btnCancelarEdicion').addEventListener('click', () => document.getElementById('modalEdicion').classList.add('hidden'));
if(document.getElementById('btnCerrarModal')) document.getElementById('btnCerrarModal').addEventListener('click', () => document.getElementById('modalEdicion').classList.add('hidden'));

function renderLista() { 
  const l = document.getElementById('lista'); if(!l) return; l.innerHTML = ""; 
  if (destinos.length === 0) { l.innerHTML = '<li class="text-center text-gray-400 py-4">Sin destinos. Cargá una foto.</li>'; const b=document.getElementById('btnViaje'); if(b) b.classList.add('hidden'); const c=document.getElementById('count'); if(c) c.innerText=0; return; } 
  destinos.forEach((d, i) => { setTimeout(() => { l.innerHTML += `<li class="flex gap-2 border-b py-2 items-center bg-white/50 p-2 rounded-lg"><span class="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs flex-shrink-0">🏠</span><div class="flex-1 min-w-0"><b class="block truncate">${d.direccion}</b><span class="text-xs text-green-600">${d.distancia} km • ~${d.tiempo} min</span></div><button onclick="borrarDestino('${d._id}')" class="text-red-500 text-xs px-2 hover:bg-red-50 rounded flex-shrink-0">🗑️</button></li>`; }, i*50); });
  const c=document.getElementById('count'); if(c) c.innerText=destinos.length; const b=document.getElementById('btnViaje'); if(b){b.classList.remove('hidden'); inicioViaje=inicioViaje||new Date();}
}

window.borrarDestino = async (id) => { if(estaVencido) return mostrarNotificacion("⚠️ Vencido.","advertencia"); await fetch(`/api/destinos/${id}`,{method:'DELETE',credentials:'include'}); mostrarNotificacion("️ Eliminado.","info"); await cargarDestinos(); };

function limpiarDireccion(d) { let l=d.replace(/^\d+\.\s*/,'').replace(/\[GR\]\s*/i,'').replace(/General\s+Rodríguez\s*,?\s*/gi,'').trim(); if(!/General\s+Rodríguez/i.test(l)) l+=', General Rodríguez, Buenos Aires'; return l; }

if(document.getElementById('btnViaje')) document.getElementById('btnViaje').addEventListener('click', () => {
  if(estaVencido) return mostrarNotificacion("⚠️ Vencido.","advertencia");
  const tramo=destinos.slice(tramoActual,tramoActual+10);
  if(tramo.length===0){const s=document.getElementById('stats');if(s){s.classList.remove('hidden');document.getElementById('statHoras').innerText=((new Date()-inicioViaje)/3600000).toFixed(1);document.getElementById('statKm').innerText=(tramoActual*0.9).toFixed(1);document.getElementById('statEntregas').innerText=tramoActual;}return;}
  const origin="General Rodriguez, Buenos Aires, Argentina"; const dirs=tramo.map(d=>limpiarDireccion(d.direccion)); let url='';
  if(dirs.length===1) url=`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dirs[0])}&travelmode=driving`;
  else{const dest=dirs[dirs.length-1];const wp=dirs.slice(0,-1).map(d=>encodeURIComponent(d)).join('|');url=`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}&waypoints=${wp}&travelmode=driving`;}
  mostrarNotificacion("🗺️ Abriendo Maps...","info"); window.open(url,"_blank"); tramoActual+=10; const sig=tramoActual+10; const b=document.getElementById('btnViaje'); if(b) b.innerText=tramoActual<destinos.length?`SIGUIENTE TRAMO (${tramoActual+1}-${Math.min(sig,destinos.length)})`:"🏆 ESTADÍSTICAS FINALES";
});

async function abrirCamara() {
  if(estaVencido) return mostrarNotificacion("⚠️ Vencido.","advertencia");
  const v=document.getElementById('camara'); if(v){v.classList.remove('hidden'); try{const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});v.srcObject=s;}catch(e){mostrarNotificacion("📷 Error cámara.","error");}}
}
