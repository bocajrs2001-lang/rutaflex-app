const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'users.json');
const destinosPath = path.join(__dirname, 'destinos.json');

// --- USUARIOS ---
function leerUsers() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify([]));
  }
  return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
}

function guardarUsers(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

async function registrarUsuario(nombre, email, password) {
  const users = leerUsers();
  const existe = users.find(u => u.email === email);
  if (existe) throw new Error('Ese email ya está registrado');

  const passwordEncriptada = await bcrypt.hash(password, 10);
  const nuevoUsuario = {
    id: Date.now(),
    nombre,
    email,
    password: passwordEncriptada,
    fecha_registro: new Date().toISOString(),
    cuenta_activa: 0
  };
  users.push(nuevoUsuario);
  guardarUsers(users);
  return { id: nuevoUsuario.id, nombre: nuevoUsuario.nombre, email: nuevoUsuario.email };
}

async function loginUsuario(email, password) {
  const users = leerUsers();
  const user = users.find(u => u.email === email);
  if (!user) throw new Error('Email o contraseña incorrectos');
  const esValida = await bcrypt.compare(password, user.password);
  if (!esValida) throw new Error('Email o contraseña incorrectos');
  return { id: user.id, nombre: user.nombre, email: user.email };
}

// --- DESTINOS (NUEVO) ---
function leerDestinos() {
  if (!fs.existsSync(destinosPath)) {
    fs.writeFileSync(destinosPath, JSON.stringify([]));
  }
  return JSON.parse(fs.readFileSync(destinosPath, 'utf-8'));
}

function guardarDestinos(data) {
  fs.writeFileSync(destinosPath, JSON.stringify(data, null, 2));
}

// Obtener solo los destinos de UN usuario
function obtenerDestinosDeUsuario(userId) {
  const destinos = leerDestinos();
  return destinos.filter(d => d.userId === userId);
}

// Agregar un destino nuevo
function agregarDestino(userId, direccion) {
  const destinos = leerDestinos();
  const nuevoDestino = {
    id: Date.now() + Math.random(),
    userId: userId,
    direccion: direccion,
    distancia: (0.8 + destinos.length * 0.6).toFixed(1),
    tiempo: 5 + destinos.length * 2,
    completado: false,
    fecha_creacion: new Date().toISOString()
  };
  destinos.push(nuevoDestino);
  guardarDestinos(destinos);
  return nuevoDestino;
}

// Borrar un destino
function borrarDestino(destinoId, userId) {
  let destinos = leerDestinos();
  destinos = destinos.filter(d => !(d.id === destinoId && d.userId === userId));
  guardarDestinos(destinos);
}

// Borrar TODOS los destinos de un usuario (útil para empezar de cero)
function borrarDestinosDeUsuario(userId) {
  let destinos = leerDestinos();
  destinos = destinos.filter(d => d.userId !== userId);
  guardarDestinos(destinos);
}

module.exports = {
  registrarUsuario,
  loginUsuario,
  obtenerDestinosDeUsuario,
  agregarDestino,
  borrarDestino,
  borrarDestinosDeUsuario
};