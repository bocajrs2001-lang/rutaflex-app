const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  fecha_registro: { type: Date, default: Date.now },
  cuenta_activa: { type: Number, default: 0 }
});

const User = mongoose.model('User', userSchema);

const destinoSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  direccion: { type: String, required: true },
  distancia: { type: String, default: '0.0' },
  tiempo: { type: Number, default: 0 },
  completado: { type: Boolean, default: false },
  fecha_creacion: { type: Date, default: Date.now }
});

const Destino = mongoose.model('Destino', destinoSchema);

async function registrarUsuario(nombre, email, password) {
  const existe = await User.findOne({ email });
  if (existe) throw new Error('Email ya registrado');
  const passHash = await bcrypt.hash(password, 10);
  const u = new User({ nombre, email, password: passHash });
  await u.save();
  return { id: u._id, nombre: u.nombre, email: u.email };
}

async function loginUsuario(email, password) {
  const user = await User.findOne({ email });
  if (!user) throw new Error('Email o contraseña incorrectos');
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw new Error('Email o contraseña incorrectos');
  return { id: user._id, nombre: user.nombre, email: user.email };
}

// NUEVA FUNCIÓN PARA RECUPERACIÓN
async function buscarUsuarioPorEmail(email) {
  return await User.findOne({ email });
}

async function actualizarContrasena(email, nuevaPassword) {
  const user = await User.findOne({ email });
  if (!user) throw new Error('Usuario no encontrado');
  user.password = await bcrypt.hash(nuevaPassword, 10);
  await user.save();
  return { mensaje: 'Contraseña actualizada' };
}

async function obtenerDestinosDeUsuario(userId) {
  return await Destino.find({ userId: userId.toString() }).sort({ fecha_creacion: 1 });
}

async function agregarDestino(userId, direccion) {
  const d = new Destino({ userId: userId.toString(), direccion });
  await d.save();
  return d;
}

async function borrarDestino(id, userId) {
  await Destino.deleteOne({ _id: id, userId: userId.toString() });
}

async function borrarDestinosDeUsuario(userId) {
  await Destino.deleteMany({ userId: userId.toString() });
}

module.exports = {
  registrarUsuario,
  loginUsuario,
  buscarUsuarioPorEmail, // Exportamos la nueva función
  actualizarContrasena,
  obtenerDestinosDeUsuario,
  agregarDestino,
  borrarDestino,
  borrarDestinosDeUsuario
};
