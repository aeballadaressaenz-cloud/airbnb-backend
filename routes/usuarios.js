const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool, poolConnect, sql } = require('../db');
const { verificarToken } = require('../middleware/auth');
require('dotenv').config();

/**
 * @swagger
 * /api/usuarios/registro:
 *   post:
 *     summary: Registrar un nuevo usuario
 *     tags: [Usuarios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombre, apellido, email, password]
 *             properties:
 *               nombre:
 *                 type: string
 *               apellido:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               telefono:
 *                 type: string
 *               rol:
 *                 type: string
 *                 enum: [huesped, anfitrion, ambos]
 *     responses:
 *       201:
 *         description: Usuario registrado exitosamente
 *       400:
 *         description: Email ya registrado u error de validación
 */
router.post('/registro', async (req, res) => {
    try {
        await poolConnect;
        const { nombre, apellido, email, password, telefono, rol } = req.body;
        const password_hash = await bcrypt.hash(password, 10);
        const result = await pool.request()
            .input('nombre',        sql.VarChar, nombre)
            .input('apellido',      sql.VarChar, apellido)
            .input('email',         sql.VarChar, email)
            .input('password_hash', sql.VarChar, password_hash)
            .input('telefono',      sql.VarChar, telefono || null)
            .input('rol',           sql.VarChar, rol || 'huesped')
            .execute('sp_RegistrarUsuario');
        res.status(201).json({
            mensaje: 'Usuario registrado exitosamente.',
            id_usuario: result.recordset[0].id_usuario
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/usuarios/login:
 *   post:
 *     summary: Iniciar sesión
 *     tags: [Usuarios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login exitoso, retorna token JWT
 *       401:
 *         description: Credenciales incorrectas
 */
router.post('/login', async (req, res) => {
    try {
        await poolConnect;
        const { email, password } = req.body;
        const result = await pool.request()
            .input('email', sql.VarChar, email)
            .query('SELECT * FROM Usuarios WHERE email = @email AND activo = 1');
        if (result.recordset.length === 0) {
            return res.status(401).json({ error: 'Credenciales incorrectas.' });
        }
        const usuario = result.recordset[0];
        const passwordValida = await bcrypt.compare(password, usuario.password_hash);
        if (!passwordValida) {
            return res.status(401).json({ error: 'Credenciales incorrectas.' });
        }
        const token = jwt.sign(
            { id: usuario.id_usuario, email: usuario.email, rol: usuario.rol },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        res.json({
            mensaje: 'Login exitoso.',
            token,
            usuario: {
                id_usuario: usuario.id_usuario,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                email: usuario.email,
                rol: usuario.rol
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/usuarios/perfil:
 *   get:
 *     summary: Obtener perfil del usuario logueado
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Datos del perfil
 *       401:
 *         description: Token requerido
 */
router.get('/perfil', verificarToken, async (req, res) => {
    try {
        await poolConnect;
        const result = await pool.request()
            .input('id_usuario', sql.Int, req.user.id)
            .query('SELECT id_usuario, nombre, apellido, email, telefono, rol, fecha_registro FROM Usuarios WHERE id_usuario = @id_usuario');
        res.json(result.recordset[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/usuarios/perfil:
 *   put:
 *     summary: Actualizar perfil del usuario logueado
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *               apellido:
 *                 type: string
 *               telefono:
 *                 type: string
 *     responses:
 *       200:
 *         description: Perfil actualizado exitosamente
 *       401:
 *         description: Token requerido
 */
router.put('/perfil', verificarToken, async (req, res) => {
    try {
        await poolConnect;
        const { nombre, apellido, telefono } = req.body;

        await pool.request()
            .input('id_usuario', sql.Int,     req.user.id)
            .input('nombre',     sql.VarChar,  nombre)
            .input('apellido',   sql.VarChar,  apellido)
            .input('telefono',   sql.VarChar,  telefono || null)
            .query(`UPDATE Usuarios 
                    SET nombre = @nombre, 
                        apellido = @apellido, 
                        telefono = @telefono
                    WHERE id_usuario = @id_usuario`);

        res.json({ mensaje: 'Perfil actualizado exitosamente.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;