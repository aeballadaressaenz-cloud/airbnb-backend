const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../db');
const { verificarToken } = require('../middleware/auth');
const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ storage });

/**
 * @swagger
 * /api/alojamientos:
 *   get:
 *     summary: Listar alojamientos con filtros opcionales
 *     tags: [Alojamientos]
 *     parameters:
 *       - in: query
 *         name: id_ciudad
 *         schema:
 *           type: integer
 *         description: Filtrar por ciudad
 *       - in: query
 *         name: precio_min
 *         schema:
 *           type: number
 *         description: Precio mínimo por noche
 *       - in: query
 *         name: precio_max
 *         schema:
 *           type: number
 *         description: Precio máximo por noche
 *       - in: query
 *         name: capacidad_min
 *         schema:
 *           type: integer
 *         description: Capacidad mínima de personas
 *       - in: query
 *         name: fecha_entrada
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de entrada (YYYY-MM-DD)
 *       - in: query
 *         name: fecha_salida
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de salida (YYYY-MM-DD)
 *       - in: query
 *         name: tipo_alojamiento
 *         schema:
 *           type: string
 *           enum: [casa_completa, apartamento, habitacion_privada, habitacion_compartida]
 *         description: Tipo de alojamiento
 *     responses:
 *       200:
 *         description: Lista de alojamientos
 *       500:
 *         description: Error del servidor
 */
router.get('/', async (req, res) => {
    try {
        await poolConnect;
        const { id_ciudad, precio_min, precio_max, capacidad_min,
                fecha_entrada, fecha_salida, tipo_alojamiento } = req.query;
        const result = await pool.request()
            .input('id_ciudad',        sql.Int,           id_ciudad        || null)
            .input('precio_min',       sql.Decimal(10,2), precio_min       || null)
            .input('precio_max',       sql.Decimal(10,2), precio_max       || null)
            .input('capacidad_min',    sql.Int,           capacidad_min    || null)
            .input('fecha_entrada',    sql.Date,          fecha_entrada    || null)
            .input('fecha_salida',     sql.Date,          fecha_salida     || null)
            .input('tipo_alojamiento', sql.VarChar,       tipo_alojamiento || null)
            .execute('sp_ObtenerAlojamientos');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/alojamientos/{id}:
 *   get:
 *     summary: Ver detalle completo de un alojamiento
 *     tags: [Alojamientos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del alojamiento
 *     responses:
 *       200:
 *         description: Detalle del alojamiento con imágenes, amenidades y valoraciones
 *       404:
 *         description: Alojamiento no encontrado
 */
router.get('/:id', async (req, res) => {
    try {
        await poolConnect;
        const result = await pool.request()
            .input('id_alojamiento', sql.Int, req.params.id)
            .execute('sp_DetalleAlojamiento');
        if (result.recordsets[0].length === 0) {
            return res.status(404).json({ error: 'Alojamiento no encontrado.' });
        }
        res.json({
            alojamiento:  result.recordsets[0][0],
            imagenes:     result.recordsets[1],
            amenidades:   result.recordsets[2],
            valoraciones: result.recordsets[3]
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/alojamientos/{id}/disponibilidad:
 *   get:
 *     summary: Verificar disponibilidad de un alojamiento por fechas
 *     tags: [Alojamientos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: fecha_entrada
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: fecha_salida
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Disponible o no disponible
 */
router.get('/:id/disponibilidad', async (req, res) => {
    try {
        await poolConnect;
        const { fecha_entrada, fecha_salida } = req.query;
        const result = await pool.request()
            .input('id_alojamiento', sql.Int,  req.params.id)
            .input('fecha_entrada',  sql.Date, fecha_entrada)
            .input('fecha_salida',   sql.Date, fecha_salida)
            .execute('sp_VerificarDisponibilidad');
        res.json(result.recordset[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/alojamientos/{id}/imagenes:
 *   post:
 *     summary: Subir imagen de un alojamiento
 *     tags: [Alojamientos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               imagen:
 *                 type: string
 *                 format: binary
 *               es_principal:
 *                 type: integer
 *               orden:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Imagen subida correctamente
 *       400:
 *         description: No se recibió imagen
 */
router.post('/:id/imagenes', verificarToken, upload.single('imagen'), async (req, res) => {
    try {
        await poolConnect;
        if (!req.file) {
            return res.status(400).json({ error: 'No se recibió ninguna imagen.' });
        }
        const imagenBuffer = req.file.buffer;
        const { es_principal, orden } = req.body;
        await pool.request()
            .input('id_alojamiento', sql.Int,      req.params.id)
            .input('imagen',         sql.VarBinary, imagenBuffer)
            .input('es_principal',   sql.Bit,       es_principal || 0)
            .input('orden',          sql.Int,        orden || 0)
            .query(`INSERT INTO ImagenesAlojamiento 
                    (id_alojamiento, imagen, es_principal, orden)
                    VALUES (@id_alojamiento, @imagen, @es_principal, @orden)`);
        res.status(201).json({ mensaje: 'Imagen subida correctamente.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/alojamientos/{id}/imagenes/{idImagen}:
 *   get:
 *     summary: Obtener imagen de un alojamiento
 *     tags: [Alojamientos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: idImagen
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Imagen en formato binario
 *       404:
 *         description: Imagen no encontrada
 */
router.get('/:id/imagenes/:idImagen', async (req, res) => {
    try {
        await poolConnect;
        const result = await pool.request()
            .input('id_imagen', sql.Int, req.params.idImagen)
            .query('SELECT imagen FROM ImagenesAlojamiento WHERE id_imagen = @id_imagen');
        if (result.recordset.length === 0 || !result.recordset[0].imagen) {
            return res.status(404).json({ error: 'Imagen no encontrada.' });
        }
        res.set('Content-Type', 'image/jpeg');
        res.send(result.recordset[0].imagen);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;