# Web PGET - Procuraduría General del Estado Trujillo

Sitio Web Institucional y Sistema de Gestión de Personal / Constancias de Trabajo de la **Procuraduría General del Estado Trujillo (PGET)**.

---

## 🏛 Estructura del Proyecto

```text
Web-PGET/
├── frontend/                  # Sitio Web Estático (HTML5, CSS3, Vanilla JS)
│   ├── assets/                # Logos institucionales e imágenes
│   ├── css/                   # Hojas de estilo responsive
│   ├── js/                    # Lógica de autenticación, constancias y administración
│   ├── index.html             # Página principal
│   ├── bases-juridicas.html   # Leyes y base legal
│   ├── contacto.html          # Información de contacto y ubicación
│   ├── organigrama.html       # Estructura organizativa interactiva
│   └── ...                    # Misión, visión, valores, etc.
│
├── backend/                   # API REST con FastAPI y MongoDB Atlas
│   ├── main.py                # Endpoints de autenticación, usuarios y constancias
│   ├── database.py            # Conexión a MongoDB con fallback
│   ├── requirements.txt       # Dependencias de Python
│   ├── Dockerfile             # Contenedor para despliegue en Koyeb / Docker
│   └── Procfile               # Despliegue alternativo en PaaS
│
├── vercel.json                # Configuración de rutas y rewrites para Vercel
├── .gitignore                 # Archivos excluidos del control de versiones
└── README.md                  # Documentación del proyecto
```

---

## 🚀 Despliegue del Frontend en Vercel

1. Inicia sesión en [Vercel](https://vercel.com/) con tu cuenta de GitHub (**Lordkall**).
2. Haz clic en **Add New...** > **Project**.
3. Selecciona el repositorio **`Web-PGET`** (o `Web PGET`) y pulsa **Import**.
4. En la configuración del proyecto:
   - **Framework Preset**: `Other`
   - **Root Directory**: Deja la raíz `./` (el archivo `vercel.json` se encarga de servir `frontend`) o selecciona `frontend`.
5. Haz clic en **Deploy**.
6. **Dominio en Vercel**:
   - Vercel te asignará automáticamente un dominio gratuito: `https://web-pget.vercel.app`.
   - Puedes personalizar el subdominio en la pestaña **Settings** > **Domains**.

---

## ⚡ Despliegue del Backend en Koyeb

1. Inicia sesión en [Koyeb](https://www.koyeb.com/) con tu cuenta de GitHub.
2. Haz clic en **Create App**.
3. Selecciona **GitHub** como fuente de despliegue y escoge el repositorio **`Web-PGET`**.
4. Configuración del servicio:
   - **Work Directory**: `backend`
   - **Builder**: `Dockerfile` (o `Buildpack`)
   - **Port**: `8000` (Protocolo HTTP)
   - **Environment Variables**:
     - `MONGO_URI`: `mongodb+srv://lorenzoavila07_db_user:Jso40aJ1Z38xkmbV@pgetweb.npkuwlb.mongodb.net/?appName=pgetweb`
5. Haz clic en **Deploy**.
6. Koyeb te otorgará una URL pública segura (ejemplo: `https://web-pget-api.koyeb.app`).
   - El frontend detectará automáticamente el backend o puedes configurar la URL en `frontend/js/script.js` (`PROD_API_URL`).

---

## 💻 Ejecución Local

### Backend:
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend:
Abre `frontend/index.html` en el navegador o sírvelo con una extensión como Live Server.
