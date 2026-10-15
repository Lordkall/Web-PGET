from fastapi import FastAPI, HTTPException, status, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List, Any, Dict
import os
import sys

_backend_dir = os.path.dirname(os.path.abspath(__file__))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)
from database import (
    authenticate_user,
    get_user_by_username,
    get_all_users,
    create_user_record,
    update_user_record,
    delete_user_record,
    create_initial_users,
    get_all_cargos,
    add_cargo_record,
    delete_cargo_record,
    delete_user_arc
)

from datetime import datetime
import re
import unicodedata
from urllib.parse import unquote

app = FastAPI(
    title="API Procuraduría General del Estado Trujillo",
    version="2.0",
    redirect_slashes=False,
    docs_url=None if os.getenv("VERCEL") else "/docs",
    redoc_url=None if os.getenv("VERCEL") else "/redoc",
    openapi_url=None if os.getenv("VERCEL") else "/openapi.json"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def vercel_path_rewrite_middleware(request: Request, call_next):
    # Restaurar la ruta cuando Vercel reescribe hacia /api/index.py?__p=/api/...
    query_p = request.query_params.get("__p")
    if query_p:
        request.scope["path"] = query_p
        request.scope["raw_path"] = query_p.encode("utf-8")
    elif request.url.path.endswith("index.py") or request.url.path in ["/api", "/api/"]:
        matched = request.headers.get("x-matched-path") or request.headers.get("x-forwarded-uri")
        if matched and not matched.endswith(".py"):
            clean_m = matched.split("?")[0]
            request.scope["path"] = clean_m
            request.scope["raw_path"] = clean_m.encode("utf-8")
    return await call_next(request)

class LoginRequest(BaseModel):
    username: str
    password: str

class UserCreateRequest(BaseModel):
    username: str
    password: str
    role: Optional[str] = "trabajador"
    nombres: Optional[str] = None
    apellidos: Optional[str] = None
    nombre: Optional[str] = None
    profesion: Optional[str] = "Abogado"
    genero: Optional[str] = "masculino"
    cedula: str
    cargo: str
    condicion: Optional[str] = "FIJO"
    salario: Optional[str] = "Bs. 1.000,00"
    dependencia: Optional[str] = "PROCURADURÍA GENERAL DEL ESTADO TRUJILLO"
    direccion: Optional[str] = "DIRECCIÓN DE RECURSOS HUMANOS"
    fecha_ingreso: Optional[str] = ""
    anos_servicio: Optional[str] = "0"
    banco: Optional[str] = ""
    cuenta: Optional[str] = ""
    arc_file: Optional[Any] = None

class UserUpdateRequest(BaseModel):
    username: Optional[str] = None
    new_username: Optional[str] = None
    nombres: Optional[str] = None
    apellidos: Optional[str] = None
    nombre: Optional[str] = None
    profesion: Optional[str] = None
    genero: Optional[str] = None
    cedula: Optional[str] = None
    cargo: Optional[str] = None
    condicion: Optional[str] = None
    salario: Optional[str] = None
    dependencia: Optional[str] = None
    direccion: Optional[str] = None
    fecha_ingreso: Optional[str] = None
    anos_servicio: Optional[str] = None
    banco: Optional[str] = None
    cuenta: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None
    arc_file: Optional[Any] = None

class ArcUploadRequest(BaseModel):
    name: str
    type: str
    data: str
    size: Optional[int] = 0
    uploaded_at: Optional[str] = None

class UserDeleteRequest(BaseModel):
    username: Optional[str] = None

@app.on_event("startup")
async def startup_event():
    try:
        await create_initial_users()
    except Exception as e:
        print(f"Error on startup initializing users: {e}")

def get_frontend_dir():
    _cur = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(_cur, "frontend"),
        os.path.join(_cur, "..", "frontend"),
        os.path.join(_cur, "..", "api", "frontend"),
        os.path.join(_cur, ".."),
        os.path.abspath("."),
        os.path.join(os.path.abspath("."), "frontend"),
        os.path.join(os.path.abspath("."), "api", "frontend"),
        os.path.join(os.path.abspath("."), "backend", "frontend"),
    ]
    for c in candidates:
        if os.path.exists(os.path.join(c, "index.html")):
            return os.path.abspath(c)
    return _cur

frontend_dir = get_frontend_dir()

@app.get("/")
async def serve_index():
    f_dir = frontend_dir or get_frontend_dir()
    idx = os.path.join(f_dir, "index.html")
    if os.path.exists(idx):
        return FileResponse(idx)
    return {"message": "Portal Web PGET en línea"}

@app.get("/api")
@app.get("/api/")
async def root():
    return {"message": "API Procuraduría General del Estado Trujillo (PGET) en línea", "status": "online"}

@app.get("/health")
@app.get("/api/health")
async def health():
    return {"status": "ok"}

@app.post("/api/login")
@app.post("/login")
async def login(request: LoginRequest):
    user = await authenticate_user(request.username.strip(), request.password.strip())
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos. Verifique sus credenciales."
        )
    
    # Sanitizar usuario (no exponer password plano en respuesta)
    safe_user = dict(user)
    safe_user.pop("password", None)
    safe_user.pop("_id", None)
    
    # Token simbólico que identifica al usuario
    token = f"pget-token-{safe_user['username']}"
    return {
        "message": "Login exitoso",
        "token": token,
        "user": safe_user
    }

@app.get("/api/users")
@app.get("/users")
async def list_users(condicion: Optional[str] = None):
    users = await get_all_users()
    safe_users = []
    cond_clean = condicion.strip().upper() if condicion else None
    for u in users:
        item = dict(u)
        item.pop("password", None)
        item.pop("_id", None)
        if cond_clean and str(item.get("condicion", "")).upper() != cond_clean:
            continue
        safe_users.append(item)
    return safe_users

@app.post("/api/users")
@app.post("/users")
async def create_user(request: UserCreateRequest):
    user_dict = request.dict()
    user_dict["username"] = user_dict["username"].strip().lower()
    if not user_dict.get("nombre"):
        user_dict["nombre"] = f"{user_dict.get('nombres', '')} {user_dict.get('apellidos', '')}".strip()
    if "cedula" in user_dict and user_dict["cedula"]:
        user_dict["cedula"] = re.sub(r'^[Vv]-?', '', str(user_dict["cedula"]).strip())
    
    created, error = await create_user_record(user_dict)
    if error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)
    
    safe_user = dict(created)
    safe_user.pop("password", None)
    safe_user.pop("_id", None)
    return {"message": "Usuario creado exitosamente", "user": safe_user}

# Rutas de Eliminación (definidas antes de rutas parametrizadas para evitar conflictos de enrutamiento)
@app.post("/api/users/delete")
@app.post("/users/delete")
@app.delete("/api/users/{username}")
@app.delete("/users/{username}")
@app.post("/api/users/{username}/delete")
@app.post("/users/{username}/delete")
async def delete_user(request: Optional[UserDeleteRequest] = None, username: Optional[str] = None):
    target = username or (request.username if request else None) or ""
    clean_username = unquote(str(target)).strip().lower()
    if not clean_username:
        raise HTTPException(status_code=400, detail="Debe especificar el usuario a eliminar")
        
    if clean_username in ["admin@pget.gob.ve", "admin"]:
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar la cuenta principal del Administrador del Sistema"
        )
    
    success = await delete_user_record(clean_username)
    if not success:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    return {"message": f"Usuario {clean_username} eliminado exitosamente"}

# Rutas para Catálogo y Gestión de Cargos
class CargoCreateRequest(BaseModel):
    nombre: str

@app.get("/api/cargos")
@app.get("/cargos")
async def list_cargos():
    cargos = await get_all_cargos()
    return cargos

@app.post("/api/cargos")
@app.post("/cargos")
async def create_cargo(req: CargoCreateRequest):
    success, err = await add_cargo_record(req.nombre)
    if not success:
        raise HTTPException(status_code=400, detail=err)
    return {"message": "Cargo registrado exitosamente", "nombre": req.nombre.strip().upper()}

@app.delete("/api/cargos/{nombre}")
@app.delete("/cargos/{nombre}")
@app.post("/api/cargos/{nombre}/delete")
@app.post("/cargos/{nombre}/delete")
async def remove_cargo(nombre: str):
    unquoted = unquote(nombre).strip().upper()
    await delete_cargo_record(unquoted)
    return {"message": f"Cargo {unquoted} eliminado"}

# Rutas de Actualización y Modificación de Usuarios
@app.post("/api/users/update")
@app.post("/users/update")
@app.put("/api/users/{username}")
@app.put("/users/{username}")
@app.post("/api/users/{username}/update")
@app.post("/users/{username}/update")
async def update_user(request: UserUpdateRequest, username: Optional[str] = None):
    target = username or request.username or ""
    clean_username = unquote(str(target)).strip().lower()
    if not clean_username:
        raise HTTPException(status_code=400, detail="Debe indicar el usuario a actualizar")
        
    raw_dict = request.dict()
    update_data = {k: v for k, v in raw_dict.items() if v is not None and v != "" and k not in ["username", "new_username"]}
    
    # Si explícitamente se envió arc_file como null/None o vacío, registrar eliminación
    if "arc_file" in request.__fields_set__ and (request.arc_file is None or request.arc_file == ""):
        update_data["arc_file"] = None
    
    # Permitir editar el correo electrónico / username
    new_user = request.new_username or (request.username if username and request.username.strip().lower() != clean_username else None)
    if new_user and new_user.strip().lower() != clean_username:
        clean_new_user = new_user.strip().lower()
        existing = await get_user_by_username(clean_new_user)
        if existing and existing.get("username", "").strip().lower() != clean_username:
            raise HTTPException(status_code=400, detail="El correo electrónico ya se encuentra registrado por otro usuario.")
        update_data["username"] = clean_new_user

    if not update_data:
        raise HTTPException(status_code=400, detail="No se enviaron datos para actualizar")
    
    if "cedula" in update_data and update_data["cedula"]:
        update_data["cedula"] = re.sub(r'^[Vv]-?', '', str(update_data["cedula"]).strip())
    
    updated = await update_user_record(clean_username, update_data)
    if not updated:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    safe_user = dict(updated)
    safe_user.pop("password", None)
    safe_user.pop("_id", None)
    return {"message": "Usuario actualizado exitosamente", "user": safe_user}

# Rutas para Subida, Consulta y Eliminación de Planillas ARC por Usuario
@app.post("/api/users/{username}/arc")
@app.post("/users/{username}/arc")
async def upload_arc(username: str, req: ArcUploadRequest):
    clean_username = unquote(str(username)).strip().lower()
    arc_dict = {
        "name": req.name,
        "type": req.type,
        "data": req.data,
        "size": req.size,
        "uploaded_at": req.uploaded_at or datetime.now().strftime("%d/%m/%Y %H:%M")
    }
    user = await update_user_record(clean_username, {"arc_file": arc_dict})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return {"message": "Planilla ARC subida exitosamente", "arc_file": arc_dict}

@app.get("/api/users/{username}/arc")
@app.get("/users/{username}/arc")
async def get_arc(username: str):
    clean_username = unquote(str(username)).strip().lower()
    user = await get_user_by_username(clean_username)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return {"arc_file": user.get("arc_file")}

@app.delete("/api/users/{username}/arc")
@app.delete("/users/{username}/arc")
@app.post("/api/users/{username}/arc/delete")
@app.post("/users/{username}/arc/delete")
async def remove_arc(username: str):
    clean_username = unquote(str(username)).strip().lower()
    await delete_user_arc(clean_username)
    return {"message": "Planilla ARC eliminada exitosamente"}

def format_cedula_oficial(cedula: str) -> str:
    if not cedula:
        return ""
    clean = re.sub(r'[^0-9]', '', str(cedula))
    if not clean:
        return str(cedula)
    try:
        with_dots = f"{int(clean):,}".replace(",", ".")
        return f"V- {with_dots}"
    except Exception:
        return f"V- {clean}"

def format_profession_by_gender(prof: Optional[str], gender: Optional[str]) -> str:
    if not prof:
        return ""
    is_fem = str(gender).lower() == "femenino"
    p = str(prof).strip()
    if "@" in p:
        p = p.replace("@", "a" if is_fem else "o")
    lower = p.lower()
    if lower.startswith("abog"):
        return "Abogada" if is_fem else "Abogado"
    if lower.startswith("ing"):
        return "Ingeniera" if is_fem else "Ingeniero"
    if lower.startswith("lic"):
        return "Licenciada" if is_fem else "Licenciado"
    if lower.startswith("prof"):
        return "Profesora" if is_fem else "Profesor"
    if lower.startswith("doct") or lower.startswith("dr"):
        return "Doctora" if is_fem else "Doctor"
    if "tecnic" in lower or "t.s.u" in lower or "tsu" in lower:
        return "Técnica Superior" if is_fem else "Técnico Superior"
    return p

def _seccion_centenas(n: int) -> str:
    if n == 0:
        return ""
    if n == 100:
        return "CIEN"
    centenas = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"]
    decenas = ["", "DIEZ", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"]
    diez_y = ["DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"]
    veinti = ["VEINTE", "VEINTIÚN", "VEINTIDÓS", "VEINTITRÉS", "VEINTICUATRO", "VEINTICINCO", "VEINTISÉIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE"]
    unidades = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"]

    c = n // 100
    resto = n % 100
    txt_c = centenas[c] if c < len(centenas) else ""
    if resto == 0:
        return txt_c
    if resto < 10:
        txt_d = unidades[resto]
    elif resto < 20:
        txt_d = diez_y[resto - 10]
    elif resto < 30:
        txt_d = veinti[resto - 20]
    else:
        d = resto // 10
        u = resto % 10
        txt_d = decenas[d] + (f" Y {unidades[u]}" if u > 0 else "")
    return f"{txt_c} {txt_d}".strip()

def numero_a_letras_entero(n: int) -> str:
    if n == 0:
        return "CERO"
    millones = n // 1000000
    resto_m = n % 1000000
    miles = resto_m // 1000
    unidades = resto_m % 1000
    partes = []
    if millones == 1:
        partes.append("UN MILLÓN")
    elif millones > 1:
        partes.append(f"{_seccion_centenas(millones)} MILLONES")
    if miles == 1:
        partes.append("UN MIL")
    elif miles > 1:
        partes.append(f"{_seccion_centenas(miles)} MIL")
    if unidades > 0:
        partes.append(_seccion_centenas(unidades))
    return " ".join(partes).strip()

def formatear_salario_letras(salario_raw: str):
    clean = str(salario_raw).replace("Bs.", "").replace("Bs", "").strip()
    clean = clean.replace(".", "").replace(",", ".")
    try:
        val = float(clean)
    except Exception:
        val = 1000.0
    
    entero = int(val)
    centimos = int(round((val - entero) * 100))
    letras_entero = numero_a_letras_entero(entero)
    letras_centimos = numero_a_letras_entero(centimos)
    
    if centimos == 0:
        texto_completo = f"{letras_entero} CON CERO CÉNTIMOS"
    else:
        texto_completo = f"{letras_entero} CON {letras_centimos} CÉNTIMOS"
    
    formato_num = f"Bs. {entero:,}".replace(",", ".") + f",{centimos:02d}"
    return texto_completo, formato_num

def fecha_a_letras_expedicion(dt: datetime) -> str:
    dias_letras = {
        1: "un (1)", 2: "dos (2)", 3: "tres (3)", 4: "cuatro (4)", 5: "cinco (5)",
        6: "seis (6)", 7: "siete (7)", 8: "ocho (8)", 9: "nueve (9)", 10: "diez (10)",
        11: "once (11)", 12: "doce (12)", 13: "trece (13)", 14: "catorce (14)", 15: "quince (15)",
        16: "dieciséis (16)", 17: "diecisiete (17)", 18: "dieciocho (18)", 19: "diecinueve (19)",
        20: "veinte (20)", 21: "veintiún (21)", 22: "veintidós (22)", 23: "veintitrés (23)",
        24: "veinticuatro (24)", 25: "veinticinco (25)", 26: "veintiséis (26)", 27: "veintisiete (27)",
        28: "veintiocho (28)", 29: "veintinueve (29)", 30: "treinta (30)", 31: "treinta y un (31)"
    }
    meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
    
    anos_letras = {
        2024: "dos mil veinticuatro (2024)",
        2025: "dos mil veinticinco (2025)",
        2026: "dos mil veintiséis (2026)",
        2027: "dos mil veintisiete (2027)",
        2028: "dos mil veintiocho (2028)"
    }
    
    dia_txt = dias_letras.get(dt.day, f"{dt.day} ({dt.day})")
    mes_txt = meses[dt.month - 1]
    ano_txt = anos_letras.get(dt.year, f"dos mil veintiséis ({dt.year})")
    
    return f"los {dia_txt} días del mes de {mes_txt} del año {ano_txt}"

def get_prefijo_profesion(profesion: Optional[str], genero: Optional[str] = "masculino") -> str:
    if not profesion:
        return ""
    p = profesion.lower()
    is_fem = str(genero).lower() == "femenino"
    if "abog" in p:
        return "Abog. "
    elif "ing" in p:
        return "Ing. "
    elif "tecnic" in p or "t.s.u" in p or "tsu" in p:
        return "T.S.U. "
    elif "lic" in p:
        return "Lic. "
    elif "prof" in p:
        return "Prof. "
    elif "dr" in p or "doct" in p:
        return "Dra. " if is_fem else "Dr. "
    return ""

def format_nombre_con_titulo(nombre: str, profesion: Optional[str], genero: Optional[str] = "masculino") -> str:
    if not nombre:
        return ""
    prefijo = get_prefijo_profesion(profesion, genero)
    if not prefijo:
        return nombre
    if nombre.lower().startswith(prefijo.lower().strip()):
        return nombre
    return f"{prefijo}{nombre}"

def clean_text_initials(text: str) -> str:
    if not text:
        return ""
    nfkd = unicodedata.normalize("NFKD", str(text))
    cleaned = "".join([c for c in nfkd if not unicodedata.combining(c)]).strip().upper()
    cleaned = re.sub(
        r'^(ABOG\.|ABOGADA|ABOGADO|ING\.|INGENIERO|INGENIERA|LIC\.|LICENCIADO|LICENCIADA|T\.S\.U\.|TSU|PROF\.|PROFESOR|PROFESORA|DRA?\.|DOCTOR|DOCTORA)\s+',
        '', cleaned, flags=re.IGNORECASE
    ).strip()
    return cleaned

def get_worker_initials(user: dict) -> str:
    if not user:
        return "xx"
    
    nombres = clean_text_initials(str(user.get("nombres") or ""))
    apellidos = clean_text_initials(str(user.get("apellidos") or ""))
    
    if nombres and apellidos:
        part_n = nombres.split()[0] if nombres.split() else ""
        part_a = apellidos.split()[0] if apellidos.split() else ""
        if part_n and part_a:
            return f"{part_n[0]}{part_a[0]}".lower()
            
    # Si viene en nombre o nombres/apellidos combinados
    nombre_raw = clean_text_initials(str(user.get("nombre") or ""))
    if nombre_raw:
        from database import split_nombre_apellidos
        split_n, split_a = split_nombre_apellidos(nombre_raw)
        split_n = clean_text_initials(split_n)
        split_a = clean_text_initials(split_a)
        part_n = split_n.split()[0] if split_n.split() else ""
        part_a = split_a.split()[0] if split_a.split() else ""
        if part_n and part_a:
            return f"{part_n[0]}{part_a[0]}".lower()
        parts = nombre_raw.split()
        if len(parts) >= 2:
            return f"{parts[0][0]}{parts[1][0]}".lower()
        elif len(parts) == 1:
            return f"{parts[0][0]}x".lower()
            
    return "xx"

@app.get("/api/constancia")
@app.get("/constancia")
async def solicitar_constancia(
    token: Optional[str] = None,
    username: Optional[str] = None,
    nota: Optional[str] = None,
    con_salario: Optional[str] = "true"
):
    if not token or not str(token).strip():
        raise HTTPException(status_code=401, detail="No autorizado: token requerido")
    
    token_user_key = str(token).replace("pget-token-", "").strip().lower()
    token_user = await get_user_by_username(token_user_key)
    if not token_user:
        raise HTTPException(status_code=401, detail="Token de sesión no válido o expirado")
        
    req_username = unquote(username).strip().lower() if username else token_user_key
    
    # Solo el propio trabajador o el administrador pueden emitir/visualizar la constancia
    if token_user.get("role") != "admin" and token_user_key != req_username:
        raise HTTPException(status_code=403, detail="No tiene permisos para consultar constancias de otros funcionarios")

    user = await get_user_by_username(req_username)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if user.get("role") == "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Los administradores gestionan el personal y no tienen permitido generar constancias de trabajo personales."
        )
    
    incluir_salario = str(con_salario).lower() in ["true", "1", "si", "sí", "con"]
    condicion = (user.get("condicion") or "FIJO").upper()
    genero = (user.get("genero") or "masculino").lower()
    profesion_raw = user.get("profesion") or ""
    profesion = format_profession_by_gender(profesion_raw, genero)
    nombre_raw = user.get("nombre") or "TRABAJADOR PGET"
    nombre_completo = format_nombre_con_titulo(nombre_raw, profesion, genero)
    cedula_raw = re.sub(r'^[Vv]-?', '', str(user.get("cedula") or ""))
    cedula_oficial = format_cedula_oficial(cedula_raw)
    cargo = user.get("cargo") or "FUNCIONARIO"
    direccion = user.get("direccion") or "DIRECCIÓN GENERAL"
    dependencia = user.get("dependencia") or "PROCURADURÍA GENERAL DEL ESTADO TRUJILLO"
    fecha_ingreso = user.get("fecha_ingreso") or "N/D"
    anos_servicio = user.get("anos_servicio") or "0"
    salario_raw = user.get("salario") or "Bs. 1.000,00"
    salario_en_letras, salario_formato_bs = formatear_salario_letras(salario_raw)

    now = datetime.now()
    fecha_cierre_txt = fecha_a_letras_expedicion(now)
    correlativo = f"PGET {now.year} Nº S/N"

    # Adaptación por género
    es_femenino = genero == "femenino"
    tratamiento_ciudadano = "la ciudadana:" if es_femenino else "el ciudadano:"
    nacionalidad = "venezolana" if es_femenino else "venezolano"
    adscrito_txt = "adscrita" if es_femenino else "adscrito"
    jubilado_txt = "jubilada" if es_femenino else "jubilado"

    # Redacción exacta según las 3 imágenes oficiales de la PGET
    if condicion == "JUBILADO":
        modelo = "JUBILADO"
        titulo = "C O N S T A N C I A ."
        if incluir_salario:
            clausula_salario = f", devengando una asignación mensual por jubilación de Bolívares **{salario_en_letras} ({salario_formato_bs})**."
        else:
            clausula_salario = "."
        
        cuerpo = (
            f"Quien suscribe, **Abog. ELVIMAR CAROLINA LÓPEZ ARAUJO**, venezolana, mayor de edad, "
            f"titular de la cédula de identidad Nº. **V- 14.780.947**, en mi condición de "
            f"**DIRECTORA (E) DE RECURSOS HUMANOS DE LA PROCURADURÍA GENERAL DEL ESTADO TRUJILLO**, "
            f"por medio de la presente hago constar que {tratamiento_ciudadano} **{nombre_completo}**, "
            f"{nacionalidad}, mayor de edad, titular de la Cédula de Identidad Nº. **{cedula_oficial}**, "
            f"prestó sus servicios en la **PROCURADURÍA GENERAL DEL ESTADO TRUJILLO** actualmente es "
            f"{jubilado_txt} de este organismo{clausula_salario}\n\n"
            f"Constancia que se expide a instancia de parte interesada en la ciudad de Trujillo, a {fecha_cierre_txt}."
        )
    elif condicion == "CONTRATADO":
        modelo = "CONTRATADO"
        titulo = "C O N S T A N C I A ."
        if incluir_salario:
            clausula_salario = f", con una Asignación Mensual de Bolívares **{salario_en_letras} ({salario_formato_bs})**."
        else:
            clausula_salario = "."
        
        cuerpo = (
            f"Quien suscribe, **Abog. ELVIMAR CAROLINA LÓPEZ ARAUJO**, venezolana, mayor de edad, "
            f"titular de la cédula de identidad Nº. **V- 14.780.947**, en mi condición de "
            f"**DIRECTORA (E) DE RECURSOS HUMANOS DE LA PROCURADURÍA GENERAL DEL ESTADO TRUJILLO**, "
            f"por medio de la presente hago constar que {tratamiento_ciudadano} **{nombre_completo}**, "
            f"{nacionalidad}, mayor de edad, titular de la cédula de Identidad Nº. **{cedula_oficial}**, "
            f"presta sus servicios en la **PROCURADURÍA GENERAL DEL ESTADO TRUJILLO** desde el "
            f"**{fecha_ingreso}**, desempeñándose en la actualidad como **{cargo} (CONTRATADO)**, "
            f"{adscrito_txt} a la {direccion} de la Procuraduría General del Estado Trujillo{clausula_salario}\n\n"
            f"Constancia que se expide a instancia de parte interesada en la ciudad de Trujillo, a {fecha_cierre_txt}."
        )
    else:  # FIJO
        modelo = "FIJO"
        titulo = "C O N S T A N C I A ."
        if incluir_salario:
            clausula_salario = f", con una Asignación Mensual de Bolívares **{salario_en_letras} ({salario_formato_bs})**."
        else:
            clausula_salario = "."
        
        cuerpo = (
            f"Quien suscribe, **Abog. ELVIMAR CAROLINA LÓPEZ ARAUJO**, venezolana, mayor de edad, "
            f"titular de la cédula de identidad Nº. **V- 14.780.947**, en mi condición de "
            f"**DIRECTORA (E) DE RECURSOS HUMANOS DE LA PROCURADURÍA GENERAL DEL ESTADO TRUJILLO**, "
            f"por medio de la presente hago constar que {tratamiento_ciudadano} **{nombre_completo}**, "
            f"{nacionalidad}, mayor de edad, titular de la Cédula de Identidad Nº. **{cedula_oficial}** "
            f"presta sus servicios en la **PROCURADURÍA GENERAL DEL ESTADO TRUJILLO**, desde el "
            f"**{fecha_ingreso}** desempeñándose como **{cargo}**, "
            f"{adscrito_txt} a la {direccion} P.G.E.T.{clausula_salario}\n\n"
            f"Constancia que se expide a instancia de parte interesada en la ciudad de Trujillo, a {fecha_cierre_txt}."
        )

    iniciales_suscribe = "EL"
    iniciales_trabajador = str(get_worker_initials(user) or "xx").lower()
    iniciales = f"{iniciales_suscribe}/{iniciales_trabajador}"

    return {
        "status": "success",
        "modelo": modelo,
        "titulo": titulo,
        "correlativo": correlativo,
        "beneficiario": nombre_completo,
        "nombre_original": nombre_raw,
        "profesion": profesion,
        "genero": genero,
        "prefijo": get_prefijo_profesion(profesion, genero).strip(),
        "cedula": cedula_oficial,
        "cargo": cargo,
        "condicion": condicion,
        "direccion": direccion,
        "dependencia": dependencia,
        "fecha_ingreso": fecha_ingreso,
        "anos_servicio": anos_servicio,
        "con_salario": incluir_salario,
        "salario": salario_formato_bs if incluir_salario else None,
        "salario_en_letras": salario_en_letras if incluir_salario else None,
        "fecha_emision": fecha_cierre_txt,
        "rif": "G-20000417-7",
        "firmante_nombre": "ABG. ELVIMAR CAROLINA LÓPEZ ARAUJO.",
        "firmante_cargo": "DIRECTORA (E) DE RECURSOS HUMANOS DE LA\nPROCURADURÍA GENERAL DEL ESTADO TRUJILLO.",
        "iniciales": iniciales,
        "cuerpo": cuerpo
    }

@app.api_route("/api/{subpath:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def api_not_found(subpath: str):
    raise HTTPException(status_code=404, detail=f"Endpoint de API no encontrado: /api/{subpath}")

@app.get("/{file_path:path}")
async def serve_static_or_page(file_path: str):
    clean_path = file_path.strip("/")
    if clean_path.startswith("api/") or clean_path == "api":
        raise HTTPException(status_code=404, detail="Endpoint no encontrado")
        
    f_dir = frontend_dir or get_frontend_dir()
    if not clean_path:
        return FileResponse(os.path.join(f_dir, "index.html"))
        
    target = os.path.join(f_dir, clean_path)
    if os.path.isfile(target):
        return FileResponse(target)
        
    if os.path.isfile(target + ".html"):
        return FileResponse(target + ".html")
        
    return FileResponse(os.path.join(f_dir, "index.html"))
