const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Esquema de Usuarios (Cómo se guardan los usuarios en la nube)
const userSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  fecha_registro: { type: Date, default: Date.now },
  cuenta_activa: { type: Number, default: 0 }
});

const User = mongoose.model('User', userSchema);

// Esquema de Destinos (Cómo se guardan las direcciones en la nube)
const destinoSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  direccion: { type: String, required: true },
  distancia: { type: String, default: '0.0' },
  tiempo: { type: Number, default: 0 },
  completado: { type: Boolean, default: false },
  fecha_creacion: { type: Date, default: Date.now }
});

const Destino = mongoose.model('Destino', destinoSchema);

// --- FUNCIONES DE USUARIOS ---
async function registrarUsuario(nombre, email, password) {
  const existe = await User.findOne({ email });
  if (existe) throw new Error('Ese email ya está registrado');

  const passwordEncriptada = await bcrypt.hash(password, 10);
  const nuevoUsuario = new User({ nombre, email, password: passwordEncriptada });
  await nuevoUsuario.save();
  
  return { id: nuevoUsuario._id, nombre: nuevoUsuario.nombre, email: nuevoUsuario.email };
}

async function loginUsuario(email, password) {
  const user = await User.findOne({ email });
  if (!user) throw new Error('Email o contraseña incorrectos');
  
  const esValida = await bcrypt.compare(password, user.password);
  if (!esValida) throw new Error('Email o contraseña incorrectos');
  
  return { id: user._id, nombre: user.nombre, email: user.email };
}

// --- FUNCIONES DE DESTINOS ---
async function obtenerDestinosDeUsuario(userId) {
  return await Destino.find({ userId: userId.toString() }).sort({ fecha_creacion: 1 });
}

async function agregarDestino(userId, direccion) {
  const nuevoDestino = new Destino({ userId: userId.toString(), direccion });
  await nuevoDestino.save();
  return nuevoDestino;
}

async function borrarDestino(destinoId, userId) {
  await Destino.deleteOne({ _id: destinoId, userId: userId.toString() });
}

async function borrarDestinosDeUsuario(userId) {
  await Destino.deleteMany({ userId: userId.toString() });
}

module.exports = {
  registrarUsuario,
  loginUsuario,
  obtenerDestinosDeUsuario,
  agregarDestino,
  borrarDestino,
  borrarDestinosDeUsuario
};
