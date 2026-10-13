# Web PGET - Procuraduría General del Estado Trujillo

Sitio Web Institucional y Sistema de Gestión de Personal / Constancias de Trabajo de la **Procuraduría General del Estado Trujillo (PGET)**.
Desplegado completamente en **Vercel** (Frontend + Backend FastAPI Serverless).

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
├── api/                       # Punto de entrada Serverless para Vercel
│   └── index.py               # Enrutador FastAPI
│
├── backend/                   # Lógica del Backend (FastAPI + MongoDB Atlas)
│   ├── main.py                # Endpoints de autenticación, usuarios y constancias
│   ├── database.py            # Conexión a MongoDB con fallback
│   └── requirements.txt       # Dependencias
│
├── vercel.json                # Configuración unificada de Vercel
├── requirements.txt           # Dependencias raíz para el runtime de Vercel
├── .gitignore                 # Archivos excluidos del control de versiones
└── README.md                  # Documentación del proyecto
```

---

## 🚀 Despliegue Unificado en Vercel

1. Inicia sesión en [Vercel](https://vercel.com/) con tu cuenta de GitHub (**Lordkall**).
2. Si ya importaste el repositorio:
   - Ve a **Settings** > **General**.
   - Asegúrate de que **Root Directory** esté en `./` (la raíz del proyecto).
   - ¡Vercel compilará automáticamente tanto el Frontend como la API de Python!
3. **Variables de Entorno (Opcional)**:
   - En Vercel > **Settings** > **Environment Variables**:
     - `MONGO_URI`: `mongodb+srv://lorenzoavila07_db_user:Jso40aJ1Z38xkmbV@pgetweb.npkuwlb.mongodb.net/?appName=pgetweb`
4. **Dominio**:
   - Tu sitio estará disponible bajo tu dominio `.vercel.app`.
   - La API responde automáticamente en `/api/` (ejemplo: `/api/health`, `/api/login`, `/api/users`).

---

## 💻 Ejecución Local

### Backend:
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend:
Abre `frontend/index.html` en el navegador o usando Live Server.
