# Frontend — Organizador de Eventos Independientes

Aplicación web desarrollada en React + Vite para el Mini-proyecto 1 del curso
Proyecto Integrador I (750018C, 2026-II), Universidad del Valle.

## Integrantes del Grupo

- Juan Pablo Escamilla Montilla — 202420580
- Santiago David Guerrero Jaramillo — 20241903
- Brayan Steven Candela Isaza — 20241501
- Nicolle Andrea Paz Molineros — 202419714

## Stack

- React 19
- Vite
- JavaScript (ES6+)
- CSS3 nativo (CSS Grid, Flexbox y Custom Properties)
- Despliegue: Vercel

## Setup local

1. Clona el repositorio:
    ```bash
    git clone <URL_DE_TU_REPOSITORIO_FRONTEND>
    ```
   
2. Entra a la carpeta:
   ```bash
    cd Frontend
    ```

3. Instala las dependencias:
   ```bash
   npm install
    ```
   
4. Crea un archivo .env en la raíz del proyecto con la variable del backend:
   ```bash
    VITE_API_URL=http://localhost:8000
    ```

5. Inicia el servidor de desarrollo:
   ```bash
    npm run dev
    ```
   
6. Abre en tu navegador http://localhost:5173

## Integración con la API

| Método | Endpoint | Propósito |
|---|---|---|
| GET | /api/health/ | Comprueba la disponibilidad del servicio |
| GET | /api/db-test/ | Comprueba la conexión activa con la base de datos PostgreSQL |

## Despliegue

- Frontend en producción (Vercel): https://frontend-zeta-six-hvm0b3059n.vercel.app/
- Backend conectado (Render): https://backend-eventos-csrw.onrender.com