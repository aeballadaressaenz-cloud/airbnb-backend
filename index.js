const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
require('dotenv').config();

const usuariosRoutes     = require('./routes/usuarios');
const alojamientosRoutes = require('./routes/alojamientos');
const reservasRoutes     = require('./routes/reservas');
const ciudadesRoutes     = require('./routes/ciudades');

const app = express();

app.use(cors());
app.use(express.json());

// Configuración Swagger
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'API Plataforma Airbnb - Aileen B',
            version: '1.0.0',
            description: 'API REST para plataforma de alojamientos tipo Airbnb. Permite registro de usuarios, listado de alojamientos, reservas y valoraciones.',
        },
        servers: [{ url: 'http://localhost:3000' }],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT'
                }
            }
        }
    },
    apis: ['./routes/*.js']
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Rutas
app.use('/api/usuarios',     usuariosRoutes);
app.use('/api/alojamientos', alojamientosRoutes);
app.use('/api/reservas',     reservasRoutes);
app.use('/api/ciudades',     ciudadesRoutes);

// Ruta de prueba
app.get('/', (req, res) => {
    res.json({ 
        mensaje: 'API Airbnb Grupo 4 funcionando ✅',
        documentacion: 'http://localhost:3000/api/docs'
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    console.log(`Documentación Swagger: http://localhost:${PORT}/api/docs`);
});
