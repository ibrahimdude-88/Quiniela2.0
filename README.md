# Quiniela Mundialista 2026

Plataforma de predicciones y apuestas (quiniela) para el **Mundial 2026**. Los usuarios pueden registrarse, ver partidos, hacer y modificar pronósticos, consultar la tabla general de resultados, llaves eliminatorias y ver el ranking global. Incluye un bot de premios y un panel de administración completo.

## Características

* **Sistema de Usuarios y Ranking**: Cada usuario se une obteniendo puntos basados en los partidos donde aciertan ganador y marcador. Tienen acceso a insignias, progreso visual y porcentaje de ganancias del premio final en base al ranking.
* **Sistema Drag & Drop**: Visualización nativa e impecable de las etapas eliminatorias con un motor interactivo donde se puede usar pan y hacer zoom para consultar los brackets.
* **Dashboard Administrativo Completo**: Acceso seguro como administrador ('Admin'). Contiene control por grupos, modificación de resultados para partidos, automatización del paso y de clasificados hacia fases eliminatorias, edición de llaves de los partidos (Octavos, Cuartos, Semifinal, Final), configuración general de premios/costos y vistas previas.
* **Diseño Premium**: Interfaz fluida (Dark Mode/Light Background), responsiva y moderna diseñada en Tailwind CSS con transiciones fluidas y sistema de alertas (toast notifications) y animaciones de celebración.

## Tecnología

* **Frontend**: HTML5, Vanilla JavaScript, CSS Puro.
* **Estilos**: Tailwind CSS (vía CDN) + Tipografías (Google Fonts `Inter`).
* **Autenticación, Storage, Backend (BaaS)**: [Supabase](https://supabase.com).
* **Despliegue Listado**: Listo para usarse bajo un entorno de Edge o CDN como Vercel o GitHub Pages debido al uso de URLs claras.

## Configuración y Despliegue Local o Remoto

El proyecto está creado de forma modular y estática en tu directorio principal. Esto significa que **Vercel** subirá el repositorio directamente sin utilizar comandos de configuración que requieran Node.js o `npm run build`.

1. **Configuración de la Base de Datos**: Ejecuta y migra los `*.sql` correspondientes que se alojan o alojaron a tu panel en *Supabase > SQL Editor*.
2. Asegúrate de configurar variables de entorno si vas a interactuar con otras integraciones posteriormente (la URL y llave anónima ya vienen adjuntadas de forma local vía `supabaseClient.js` al servidor en producción).

## Arquitectura de Carpetas

* `index.html`: Dashboard y portal del usuario (ranking, partidos, reglas).
* `admin.html`: Portal de control del administrador.
* `login.html`: Panel de Autenticación.
* `app.js`, `app_bracket_ext.js`, `auth.js` : Manejan la lógica interactiva principal del cliente.
* `admin.js`: Control completo del portal administrativo.
* `archive/`: Contiene códigos previos, archivos de pruebas antiguas, historiales y consultas SQL de respaldo correspondientes al desarrollo original.
* `vercel.json`: Reglas de enrutamiento para desplegar como `/admin` o `/login` (Clean URLs en Vercel).

---
*Desarrollado para el Mundial 2026.*
