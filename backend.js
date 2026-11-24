require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const mongoose = require('mongoose');
const { Resend } = require('resend');
const { MercadoPagoConfig, Preference } = require('mercadopago');

const { 
  registrarUsuario, loginUsuario, obtenerDestinosDeUsuario, agregarDestino, 
  borrarDestino, borrarDestinosDeUsuario, actualizarContrasena, 
  buscarUsuarioPorEmail, cancelarSuscripcionUsuario, actualizarVencimiento
} = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
const resend = new Resend(process.env.RESEND_API_KEY);
const codigosVerificacion = new Map();

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Conectado a MongoDB Atlas'))
  .catch(err => console.error('❌ Error MongoDB:', err));

app.use(cors({ 
  origin: ['http://127.0.0.1:5500', 'http://localhost:5500', 'http://localhost:3000', 'https://rutaflex-app.onrender.com'], 
  credentials: true 
}));
app.use(express.json());

// ✅ PWA - RUTAS EXPLICITAS PARA QUE RENDER NO FALLE
app.get('/manifest.json', (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json');
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'public', 'manifest.json'));
});
app.get('/service-worker.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Service-Worker-Allowed', '/');
  res.sendFile(path.join(__dirname, 'public', 'service-worker.js'));
});
app.get('/sw.js', (req, res) => {
  res.redirect('/service-worker.js');
});

app.use(express.static(path.join(__dirname)));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'favicon.ico'), (err) => {
    if (err) res.sendFile(path.join(__dirname, 'public', 'android-chrome-192x192.png'));
  });
});

app.use(session({ 
  secret: 'rutaflex_secret_super_seguro_2026', 
  resave: false, 
  saveUninitialized: false, 
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: 'lax', secure: false } 
}));

function usuarioLogueado(req, res, next) {
  if (req.session && req.session.userId) return next();
  res.status(401).json({ error: 'Debes iniciar sesión' });
}

function suscripcionVigente(req, res, next) {
  const user = req.session.user;
  if (!user || !user.fecha_vencimiento || new Date(user.fecha_vencimiento) < new Date()) {
    return res.status(403).json({ error: 'Suscripción vencida. Renová tu plan.', vencido: true });
  }
  next();
}

// ============================================================
// FIX RUTAFLEX - ANTI-DUPLICADOS + CORRECCIÓN AUTOMÁTICA
// Misma lógica que en app.js para que frontend y backend coincidan
// ============================================================
function normalizarDireccionBackend(d) {
  let s = (d||'').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[.,#\-]/g," ").replace(/\s+/g," ").trim();
  s = s.replace(/^(palermo|belgrano|nunez|caballito|recoleta|la boca|centro|san telmo|villa crespo|almagro|flores|barracas|san nicolas|retiro)\s+/g, "");
  s = s.replace(/\s+av$/,"").replace(/\s+avenida$/,"");
  s = s.replace(/\b(av|avenida|avda)\b/g,"av").replace(/\b(calle)\b/g,"").replace(/\s+/g," ").trim();
  s = s.replace(/\b(arribenos|arribennos)\b/g,"");
  return s.replace(/\s+/g," ").trim();
}
function claveDuplicadoBackend(d){
  const n = normalizarDireccionBackend(d);
  const m = n.match(/([a-z\s]+?)\s+(\d{1,5})/);
  if(m) return m[1].trim().replace(/\s+/g," ") + " " + m[2];
  return n;
}
function limpiarListaBackend(lista){
  const vistos = new Set(); const out = [];
  (lista||[]).forEach(raw=>{
    const dir = typeof raw === 'string' ? raw.trim() : (raw.direccion || raw.texto || '').trim();
    if(!dir || dir.length < 4) return;
    const k = claveDuplicadoBackend(dir);
    if(!vistos.has(k)){ vistos.add(k); out.push(dir); }
  });
  return out;
}
function corregirDireccionBackend(dir){
  let d = (dir||'').trim();
  d = d.replace(/^(Palermo|Belgrano|Núñez|Nunez|La Boca|Centro|Recoleta|Caballito)\s+/i,'').replace(/\s+(Av|Av\.|Avenida)\s*$/i,'').trim();
  d = d.replace(/Arribenos|Arribennos/gi,'').replace(/\s{2,}/g,' ').replace(/,\s*,/g,',').trim();
  return d;
}

const erroresRecibidos = [];
const ultimoAvisoEnviado = {};
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'rutaflex.soporte@gmail.com';
const ADMIN_WHATSAPP = '5491123793596';

function esErrorDeUsuarioBackend(detalle = '') {
  const d = String(detalle || '').toLowerCase();
  const ignorar = ['no se encontró','no se encontro','revisá número','revisa numero','duplicada','duplicado','sin ubicación','sin ubicacion','ingresá al menos','pegá algún texto','pega algun texto','imagen sin texto','pdf sin texto','no se detectaron direcciones','no hay direcciones','no hay rutas recientes','sin rutas recientes','no se pudo abrir la cámara','no se pudo obtener dirección','error de conexión','plan vencido','email o contraseña'];
  return ignorar.some(p => d.includes(p));
}

async function avisarAdminCritico({ tipo, detalle, cantidad, usuarios }) {
  const texto = `🚨 ALERTA RutaFlex - ERROR CRITICO\n\nTipo: ${tipo}\nDetalle: ${detalle}\nUsuarios afectados: ${cantidad} (en 10 min)\nUsuarios: ${usuarios.slice(0,5).join(', ')}\nFecha: ${new Date().toLocaleString('es-AR')}\n\nRevisar backend.js / Nominatim / Maps.`;
  console.log('🚨 [NIVEL 1 PRO] ' + texto);
  try {
    if (process.env.RESEND_API_KEY) {
      await resend.emails.send({
        from: 'RUTAFLEX ALERTA <onboarding@resend.dev>',
        to: ADMIN_EMAIL,
        subject: `🚨 RutaFlex: ${tipo} - ${cantidad} usuarios afectados`,
        html: `<div style="font-family:sans-serif; padding:20px; background:#0A1220; color:white; border-radius:12px;"><h2 style="color:#ff4444;">🚨 ALERTA RutaFlex</h2><p><b>Tipo:</b> ${tipo}</p><p><b>Detalle:</b> ${detalle}</p><p><b>Usuarios afectados:</b> ${cantidad} en 10 min</p><p><b>Usuarios:</b> ${usuarios.join(', ')}</p><p><b>Fecha:</b> ${new Date().toLocaleString('es-AR')}</p><p style="color:#00E5FF;">Revisar: Nominatim / Google Maps / /api/destinos / Optimizador</p></div>`
      });
      console.log('✅ [NIVEL 1 PRO] Mail de alerta enviado a', ADMIN_EMAIL);
    }
  } catch(e) { console.error('❌ [NIVEL 1 PRO] No se pudo enviar mail:', e.message); }
  try {
    if (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID) {
      await fetch(`https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: ADMIN_WHATSAPP, type: 'text', text: { body: texto } })
      });
      console.log('✅ [NIVEL 1 PRO] WhatsApp enviado');
    }
  } catch(e) { console.error('❌ [NIVEL 1 PRO] No se pudo enviar WhatsApp:', e.message); }
}

app.post('/api/report-error', (req, res) => {
  try {
    const { tipo, detalle, cantidad, usuarios } = req.body || {};
    if (!tipo || !detalle) return res.json({ ok: true, ignorado: true });
    if (esErrorDeUsuarioBackend(detalle)) return res.json({ ok: true, ignorado: true, motivo: 'error de usuario' });
    const ahora = Date.now();
    erroresRecibidos.push({ tipo, detalle: String(detalle).slice(0,300), usuario: (usuarios && usuarios[0]) || 'anonimo', usuarios: usuarios || [], fecha: ahora, cantidad: cantidad || 1 });
    while (erroresRecibidos.length > 200) erroresRecibidos.shift();
    const recientes = erroresRecibidos.filter(e => e.tipo === tipo && ahora - e.fecha < 10*60*1000);
    const usuariosUnicos = [...new Set(recentes.flatMap(e => e.usuarios || [e.usuario]))];
    const totalReportes = recientes.reduce((acc, e) => acc + (e.cantidad || 1), 0);
    if (totalReportes >= 3) {
      if (ultimoAvisoEnviado[tipo] && ahora - ultimoAvisoEnviado[tipo] < 15*60*1000) {
        return res.json({ ok: true, ya_avisado: true });
      }
      ultimoAvisoEnviado[tipo] = ahora;
      avisarAdminCritico({ tipo, detalle, cantidad: totalReportes, usuarios: usuariosUnicos });
      for (let i = erroresRecibidos.length - 1; i >= 0; i--) {
        if (erroresRecibidos[i].tipo === tipo) erroresRecibidos.splice(i, 1);
      }
      return res.json({ ok: true, alerta_enviada: true });
    }
    return res.json({ ok: true, guardado: true, recientes: totalReportes });
  } catch(e) {
    console.error('Error en /api/report-error:', e.message);
    return res.json({ ok: true });
  }
});

app.get('/api/errores', (req, res) => {
  if (req.query.key !== 'rutaflex2026') return res.status(401).json({ error: 'No autorizado' });
  res.json({ ok: true, total: erroresRecibidos.length, errores: erroresRecibidos.slice(-50), ultimoAviso: ultimoAvisoEnviado });
});

app.post('/api/crear-preferencia-pago', usuarioLogueado, async (req, res) => {
  try {
    const { plan } = req.body;
    let precio, titulo, diasExtra;
    if (plan === 'mensual') { precio = 14990; titulo = 'RUTAFLEX - Plan Mensual'; diasExtra = 30; } 
    else { precio = 4990; titulo = 'RUTAFLEX - Plan Semanal'; diasExtra = 7; }
    const preference = new Preference(mpClient);
    const result = await preference.create({
      body: {
        items: [{ id: `rutaflex_${plan}_${req.session.userId}`, title: titulo, quantity: 1, currency_id: 'ARS', unit_price: precio }],
        payer: { email: req.session.user.email, name: req.session.nombre },
        back_urls: { success: 'https://rutaflex-app.onrender.com/', failure: 'https://rutaflex-app.onrender.com/', pending: 'https://rutaflex-app.onrender.com/' },
        auto_return: 'approved',
        notification_url: 'https://rutaflex-app.onrender.com/api/webhook-mp',
        external_reference: req.session.userId.toString()
      }
    });
    res.json({ ok: true, init_point: result.init_point });
  } catch (err) { res.status(500).json({ error: 'Error al generar link de pago' }); }
});

app.post('/api/verificar-pago-directo', usuarioLogueado, async (req, res) => {
  try {
    const userId = req.session.userId.toString();
    const payments = await mpClient.payment.search({ options: { external_reference: userId, sort: 'date_created', criteria: 'desc', limit: 5 } });
    if (payments.results && payments.results.length > 0) {
      const pagoAprobado = payments.results.find(p => p.status === 'approved');
      if (pagoAprobado) {
        const itemTitle = pagoAprobado.additional_info?.items?.[0]?.title || '';
        const diasExtra = itemTitle.includes('Mensual') ? 30 : 7;
        await actualizarVencimiento(userId, diasExtra);
        req.session.user.fecha_vencimiento = new Date(Date.now() + diasExtra * 24 * 60 * 60 * 1000);
        return res.json({ ok: true, activado: true, dias: diasExtra });
      }
    }
    res.json({ ok: false, activado: false });
  } catch (err) { res.status(500).json({ ok: false, activado: false, error: err.message }); }
});

app.post('/api/webhook-mp', async (req, res) => {
  const { type, data } = req.body;
  if (type === 'payment' || type === 'pay') {
    try {
      const mpPayment = await mpClient.payment.get({ id: data.id });
      if (mpPayment.status === 'approved' && mpPayment.external_reference) {
        const itemTitle = mpPayment.additional_info?.items?.[0]?.title || '';
        await actualizarVencimiento(mpPayment.external_reference, itemTitle.includes('Mensual') ? 30 : 7);
      }
    } catch (err) { console.error('❌ ERROR EN WEBHOOK:', err.message); }
  }
  res.status(200).send('OK');
});

app.post('/api/enviar-codigo-recuperacion', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Ingresá tu email' });
    const usuario = await buscarUsuarioPorEmail(email);
    if (!usuario) return res.status(404).json({ error: 'No existe cuenta con ese email' });
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    codigosVerificacion.set(email, { codigo, expira: Date.now() + 10 * 60 * 1000 });
    await resend.emails.send({
      from: 'RUTAFLEX <onboarding@resend.dev>',
      to: email,
      subject: '🔐 Tu código de recuperación',
      html: `<div style="font-family:sans-serif; padding:20px;"><h2>RUTAFLEX</h2><p>Tu código es:</p><h1 style="color:#0A1220; letter-spacing:5px;">${codigo}</h1><p>Expira en 10 min.</p></div>`
    });
    res.json({ ok: true, mensaje: 'Código enviado' });
  } catch (err) { res.status(500).json({ error: 'Error del servidor' }); }
});

app.post('/api/verificar-codigo', (req, res) => {
  const { email, codigo } = req.body;
  const datos = codigosVerificacion.get(email);
  if (!datos || datos.codigo !== codigo || Date.now() > datos.expira) {
    codigosVerificacion.delete(email);
    return res.status(400).json({ error: 'Código incorrecto o expirado' });
  }
  codigosVerificacion.delete(email);
  res.json({ ok: true });
});

app.post('/api/cambiar-contrasena-final', async (req, res) => {
  const { email, nuevaPassword } = req.body;
  if (!nuevaPassword || nuevaPassword.length < 8 || !/[A-Z]/.test(nuevaPassword) || !/[0-9]/.test(nuevaPassword) || !/[!@#$%^&*]/.test(nuevaPassword)) {
    return res.status(400).json({ error: 'La contraseña no cumple los requisitos' });
  }
  await actualizarContrasena(email, nuevaPassword);
  res.json({ ok: true, mensaje: 'Contraseña actualizada' });
});

app.post('/api/registro', async (req, res) => {
  try {
    const { nombre, email, password } = req.body;
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[!@#$%^&*]/.test(password)) {
      return res.status(400).json({ error: 'Contraseña insegura' });
    }
    const usuario = await registrarUsuario(nombre, email, password);
    req.session.userId = usuario.id; req.session.nombre = usuario.nombre; req.session.user = usuario;
    res.json({ ok: true, usuario });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const usuario = await loginUsuario(email, password);
    req.session.userId = usuario.id; req.session.nombre = usuario.nombre; req.session.user = usuario;
    res.json({ ok: true, usuario });
  } catch (err) { res.status(401).json({ error: err.message }); }
});

app.get('/api/yo', (req, res) => {
  if (req.session && req.session.user) res.json({ ok: true, nombre: req.session.nombre, fecha_vencimiento: req.session.user.fecha_vencimiento });
  else res.json({ ok: false });
});

app.post('/api/logout', (req, res) => { req.session.destroy(); res.json({ ok: true }); });
app.post('/api/cancelar-suscripcion', usuarioLogueado, async (req, res) => {
  try { await cancelarSuscripcionUsuario(req.session.userId); res.json({ ok: true }); } 
  catch (err) { res.status(500).json({ error: 'Error al cancelar' }); }
});
app.post('/api/validar-promo', usuarioLogueado, (req, res) => {
  if (req.body.codigo === 'RUTA94FLEX') return res.json({ valido: true, mensaje: '¡Código VIP aplicado!' });
  res.status(400).json({ valido: false, mensaje: 'Código inválido.' });
});

// FIX: POST individual ahora también anti-duplicado y auto-corrige
app.post('/api/destinos', usuarioLogueado, suscripcionVigente, async (req, res) => {
  try {
    if (!req.body.direccion) return res.status(400).json({ error: 'Falta dirección' });
    const dirLimpia = corregirDireccionBackend(req.body.direccion);
    const existentes = await obtenerDestinosDeUsuario(req.session.userId);
    const yaExiste = (existentes||[]).some(e => claveDuplicadoBackend(e.direccion || e.texto || '') === claveDuplicadoBackend(dirLimpia));
    if (yaExiste) return res.json({ ok: true, duplicado: true, mensaje: 'Ya existe, no se duplicó' });
    res.json(await agregarDestino(req.session.userId, dirLimpia));
  } catch (err) { res.status(500).json({ error: 'Error al guardar' }); }
});

// NUEVO: Reemplazar toda la ruta de una vez - borra viejas, guarda nuevas limpias sin duplicados
// Esto es lo que usa ahora app.js, así nunca se acumulan 50+50+50
app.post('/api/destinos/reemplazar', usuarioLogueado, suscripcionVigente, async (req, res) => {
  try {
    const lista = req.body.direcciones || req.body.destinos || [];
    if (!Array.isArray(lista) || lista.length === 0) return res.status(400).json({ error: 'Falta lista de direcciones' });
    const limpias = limpiarListaBackend(lista.map(d => corregirDireccionBackend(typeof d === 'string' ? d : (d.direccion || d.texto || ''))));
    await borrarDestinosDeUsuario(req.session.userId);
    const guardadas = [];
    for (const dir of limpias) {
      try { const g = await agregarDestino(req.session.userId, dir); guardadas.push(g); } catch(e){}
    }
    res.json({ ok: true, cantidad: guardadas.length, direcciones: limpias });
  } catch (err) { console.error('Error reemplazar destinos:', err); res.status(500).json({ error: 'Error al guardar ruta' }); }
});

app.get('/api/destinos', usuarioLogueado, suscripcionVigente, async (req, res) => {
  try { 
    const lista = await obtenerDestinosDeUsuario(req.session.userId);
    // Seguridad: devolver sin duplicados aunque en DB haya viejos triplicados
    const vistos = new Set(); const sinDup = [];
    (lista||[]).forEach(d=>{
      const k = claveDuplicadoBackend(d.direccion || d.texto || '');
      if(!vistos.has(k)){ vistos.add(k); sinDup.push(d); }
    });
    res.json(sinDup); 
  } 
  catch (err) { res.status(500).json({ error: 'Error al cargar' }); }
});

app.delete('/api/destinos/:id', usuarioLogueado, suscripcionVigente, async (req, res) => {
  try { await borrarDestino(req.params.id, req.session.userId); res.json({ ok: true }); } 
  catch (err) { res.status(500).json({ error: 'Error al eliminar' }); }
});

app.delete('/api/destinos', usuarioLogueado, suscripcionVigente, async (req, res) => {
  try { 
    await borrarDestinosDeUsuario(req.session.userId); 
    res.json({ ok: true, mensaje: 'Todas las direcciones fueron eliminadas' }); 
  } catch (err) { res.status(500).json({ error: 'Error al eliminar' }); }
});

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

app.listen(PORT, () => { console.log(`✅ Backend RUTAFLEX corriendo en puerto ${PORT}`); });
