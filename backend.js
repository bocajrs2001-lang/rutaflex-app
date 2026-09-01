require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const mongoose = require('mongoose');
const { Resend } = require('resend');

const { 
  registrarUsuario, 
  loginUsuario, 
  obtenerDestinosDeUsuario, 
  agregarDestino, 
  borrarDestino, 
  borrarDestinosDeUsuario,
  actualizarContrasena,
  buscarUsuarioPorEmail,
  cancelarSuscripcionUsuario // Nueva función
} = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
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
app.use(express.static(path.join(__dirname)));

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

// --- NUEVA RUTA: CANCELAR SUSCRIPCIÓN ---
app.post('/api/cancelar-suscripcion', usuarioLogueado, async (req, res) => {
  try {
    await cancelarSuscripcionUsuario(req.session.userId);
    // Opcional: Destruir sesión para forzar re-login o mostrar mensaje de despedida
    res.json({ ok: true, mensaje: 'Suscripción cancelada correctamente. Lamentamos verte partir.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al procesar la cancelación' });
  }
});

// --- RUTAS DE RECUPERACIÓN (Ya existentes) ---
function generarCodigo() { return Math.floor(100000 + Math.random() * 900000).toString(); }

app.post('/api/enviar-codigo-recuperacion', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Ingresá tu email' });
    const usuario = await buscarUsuarioPorEmail(email);
    if (!usuario) return res.status(404).json({ error: 'No existe cuenta con ese email' });
    
    const codigo = generarCodigo();
    codigosVerificacion.set(email, { codigo, expira: Date.now() + 10 * 60 * 1000 });

    const { error } = await resend.emails.send({
      from: 'RUTAFLEX <onboarding@resend.dev>',
      to: email,
      subject: '🔐 Tu código de recuperación',
      html: `<div style="font-family:sans-serif; padding:20px;"><h2>RUTAFLEX</h2><p>Tu código es:</p><h1 style="color:#0A2342; letter-spacing:5px;">${codigo}</h1><p>Expira en 10 min.</p></div>`
    });
    if (error) return res.status(500).json({ error: 'Error al enviar email' });
    res.json({ ok: true, mensaje: 'Código enviado' });
  } catch (err) { res.status(500).json({ error: 'Error del servidor' }); }
});

app.post('/api/verificar-codigo', (req, res) => {
  const { email, codigo } = req.body;
  const datos = codigosVerificacion.get(email);
  if (!datos) return res.status(400).json({ error: 'Solicitá un código nuevo' });
  if (datos.codigo !== codigo) return res.status(400).json({ error: 'Código incorrecto' });
  if (Date.now() > datos.expira) { codigosVerificacion.delete(email); return res.status(400).json({ error: 'Código expirado' }); }
  codigosVerificacion.delete(email);
  res.json({ ok: true });
});

app.post('/api/cambiar-contrasena-final', async (req, res) => {
  const { email, nuevaPassword } = req.body;
  if (!nuevaPassword || nuevaPassword.length < 8 || !/[A-Z]/.test(nuevaPassword) || !/[0-9]/.test(nuevaPassword) || !/[!@#$%^&*]/.test(nuevaPassword)) {
    return res.status(400).json({ error: 'La contraseña no cumple los requisitos de seguridad' });
  }
  await actualizarContrasena(email, nuevaPassword);
  res.json({ ok: true, mensaje: 'Contraseña actualizada' });
});

// --- RUTAS DE AUTENTICACIÓN Y APP ---
app.post('/api/registro', async (req, res) => {
  try {
    const { nombre, email, password } = req.body;
    if (!nombre || !email || !password) return res.status(400).json({ error: 'Completa todo' });
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[!@#$%^&*]/.test(password)) {
       return res.status(400).json({ error: 'Contraseña insegura (Mín 8 car, 1 Mayús, 1 Núm, 1 Símbolo)' });
    }
    const usuario = await registrarUsuario(nombre, email, password);
    req.session.userId = usuario.id;
    req.session.nombre = usuario.nombre;
    res.json({ ok: true, usuario });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const usuario = await loginUsuario(email, password);
    req.session.userId = usuario.id;
    req.session.nombre = usuario.nombre;
    res.json({ ok: true, usuario });
  } catch (err) { res.status(401).json({ error: err.message }); }
});

app.get('/api/yo', (req, res) => {
  if (req.session && req.session.userId) res.json({ ok: true, nombre: req.session.nombre });
  else res.json({ ok: false });
});

app.post('/api/logout', (req, res) => { req.session.destroy(); res.json({ ok: true }); });

app.post('/api/validar-promo', usuarioLogueado, (req, res) => {
  const { codigo } = req.body;
  if (codigo === 'ALBERTO90' || codigo === 'RUTAFLEX') return res.json({ valido: true, mensaje: '¡Código aplicado!' });
  res.status(400).json({ valido: false, mensaje: 'Inválido.' });
});

app.get('/api/destinos', usuarioLogueado, async (req, res) => {
  try { res.json(await obtenerDestinosDeUsuario(req.session.userId)); } 
  catch (err) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/destinos', usuarioLogueado, async (req, res) => {
  try {
    if (!req.body.direccion) return res.status(400).json({ error: 'Falta dirección' });
    res.json(await agregarDestino(req.session.userId, req.body.direccion));
  } catch (err) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/destinos/:id', usuarioLogueado, async (req, res) => {
  try { await borrarDestino(req.params.id, req.session.userId); res.json({ ok: true }); } 
  catch (err) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/destinos', usuarioLogueado, async (req, res) => {
  try { await borrarDestinosDeUsuario(req.session.userId); res.json({ ok: true }); } 
  catch (err) { res.status(500).json({ error: 'Error' }); }
});

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });
app.listen(PORT, () => { console.log(`✅ Backend corriendo en puerto ${PORT}`); });
