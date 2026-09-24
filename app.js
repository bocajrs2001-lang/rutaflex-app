const CONFIG_RUTAFLEX = { whatsapp: "5491123793596", alias: "RUTAFLEX.MP", linkSemanal: "https://mpago.la/2DjaHdB", linkMensual: "https://mpago.la/2aNpJ1B" };
let destinos = []; let destinosDetectados = []; let inicioViaje = null; let tramoActual = 0; let emailRecuperacion = ""; let estaVencido = false;
window.togglePass = (inputId, icon) => { const input = document.getElementById(inputId); if (!input) return; if (input.type === "password") { input.type = "text"; icon.innerText = "🙈"; } else { input.type = "password"; icon.innerText = "👁️"; } };
function mostrarNotificacion(mensaje, tipo = 'info') { const contenedor = document.getElementById('notificaciones'); const notif = document.createElement('div'); let colores = 'bg-blue-600 text-white border-blue-500'; if (tipo === 'exito') colores = 'bg-green-600 text-white border-green-500'; if (tipo === 'error') colores = 'bg-red-600 text-white border-red-500'; if (tipo === 'advertencia') colores = 'bg-yellow-400 text-black border-yellow-300'; notif.className = `${colores} px-6 py-3 rounded-xl shadow-2xl font-bold text-sm text-center border`; notif.innerText = mensaje; contenedor.appendChild(notif); setTimeout(() => { notif.remove(); }, 4000); }
window.abrirModalPagos = function(plan, precio) { document.getElementById('modal-plan-texto').innerText = `Plan ${plan} - $${precio}`; document.getElementById('modal-alias-texto').innerText = CONFIG_RUTAFLEX.alias; const msg = encodeURIComponent(`Hola RutaFlex! Envío comprobante Plan ${plan} - $${precio}`); document.getElementById('btn-wsp-pago').href = `https://wa.me/${CONFIG_RUTAFLEX.whatsapp}?text=${msg}`; const linkMP = (plan === 'Semanal')? CONFIG_RUTAFLEX.linkSemanal : CONFIG_RUTAFLEX.linkMensual; document.getElementById('btn-mp-pago').href = linkMP; document.getElementById('payment-modal').classList.remove('hidden'); };
window.cerrarModalPagos = function() { document.getElementById('payment-modal').classList.add('hidden'); };
window.copiarAlias = function() { navigator.clipboard.writeText(CONFIG_RUTAFLEX.alias).then(() => { mostrarNotificacion("✅ Alias copiado", "exito"); }); };
window.addEventListener('load', async () => { const emailGuardado = localStorage.getItem('rutaflex_email'); if (emailGuardado && document.getElementById('loginEmail')) document.getElementById('loginEmail').value = emailGuardado; try { const res = await fetch('/api/yo', { credentials: 'include' }); const data = await res.json(); if (data.ok) mostrarApp(data.nombre, data.fecha_vencimiento); } catch (err) {} if (sessionStorage.getItem('pagoPendiente') === 'true') { sessionStorage.removeItem('pagoPendiente'); await verificarPagoDirecto(); } });
async function verificarPagoDirecto() { try { const res = await fetch('/api/verificar-pago-directo', { method: 'POST', credentials: 'include' }); const data = await res.json(); if (data.ok && data.activado) { mostrarNotificacion(`✅ ¡Pago confirmado!`, "exito"); setTimeout(() => location.reload(), 2000); } } catch (err) {} }
function ocultarTodasLasPantallasExcepto(id) { ['authScreen', 'recoverStep1', 'recoverStep2', 'recoverStep3', 'appScreen', 'perfilScreen', 'payment-modal'].forEach(s => { const el = document.getElementById(s); if(el) el.classList.add('hidden'); }); const target = document.getElementById(id); if(target) target.classList.remove('hidden'); }
if(document.getElementById('tabLogin')) document.getElementById('tabLogin').addEventListener('click', () => { ocultarTodasLasPantallasExcepto('authScreen'); document.getElementById('formLogin').classList.remove('hidden'); document.getElementById('formRegistro').classList.add('hidden'); });
if(document.getElementById('tabRegistro')) document.getElementById('tabRegistro').addEventListener('click', () => { ocultarTodasLasPantallasExcepto('authScreen'); document.getElementById('formRegistro').classList.remove('hidden'); document.getElementById('formLogin').classList.add('hidden'); });
if(document.getElementById('btnOlvideContrasena')) document.getElementById('btnOlvideContrasena').addEventListener('click', () => { ocultarTodasLasPantallasExcepto('recoverStep1'); });
if(document.getElementById('btnVolverLogin1')) document.getElementById('btnVolverLogin1').addEventListener('click', () => ocultarTodasLasPantallasExcepto('authScreen'));
if(document.getElementById('btnReenviarCodigo')) document.getElementById('btnReenviarCodigo').addEventListener('click', enviarCodigoRecuperacion);
async function enviarCodigoRecuperacion() { const emailInput = document.getElementById('recoverEmailInput'); const msg = document.getElementById('recoverMsg1'); if(!emailInput) return; const email = emailInput.value; if (!email) return; msg.innerText = "Enviando..."; try { const res = await fetch('/api/enviar-codigo-recuperacion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }); const data = await res.json(); if (res.ok) { emailRecuperacion = email; ocultarTodasLasPantallasExcepto('recoverStep2'); } else { msg.innerText = data.error; } } catch (err) {} }
if(document.getElementById('formRecoverEmail')) document.getElementById('formRecoverEmail').addEventListener('submit', async (e) => { e.preventDefault(); await enviarCodigoRecuperacion(); });
if(document.getElementById('formRecoverCode')) document.getElementById('formRecoverCode').addEventListener('submit', async (e) => { e.preventDefault(); const codigo = document.getElementById('recoverCodeInput').value; try { const res = await fetch('/api/verificar-codigo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: emailRecuperacion, codigo }) }); if (res.ok) { ocultarTodasLasPantallasExcepto('recoverStep3'); } } catch (err) {} });
if(document.getElementById('formNewPassword')) document.getElementById('formNewPassword').addEventListener('submit', async (e) => { e.preventDefault(); const nuevaPassword = document.getElementById('newPasswordInput').value; try { const res = await fetch('/api/cambiar-contrasena-final', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: emailRecuperacion, nuevaPassword }) }); if (res.ok) { ocultarTodasLasPantallasExcepto('authScreen'); } } catch (err) {} });
if(document.getElementById('formRegistro')) document.getElementById('formRegistro').addEventListener('submit', async (e) => { e.preventDefault(); const nombre = document.getElementById('regNombre').value; const email = document.getElementById('regEmail').value; const password = document.getElementById('regPassword').value; try { const res = await fetch('/api/registro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ nombre, email, password }) }); const data = await res.json(); if (res.ok) { localStorage.setItem('rutaflex_email', email); mostrarApp(data.usuario.nombre, data.usuario.fecha_vencimiento); } } catch (err) {} });
if(document.getElementById('formLogin')) document.getElementById('formLogin').addEventListener('submit', async (e) => { e.preventDefault(); const email = document.getElementById('loginEmail').value; const password = document.getElementById('loginPassword').value; try { const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ email, password }) }); const data = await res.json(); if (res.ok) { localStorage.setItem('rutaflex_email', email); mostrarApp(data.usuario.nombre, data.usuario.fecha_vencimiento); } } catch (err) {} });
async function hacerLogout() { await fetch('/api/logout', { method: 'POST', credentials: 'include' }); localStorage.removeItem('rutaflex_email'); location.reload(); }
if(document.getElementById('btnLogout')) document.getElementById('btnLogout')?.addEventListener('click', hacerLogout);
if(document.getElementById('btnLogoutDropdown')) document.getElementById('btnLogoutDropdown').addEventListener('click', hacerLogout);
if(document.getElementById('btnLogoutPerfil')) document.getElementById('btnLogoutPerfil').addEventListener('click', hacerLogout);
if(document.getElementById('btnPromo')) document.getElementById('btnPromo').addEventListener('click', async () => { const codigo = document.getElementById('promo').value; if (!codigo) return; const res = await fetch('/api/validar-promo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ codigo }) }); const data = await res.json(); mostrarNotificacion(data.mensaje, data.valido? "exito" : "error"); });

function mostrarApp(nombre, fechaVencimiento) {
  ocultarTodasLasPantallasExcepto('appScreen');
  const userNameEl = document.getElementById('userName'); if(userNameEl) userNameEl.innerText = `¡Hola, ${nombre}!`;
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
  } else if (diffDays <= 1) {
    if(contadorEl) { contadorEl.innerText = `⏳ Vence en ${diffDays} día`; contadorEl.className = "text-xs font-bold mt-1 px-2 py-0.5 rounded-full inline-block bg-yellow-500 text-[#0A2342]"; }
    if(alertaProximo) alertaProximo.classList.remove('hidden'); cargarDestinos();
  } else {
    if(contadorEl) { contadorEl.innerText = `✅ Activo (${diffDays} días)`; contadorEl.className = "text-xs font-bold mt-1 px-2 py-0.5 rounded-full inline-block bg-green-500 text-white"; }
    cargarDestinos();
  }
}
async function cargarDestinos() { if (estaVencido) return; try { const res = await fetch('/api/destinos', { credentials: 'include' }); destinos = await res.json(); renderLista(); } catch (err) {} }
function renderLista() { const l = document.getElementById('lista'); if(!l) return; l.innerHTML = ""; if (destinos.length === 0) { document.getElementById('count').innerText=0; document.getElementById('btnViaje')?.classList.add('hidden'); document.getElementById('placeholderVacio').style.display='block'; return; } document.getElementById('placeholderVacio').style.display='none'; destinos.forEach((d, i) => { l.innerHTML += `<li class="flex gap-2 border-b py-2 items-center"><span class="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">${i+1}</span><div class="flex-1"><b>${d.direccion}</b></div><button onclick="borrarDestino('${d._id}')" class="text-red-500 text-xs">🗑️</button></li>`; }); document.getElementById('count').innerText=destinos.length; document.getElementById('btnViaje')?.classList.remove('hidden'); }
window.borrarDestino = async (id) => { await fetch(`/api/destinos/${id}`,{method:'DELETE',credentials:'include'}); await cargarDestinos(); };
if(document.getElementById('fileImg')) document.getElementById('fileImg').addEventListener('change', async (e) => { const file = e.target.files[0]; if (!file) return; const { data: { text } } = await Tesseract.recognize(file, 'spa'); const lineas = text.split('\n').map(l => l.trim()).filter(l => l.length > 3); destinosDetectados = lineas; mostrarModalEdicion(); });
function mostrarModalEdicion() { const c = document.getElementById('contenedorInputs'); c.innerHTML = ''; destinosDetectados.forEach((dir, i) => { c.innerHTML += `<div class="flex gap-2 items-center bg-gray-50 p-2 rounded-lg border"><input type="text" value="${dir}" class="input-direccion flex-1 bg-transparent border-none p-1 text-sm"><button onclick="eliminarLinea(${i})" class="text-red-500 p-2">🗑️</button></div>`; }); document.getElementById('modalEdicion').classList.remove('hidden'); }
window.eliminarLinea = (i) => { destinosDetectados.splice(i, 1); mostrarModalEdicion(); };
if(document.getElementById('btnGuardarEdicion')) document.getElementById('btnGuardarEdicion').addEventListener('click', async () => { const inputs = document.querySelectorAll('.input-direccion'); const finales = Array.from(inputs).map(i => i.value.trim()).filter(v => v.length > 0); for (const d of finales) await fetch('/api/destinos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ direccion: d }) }); document.getElementById('modalEdicion').classList.add('hidden'); await cargarDestinos(); });
if(document.getElementById('btnCancelarEdicion')) document.getElementById('btnCancelarEdicion').addEventListener('click', () => document.getElementById('modalEdicion').classList.add('hidden'));
if(document.getElementById('btnCerrarModal')) document.getElementById('btnCerrarModal').addEventListener('click', () => document.getElementById('modalEdicion').classList.add('hidden'));

// MENÚ LOGO + PERFIL VENCIDO ROJO
const logoMenuBtn = document.getElementById('logoMenuBtn');
const logoDropdown = document.getElementById('logoDropdown');
if (logoMenuBtn) { logoMenuBtn.addEventListener('click', (e) => { e.stopPropagation(); logoDropdown.classList.toggle('hidden'); logoDropdown.classList.toggle('flex'); }); }
document.addEventListener('click', (e) => { if (logoDropdown &&!logoDropdown.contains(e.target) &&!logoMenuBtn.contains(e.target)) { logoDropdown.classList.add('hidden'); logoDropdown.classList.remove('flex'); } });
if (document.getElementById('btnIrPerfil')) { document.getElementById('btnIrPerfil').addEventListener('click', () => { logoDropdown.classList.add('hidden'); logoDropdown.classList.remove('flex'); mostrarPerfil(); }); }
function mostrarPerfil() {
  ocultarTodasLasPantallasExcepto('perfilScreen');
  const nombreEl = document.getElementById('perfilNombre'); const emailEl = document.getElementById('perfilEmail'); const estadoEl = document.getElementById('perfilEstado'); const avatarEl = document.getElementById('perfilAvatarWrapper'); const btnRenovarPerfil = document.getElementById('btnRenovarPerfil');
  const userEmail = localStorage.getItem('rutaflex_email') || 'usuario@rutaflex.com'; const nombreUsuario = userEmail.split('@')[0]; if(nombreEl) nombreEl.innerText = nombreUsuario; if(emailEl) emailEl.innerText = userEmail;
  if (estaVencido) {
    if(estadoEl){ estadoEl.innerText = "⚠️ VENCIDO"; estadoEl.className = "inline-block mt-4 px-5 py-1.5 rounded-full text-[12px] font-black bg-[#ff3b30] text-white shadow-[0_0_15px_rgba(255,59,48,0.5)] animate-pulse"; }
    if(avatarEl){ avatarEl.style.borderColor = "rgba(255, 59, 48, 0.7)"; avatarEl.style.boxShadow = "0 0 0 6px rgba(255, 59, 48, 0.15)"; }
    if(btnRenovarPerfil) btnRenovarPerfil.classList.remove('hidden');
  } else {
    if(estadoEl){ estadoEl.innerText = "✅ ACTIVO"; estadoEl.className = "inline-block mt-4 px-5 py-1.5 rounded-full text-[12px] font-black bg-green-500 text-white"; }
    if(avatarEl){ avatarEl.style.borderColor = "rgba(255,255,255,0.2)"; avatarEl.style.boxShadow = "none"; }
    if(btnRenovarPerfil) btnRenovarPerfil.classList.add('hidden');
  }
}
if (document.getElementById('btnVolverDePerfil')) { document.getElementById('btnVolverDePerfil').addEventListener('click', () => { ocultarTodasLasPantallasExcepto('appScreen'); }); }
if (document.getElementById('btnRenovarPerfil')) { document.getElementById('btnRenovarPerfil').addEventListener('click', () => { ocultarTodasLasPantallasExcepto('appScreen'); document.getElementById('bannerVencido')?.scrollIntoView({behavior: 'smooth'}); }); }
