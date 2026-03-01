/* 
 * =========================================================
 * Servidor principal - Sprint 1
 * =========================================================
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ======================
// CONEXIÓN BASE DE DATOS
// ======================

const db = new Database(path.join(__dirname, 'taller.db'));

// ======================
// CREACIÓN DE TABLAS (SI NO EXISTEN)
// ======================

db.exec(`
CREATE TABLE IF NOT EXISTS maquina (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT,
  tipo TEXT,
  estado TEXT
);

CREATE TABLE IF NOT EXISTS usuario (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT,
  rol TEXT
);

CREATE TABLE IF NOT EXISTS incidencia (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  descripcion TEXT,
  estado TEXT,
  id_maquina INTEGER,
  id_usuario_registra INTEGER,
  fecha DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS uso_maquina (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_maquina INTEGER,
  id_usuario INTEGER,
  fecha_inicio DATETIME DEFAULT CURRENT_TIMESTAMP,
  fecha_fin DATETIME,
  FOREIGN KEY (id_maquina) REFERENCES maquina(id),
  FOREIGN KEY (id_usuario) REFERENCES usuario(id)
);
`);

// ======================
// INSERTAR DATOS INICIALES (SI ESTÁ VACÍO)
// ======================

const maquinasCount = db.prepare("SELECT COUNT(*) as total FROM maquina").get();

if (maquinasCount.total === 0) {
    db.exec(`
    INSERT INTO maquina (nombre, tipo, estado) VALUES
    ('CNC-01', 'Fresadora CNC', 'Operativa'),
    ('PR-02', 'Prensa Hidraulica', 'En mantenimiento'),
    ('EMB-03', 'Linea de Embalaje', 'Averiada');

    INSERT INTO usuario (nombre, rol) VALUES
    ('Ane Garcia', 'Tecnico'),
    ('Iker Martinez', 'Supervisor'),
    ('Leire Sanchez', 'Mantenimiento');
  `);
}

// ======================

const USUARIO_ACTUAL = {
    id: 1,
    nombre: '',
    rol: 'operario'
};

// ======================
// GET /api/maquinas
// ======================

app.get('/api/maquinas', (req, res) => {
    try {
        const maquinas = db.prepare(
            'SELECT id, nombre, tipo, estado FROM maquina ORDER BY nombre'
        ).all();

        res.json({ ok: true, data: maquinas });
    } catch (error) {
        console.error('[GET /api/maquinas]', error.message);
        res.status(500).json({ ok: false, mensaje: 'Error interno del servidor.' });
    }
});

// ======================
// GET /api/usuarios
// ======================

app.get('/api/usuarios', (req, res) => {
    try {
        const usuarios = db.prepare(
            'SELECT id, nombre, rol FROM usuario ORDER BY nombre'
        ).all();

        res.json({ ok: true, data: usuarios });
    } catch (error) {
        console.error('[GET /api/usuarios]', error.message);
        res.status(500).json({ ok: false, mensaje: 'Error interno.' });
    }
});

// ======================
// GET /api/incidencias/abiertas
// ======================

app.get('/api/incidencias/abiertas', (req, res) => {
    try {
        const incidencias = db.prepare(`
            SELECT 
                m.nombre AS maquina_nombre,
                m.tipo AS maquina_tipo,
                i.id AS incidencia_id,
                i.descripcion,
                i.estado,
                i.fecha,
                u.nombre AS registrado_por
            FROM incidencia i
            JOIN maquina m ON m.id = i.id_maquina
            JOIN usuario u ON u.id = i.id_usuario_registra
            WHERE i.estado IN ('Abierta', 'En Progreso')
            ORDER BY i.fecha DESC
        `).all();

        res.json({ ok: true, data: incidencias });
    } catch (error) {
        console.error('[GET /api/incidencias/abiertas]', error.message);
        res.status(500).json({ ok: false, mensaje: 'Error interno del servidor.' });
    }
});

// ======================
// POST /api/incidencias
// ======================

app.post('/api/incidencias', (req, res) => {
    const { id_maquina, descripcion } = req.body;

    if (!id_maquina || !descripcion || descripcion.trim() === '') {
        return res.status(400).json({ ok: false, mensaje: 'Campos obligatorios.' });
    }

    const descripcionLimpia = descripcion.trim();

    try {

        // --- INICIO REGLA ANTI-DUPLICADOS (Tarea de Asier) ---

        // 1. Obtenemos las incidencias que ya están ABIERTAS o EN PROGRESO para esta máquina
        const incidenciasAbiertas = db.prepare(`
    SELECT id, descripcion
    FROM incidencia
    WHERE id_maquina = ?
      AND estado IN ('Abierta', 'En Progreso')
`).all(id_maquina);

        // 2. Función para extraer las primeras 4 palabras en minúsculas
        const primerasPalabras = (texto) =>
            texto.toLowerCase().trim().split(/\s+/).slice(0, 4).join(' ');

        const claveNueva = primerasPalabras(descripcionLimpia);

        // 3. Comprobamos si hay coincidencia
        const esDuplicado = incidenciasAbiertas.some(
            inc => primerasPalabras(inc.descripcion) === claveNueva
        );

        // 4. Si es duplicado, devolvemos error 409
        if (esDuplicado) {
            return res.status(409).json({
                ok: false,
                mensaje: '⚠️ Ya existe una incidencia ABIERTA para esta máquina con un motivo similar.'
            });
        }

        const resultado = db.prepare(`
            INSERT INTO incidencia (id_maquina, id_usuario_registra, descripcion, estado)
            VALUES (?, ?, ?, 'Abierta')
        `).run(id_maquina, USUARIO_ACTUAL.id, descripcionLimpia);

        res.status(201).json({
            ok: true,
            mensaje: '✅ Incidencia registrada.',
            id: resultado.lastInsertRowid
        });

    } catch (error) {
        console.error('[POST /api/incidencias]', error.message);
        res.status(500).json({ ok: false, mensaje: 'Error al guardar.' });
    }
});


// ======================
// POST /api/uso/iniciar
// ======================

app.post('/api/uso/iniciar', (req, res) => {
    const { id_maquina, id_usuario } = req.body;

    if (!id_maquina || !id_usuario) {
        return res.status(400).json({ ok: false, mensaje: 'Campos obligatorios.' });
    }

    try {
        // Verificamos que no haya un uso activo
        const usoActivo = db.prepare(`
            SELECT * FROM uso_maquina
            WHERE id_maquina = ?
              AND fecha_fin IS NULL
        `).get(id_maquina);

        if (usoActivo) {
            return res.status(409).json({
                ok: false,
                mensaje: '⚠️ Esta máquina ya está en uso.'
            });
        }

        db.prepare(`
            INSERT INTO uso_maquina (id_maquina, id_usuario)
            VALUES (?, ?)
        `).run(id_maquina, id_usuario);

        res.status(201).json({
            ok: true,
            mensaje: '✅ Uso de máquina iniciado.'
        });

    } catch (error) {
        console.error('[POST /api/uso/iniciar]', error.message);
        res.status(500).json({ ok: false, mensaje: 'Error interno.' });
    }
});

// ======================
// POST /api/uso/finalizar
// ======================

app.post('/api/uso/finalizar', (req, res) => {
    const { id_maquina } = req.body;

    if (!id_maquina) {
        return res.status(400).json({ ok: false, mensaje: 'ID máquina obligatorio.' });
    }

    try {
        const resultado = db.prepare(`
            UPDATE uso_maquina
            SET fecha_fin = CURRENT_TIMESTAMP
            WHERE id_maquina = ?
              AND fecha_fin IS NULL
        `).run(id_maquina);

        if (resultado.changes === 0) {
            return res.status(404).json({
                ok: false,
                mensaje: 'No había ningún uso activo.'
            });
        }

        res.json({
            ok: true,
            mensaje: '✅ Uso finalizado.'
        });

    } catch (error) {
        console.error('[POST /api/uso/finalizar]', error.message);
        res.status(500).json({ ok: false, mensaje: 'Error interno.' });
    }
});

// ======================
// ARRANQUE DEL SERVIDOR
// ======================

app.listen(PORT, () => {
    console.log(`🚀 Servidor en http://localhost:${PORT}`);
});