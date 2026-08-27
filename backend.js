require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const { registrarUsuario, loginUsuario, obtenerDestinosDeUsuario, agregarDestino, borrarDestino, borrarDestinosDeUsuario } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ 
  origin: ['http://127.0.0.1:5500', 'http://localhost:5500', 'http://localhost:3000'],
  credentials: true 
}));
app.use(express.json());

// 🆕 NUEVA LÍNEA: Servir archivos estáticos (HTML, CSS, JS)
app.use(express.static(path.join(__dirname)));

// Configuración de sesiones
app.use(session({
  secret: 'rutaflex_secret_super_seguro_2026',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
    secure: false
  }
}));

// Middleware: verifica si el usuario está logueado
function usuarioLogueado(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  res.status(401).json({ error: 'Debes iniciar sesión' });
}

// 📝 REGISTRO
app.post('/api/registro', async (req, res) => {
  try {
    const { nombre, email, password } = req.body;
    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'Completa todos los campos' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    const usuario = await registrarUsuario(nombre, email, password);
    req.session.userId = usuario.id;
    req.session.nombre = usuario.nombre;
    res.json({ ok: true, mensaje: '¡Cuenta creada!', usuario });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 🔐 LOGIN
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const usuario = await loginUsuario(email, password);
    req.session.userId = usuario.id;
    req.session.nombre = usuario.nombre;
    res.json({ ok: true, mensaje: '¡Bienvenido!', usuario });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// 👤 VER QUIÉN ESTÁ LOGUEADO
app.get('/api/yo', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({ ok: true, nombre: req.session.nombre });
  } else {
    res.json({ ok: false });
  }
});

// 🚪 CERRAR SESIÓN
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

// 🎁 CÓDIGO PROMO
app.post('/api/validar-promo', usuarioLogueado, (req, res) => {
  const { codigo } = req.body;
  if (codigo === 'ALBERTO90') {
    return res.json({ valido: true, mensaje: '¡7 días GRATIS activados!' });
  }
  res.status(400).json({ valido: false, mensaje: 'Código inválido.' });
});

// 🆕 NUEVA RUTA: Cuando entres a localhost:3000, te muestra el index.html
// 📍 OBTENER destinos del usuario logueado
app.get('/api/destinos', usuarioLogueado, (req, res) => {
  const destinos = obtenerDestinosDeUsuario(req.session.userId);
  res.json(destinos);
});

// ➕ AGREGAR un destino nuevo
app.post('/api/destinos', usuarioLogueado, (req, res) => {
  const { direccion } = req.body;
  if (!direccion) return res.status(400).json({ error: 'Falta la dirección' });
  const nuevo = agregarDestino(req.session.userId, direccion);
  res.json(nuevo);
});

// 🗑️ BORRAR un destino
app.delete('/api/destinos/:id', usuarioLogueado, (req, res) => {
  const destinoId = parseFloat(req.params.id);
  borrarDestino(destinoId, req.session.userId);
  res.json({ ok: true });
});

// 🧹 BORRAR TODOS los destinos (para empezar de cero)
app.delete('/api/destinos', usuarioLogueado, (req, res) => {
  borrarDestinosDeUsuario(req.session.userId);
  res.json({ ok: true });
});
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Backend RUTA FLEX corriendo en http://localhost:${PORT}`);
  console.log(`🌐 Abre tu navegador en: http://localhost:${PORT}`);
});