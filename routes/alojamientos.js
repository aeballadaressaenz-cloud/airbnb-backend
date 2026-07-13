const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../db');
const { verificarToken, verificarRol } = require('../middleware/auth');
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
 * /api/alojamientos/mis-alojamientos:
 *   get:
 *     summary: Listar los alojamientos del anfitrión logueado
 *     tags: [Alojamientos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de alojamientos del anfitrión
 */
router.get('/mis-alojamientos', verificarToken, verificarRol('anfitrion', 'ambos'), async (req, res) => {
 

    try {
        await poolConnect;
        const result = await pool.request()
            .input('id_anfitrion', sql.Int, req.user.id)
            .query(`SELECT a.*, c.nombre AS ciudad
                    FROM Alojamientos a
                    JOIN Ciudades c ON a.id_ciudad = c.id_ciudad
                    WHERE a.id_anfitrion = @id_anfitrion
                    ORDER BY a.fecha_creacion DESC`);
        res.json(result.recordset);
   } catch (err) {
    console.error(err);
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
 * /api/alojamientos:
 *   post:
 *     summary: Publicar un nuevo alojamiento (solo anfitriones)
 *     tags: [Alojamientos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id_ciudad, titulo, descripcion, tipo_alojamiento, precio_por_noche, capacidad_personas, direccion]
 *             properties:
 *               id_ciudad:
 *                 type: integer
 *               titulo:
 *                 type: string
 *               descripcion:
 *                 type: string
 *               tipo_alojamiento:
 *                 type: string
 *                 enum: [casa_completa, apartamento, habitacion_privada, habitacion_compartida]
 *               precio_por_noche:
 *                 type: number
 *               capacidad_personas:
 *                 type: integer
 *               num_habitaciones:
 *                 type: integer
 *               num_banos:
 *                 type: integer
 *               direccion:
 *                 type: string
 *     responses:
 *       201:
 *         description: Alojamiento creado exitosamente
 *       403:
 *         description: Solo los anfitriones pueden publicar alojamientos
 */
router.post('/', verificarToken, verificarRol('anfitrion', 'ambos'), async (req, res) => {
    try {
        await poolConnect;
        const {
            id_ciudad, titulo, descripcion, tipo_alojamiento,
            precio_por_noche, capacidad_personas,
            num_habitaciones, num_banos, direccion
        } = req.body;

        const result = await pool.request()
            .input('id_anfitrion',       sql.Int,           req.user.id)
            .input('id_ciudad',          sql.Int,           id_ciudad)
            .input('titulo',             sql.VarChar,       titulo)
            .input('descripcion',        sql.VarChar,       descripcion)
            .input('tipo_alojamiento',   sql.VarChar,       tipo_alojamiento)
            .input('precio_por_noche',   sql.Decimal(10,2), precio_por_noche)
            .input('capacidad_personas', sql.Int,           capacidad_personas)
            .input('num_habitaciones',   sql.Int,           num_habitaciones || 1)
            .input('num_banos',          sql.Int,           num_banos || 1)
            .input('direccion',          sql.VarChar,       direccion)
            .query(`INSERT INTO Alojamientos
                    (id_anfitrion, id_ciudad, titulo, descripcion, tipo_alojamiento,
                     precio_por_noche, capacidad_personas, num_habitaciones, num_banos,
                     direccion, activo)
                    VALUES (@id_anfitrion, @id_ciudad, @titulo, @descripcion, @tipo_alojamiento,
                            @precio_por_noche, @capacidad_personas, @num_habitaciones, @num_banos,
                            @direccion, 1);
                    SELECT SCOPE_IDENTITY() AS id_alojamiento;`);

        res.status(201).json({
            mensaje: 'Alojamiento publicado exitosamente.',
            id_alojamiento: result.recordset[0].id_alojamiento
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
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

        // Verificar que el alojamiento le pertenezca al usuario logueado
        const alojamiento = await pool.request()
            .input('id_alojamiento', sql.Int, req.params.id)
            .query('SELECT id_anfitrion FROM Alojamientos WHERE id_alojamiento = @id_alojamiento');

        if (alojamiento.recordset.length === 0) {
            return res.status(404).json({ error: 'Alojamiento no encontrado.' });
        }
        if (alojamiento.recordset[0].id_anfitrion !== req.user.id) {
            return res.status(403).json({ error: 'No tenés permiso sobre este alojamiento.' });
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
 * /api/alojamientos/{id}/amenidades:
 *   post:
 *     summary: Asociar amenidades a un alojamiento
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
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id_amenidades]
 *             properties:
 *               id_amenidades:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       201:
 *         description: Amenidades asociadas correctamente
 *       400:
 *         description: Error al asociar amenidades
 */
router.post('/:id/amenidades', verificarToken, async (req, res) => {
    try {
        await poolConnect;
        const { id_amenidades } = req.body;

        if (!Array.isArray(id_amenidades) || id_amenidades.length === 0) {
            return res.status(400).json({ error: 'Debés enviar al menos una amenidad.' });
        }

        // Verificar que el alojamiento le pertenezca al usuario logueado
        const alojamiento = await pool.request()
            .input('id_alojamiento', sql.Int, req.params.id)
            .query('SELECT id_anfitrion FROM Alojamientos WHERE id_alojamiento = @id_alojamiento');

        if (alojamiento.recordset.length === 0) {
            return res.status(404).json({ error: 'Alojamiento no encontrado.' });
        }
        if (alojamiento.recordset[0].id_anfitrion !== req.user.id) {
            return res.status(403).json({ error: 'No tenés permiso sobre este alojamiento.' });
        }

        for (const id_amenidad of id_amenidades) {
            await pool.request()
                .input('id_alojamiento', sql.Int, req.params.id)
                .input('id_amenidad',    sql.Int, id_amenidad)
                .query(`INSERT INTO AlojamientoAmenidades (id_alojamiento, id_amenidad)
                        VALUES (@id_alojamiento, @id_amenidad)`);
        }

        res.status(201).json({ mensaje: 'Amenidades asociadas correctamente.' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/alojamientos/{id}:
 *   put:
 *     summary: Editar un alojamiento propio
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
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               titulo:
 *                 type: string
 *               descripcion:
 *                 type: string
 *               tipo_alojamiento:
 *                 type: string
 *               precio_por_noche:
 *                 type: number
 *               capacidad_personas:
 *                 type: integer
 *               num_habitaciones:
 *                 type: integer
 *               num_banos:
 *                 type: integer
 *               direccion:
 *                 type: string
 *     responses:
 *       200:
 *         description: Alojamiento actualizado
 *       403:
 *         description: No tenés permiso sobre este alojamiento
 *       404:
 *         description: Alojamiento no encontrado
 */
router.put('/:id', verificarToken, async (req, res) => {
    try {
        await poolConnect;

        const alojamiento = await pool.request()
            .input('id_alojamiento', sql.Int, req.params.id)
            .query('SELECT id_anfitrion FROM Alojamientos WHERE id_alojamiento = @id_alojamiento');

        if (alojamiento.recordset.length === 0) {
            return res.status(404).json({ error: 'Alojamiento no encontrado.' });
        }
        if (alojamiento.recordset[0].id_anfitrion !== req.user.id) {
            return res.status(403).json({ error: 'No tenés permiso sobre este alojamiento.' });
        }

        const {
            titulo, descripcion, tipo_alojamiento,
            precio_por_noche, capacidad_personas,
            num_habitaciones, num_banos, direccion
        } = req.body;

        await pool.request()
            .input('id_alojamiento',     sql.Int,           req.params.id)
            .input('titulo',             sql.VarChar,       titulo)
            .input('descripcion',        sql.VarChar,       descripcion)
            .input('tipo_alojamiento',   sql.VarChar,       tipo_alojamiento)
            .input('precio_por_noche',   sql.Decimal(10,2), precio_por_noche)
            .input('capacidad_personas', sql.Int,           capacidad_personas)
            .input('num_habitaciones',   sql.Int,           num_habitaciones || 1)
            .input('num_banos',          sql.Int,           num_banos || 1)
            .input('direccion',          sql.VarChar,       direccion)
            .query(`UPDATE Alojamientos SET
                        titulo = @titulo,
                        descripcion = @descripcion,
                        tipo_alojamiento = @tipo_alojamiento,
                        precio_por_noche = @precio_por_noche,
                        capacidad_personas = @capacidad_personas,
                        num_habitaciones = @num_habitaciones,
                        num_banos = @num_banos,
                        direccion = @direccion
                    WHERE id_alojamiento = @id_alojamiento`);

        res.json({ mensaje: 'Alojamiento actualizado exitosamente.' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/alojamientos/{id}:
 *   delete:
 *     summary: Desactivar (eliminar) un alojamiento propio
 *     tags: [Alojamientos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Alojamiento desactivado
 *       400:
 *         description: Tiene reservas activas
 *       403:
 *         description: No tenés permiso sobre este alojamiento
 *       404:
 *         description: Alojamiento no encontrado
 */
router.delete('/:id', verificarToken, async (req, res) => {
    try {
        await poolConnect;

        const alojamiento = await pool.request()
            .input('id_alojamiento', sql.Int, req.params.id)
            .query('SELECT id_anfitrion FROM Alojamientos WHERE id_alojamiento = @id_alojamiento');

        if (alojamiento.recordset.length === 0) {
            return res.status(404).json({ error: 'Alojamiento no encontrado.' });
        }
        if (alojamiento.recordset[0].id_anfitrion !== req.user.id) {
            return res.status(403).json({ error: 'No tenés permiso sobre este alojamiento.' });
        }

        // Bloquear si tiene reservas activas (pendientes o confirmadas)
        const reservasActivas = await pool.request()
            .input('id_alojamiento', sql.Int, req.params.id)
            .query(`SELECT COUNT(*) AS total FROM Reservas
                    WHERE id_alojamiento = @id_alojamiento
                      AND estado IN ('pendiente', 'confirmada')`);

        if (reservasActivas.recordset[0].total > 0) {
            return res.status(400).json({
                error: 'No podés eliminar este alojamiento porque tiene reservas activas.'
            });
        }

        await pool.request()
            .input('id_alojamiento', sql.Int, req.params.id)
            .query('UPDATE Alojamientos SET activo = 0 WHERE id_alojamiento = @id_alojamiento');

        res.json({ mensaje: 'Alojamiento eliminado exitosamente.' });
    } catch (err) {
        res.status(400).json({ error: err.message });
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