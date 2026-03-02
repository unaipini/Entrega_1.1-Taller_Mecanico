# Entrega 1.1 — Taller Mecánico

**Autores:** Alaia Yeregui, Asier Sánchez, Oier Martínez, Unai Pinilla

Aplicación web para la gestión de incidencias de un taller mecánico. Permite a los operarios registrar fallos en las máquinas y consultar las incidencias activas, eliminando el uso de papel y Excel.

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Base de datos | SQLite (archivo `taller.db`, gestionado con `better-sqlite3`) |
| Backend | Node.js con Express 5 |
| Frontend | HTML + CSS + JavaScript Vanilla |

---

## Estructura del proyecto

```
Entrega_1.1-Taller_Mecanico/
├── database/
│   └── esquema.sql              ← Esquema de referencia exportado desde MySQL
│
├── backend/
│   ├── package.json
│   ├── package-lock.json
│   ├── server.js                ← Servidor Express + endpoints + control de uso + eventos
│   └── taller.db                ← Base de datos SQLite (se crea automáticamente al arrancar)
│
└── frontend/
    ├── registrar.html           ← Vista: formulario para registrar incidencias
    ├── lista.html               ← Vista: tabla de incidencias activas
    ├── uso.html                 ← Vista: iniciar/finalizar uso y registrar eventos
    └── historial.html           ← Vista: historial de uso e incidencias por máquina
```

---

## Cómo ejecutarlo

### Requisitos previos
- [Node.js](https://nodejs.org/) versión 18 o superior instalado.

### Paso 1 — Instalar dependencias

```bash
cd backend
npm install
```

Instala los tres paquetes del proyecto: `express`, `better-sqlite3` y `cors`.

### Paso 2 — Arrancar el servidor

```bash
node server.js
```

Al arrancar, el servidor **crea automáticamente** las tablas en `taller.db` (si no existen) e inserta los datos de prueba. No hace falta ningún paso adicional de inicialización.

Deberías ver en consola:
```
🚀 Servidor en http://localhost:3000
```

### Paso 3 — Abrir el frontend

Con el servidor corriendo, abre en el navegador:

| Vista | URL |
|-------|------|
| Registrar incidencia | http://localhost:3000/registrar.html |
| Ver incidencias activas | http://localhost:3000/lista.html |
| Uso de máquina | http://localhost:3000/uso.html |
| Historial de máquina | http://localhost:3000/historial.html |

---

## API REST

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/maquinas` | Devuelve todas las máquinas |
| `GET` | `/api/usuarios` | Devuelve todos los usuarios |
| `GET` | `/api/incidencias/abiertas` | Devuelve incidencias en estado `Abierta` o `En Progreso` |
| `GET` | `/api/maquinas/:id/historial` | Devuelve historial de uso e incidencias de una máquina |
| `POST` | `/api/incidencias` | Registra una nueva incidencia |
| `POST` | `/api/uso/iniciar` | Inicia el uso de una máquina |
| `POST` | `/api/uso/finalizar` | Finaliza el uso activo de una máquina |
| `POST` | `/api/eventos` | Registra un evento durante el uso activo |

---

### POST `/api/incidencias` — Body esperado

```json
{
  "id_maquina": 1,
  "descripcion": "Ruido anormal en el eje principal."
}

### POST /api/uso/iniciar` — Body esperado
{
  "id_maquina": 1,
  "id_usuario": 2
}

### POST /api/eventos — Body esperado
{
  "id_maquina": 1,
  "id_usuario": 2,
  "descripcion": "Vibración leve detectada durante el funcionamiento."
}


### Códigos de respuesta

| HTTP | Situación |
|------|-----------|
| `201 Created` | Incidencia registrada correctamente |
| `400 Bad Request` | Faltan campos obligatorios |
| `404 Not Found` | Recurso no encontrado |
| `409 Conflict` | Incidencia duplicada detectada |
| `500 Internal Server Error` | Error interno del servidor |

---

## Datos de prueba incluidos

**Máquinas:**
| ID | Nombre | Tipo | Estado |
|----|--------|------|--------|
| 1 | CNC-01 | Fresadora CNC | Operativa |
| 2 | PR-02 | Prensa Hidráulica | En mantenimiento |
| 3 | EMB-03 | Línea de Embalaje | Averiada |

**Usuarios:**
| ID | Nombre | Rol |
|----|--------|-----|
| 1 | Ane Garcia | Técnico |
| 2 | Iker Martinez | Supervisor |
| 3 | Leire Sanchez | Mantenimiento |

> **Nota:** El usuario activo está simulado con `USUARIO_ACTUAL` (id: 1) en `server.js`. No hay sistema de login en este sprint.

---

## Regla anti-duplicados

Implementada en el endpoint `POST /api/incidencias`, antes de insertar en la base de datos:

1. Se consultan todas las incidencias `Abierta` o `En Progreso` para la máquina seleccionada.
2. Se extraen las **primeras 4 palabras** de la descripción nueva y de cada incidencia existente (en minúsculas).
3. Si coinciden, se rechaza la petición con **HTTP 409** y un mensaje explicativo.

---

## Nota sobre el esquema SQL

El archivo `database/esquema.sql` es un dump exportado desde **MySQL Workbench** y sirve como referencia del modelo de datos. El backend no lo utiliza directamente: las tablas se crean mediante sentencias `CREATE TABLE IF NOT EXISTS` dentro de `server.js` usando sintaxis SQLite.
