require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const mongoose = require('mongoose');

const { 
  registrarUsuario, 
  loginUsuario, 
  obtenerDestinosDeUsuario, 
  agregarDestino, 
  borrarDestino, 
  borrarDestinosDeUsuario,
  actualizarContrasena
} = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Conectado a MongoDB Atlas (La Nube)'))
  .catch(err => console.error('❌ Error conectando a MongoDB:', err));

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
  cookie: { 
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
    secure: false 
  }
}));

function usuarioLogueado(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  res.status(401).json({ error: 'Debes iniciar sesión' });
}

// REGISTRO
app.post('/api/registro', async (req, res) => {
  try {
    const { nombre, email, password } = req.body;
    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'Completa todos los campos' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }
    if (!/[A-Z]/.test(password)) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 1 letra mayúscula' });
    }
    if (!/[0-9]/.test(password)) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 1 número' });
    }
    if (!/[!@#$%^&*]/.test(password)) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 1 carácter especial (!@#$%^&*)' });
    }
    const usuario = await registrarUsuario(nombre, email, password);
    req.session.userId = usuario.id;
    req.session.nombre = usuario.nombre;
    res.json({ ok: true, mensaje: '¡Cuenta creada!', usuario });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// LOGIN
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

// RECUPERAR CONTRASEÑA
app.post('/api/recuperar-contrasena', async (req, res) => {
  try {
    const { email, nuevaPassword } = req.body;
    if (!email || !nuevaPassword) {
      return res.status(400).json({ error: 'Completa todos los campos' });
    }
    if (nuevaPassword.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }
    if (!/[A-Z]/.test(nuevaPassword)) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 1 letra mayúscula' });
    }
    if (!/[0-9]/.test(nuevaPassword)) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 1 número' });
    }
    if (!/[!@#$%^&*]/.test(nuevaPassword)) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 1 carácter especial (!@#$%^&*)' });
    }
    const resultado = await actualizarContrasena(email, nuevaPassword);
    res.json({ ok: true, mensaje: resultado.mensaje });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// VER QUIÉN ESTÁ LOGUEADO
app.get('/api/yo', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({ ok: true, nombre: req.session.nombre });
  } else {
    res.json({ ok: false });
  }
});

// CERRAR SESIÓN
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

// CÓDIGO PROMO
app.post('/api/validar-promo', usuarioLogueado, (req, res) => {
  const { codigo } = req.body;
  if (codigo === 'ALBERTO90' || codigo === 'RUTAFLEX') {
    return res.json({ valido: true, mensaje: '¡Código aplicado con éxito!' });
  }
  res.status(400).json({ valido: false, mensaje: 'Código inválido.' });
});

// OBTENER destinos
app.get('/api/destinos', usuarioLogueado, async (req, res) => {
  try {
    const destinos = await obtenerDestinosDeUsuario(req.session.userId);
    res.json(destinos);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener destinos' });
  }
});

// AGREGAR destino
app.post('/api/destinos', usuarioLogueado, async (req, res) => {
  try {
    const { direccion } = req.body;
    if (!direccion) return res.status(400).json({ error: 'Falta la dirección' });
    const nuevo = await agregarDestino(req.session.userId, direccion);
    res.json(nuevo);
  } catch (err) {
    res.status(500).json({ error: 'Error al agregar destino' });
  }
});

// BORRAR un destino
app.delete('/api/destinos/:id', usuarioLogueado, async (req, res) => {
  try {
    await borrarDestino(req.params.id, req.session.userId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al borrar destino' });
  }
});

// BORRAR TODOS los destinos
app.delete('/api/destinos', usuarioLogueado, async (req, res) => {
  try {
    await borrarDestinosDeUsuario(req.session.userId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al borrar todos los destinos' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Backend RUTA FLEX corriendo en http://localhost:${PORT}`);
});
