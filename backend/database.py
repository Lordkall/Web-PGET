from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
from urllib.parse import unquote

MONGO_URI = os.getenv("MONGO_URI", "mongodb+srv://lorenzoavila07_db_user:Jso40aJ1Z38xkmbV@pgetweb.npkuwlb.mongodb.net/?appName=pgetweb")

client = AsyncIOMotorClient(MONGO_URI)
db = client.pget_db
users_collection = db.users
cargos_collection = db.cargos

def split_nombre_apellidos(nombre_completo: str):
    parts = (nombre_completo or "").strip().split()
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    if len(parts) == 2:
        return parts[0], parts[1]
    mid = len(parts) // 2
    return " ".join(parts[:mid]), " ".join(parts[mid:])

# Fallback en memoria por si hay fallas de red con MongoDB Atlas
memory_users = [
    {
        "username": "admin@pget.gob.ve",
        "password": "admin123",
        "role": "admin",
        "nombres": "ADMINISTRADOR GENERAL",
        "apellidos": "PGET",
        "nombre": "ADMINISTRADOR GENERAL PGET",
        "profesion": "Ingeniero",
        "genero": "masculino",
        "cedula": "12345678",
        "cargo": "ADMINISTRADOR DEL SISTEMA",
        "condicion": "FIJO",
        "salario": "Bs. 1.500,00",
        "dependencia": "PROCURADURÍA GENERAL DEL ESTADO TRUJILLO",
        "direccion": "DESPACHO DEL PROCURADOR GENERAL",
        "fecha_ingreso": "01/01/2020",
        "anos_servicio": "6",
        "codigo_rac": "0001000001",
        "telefono_codigo": "0414",
        "telefono_numero": "1234567",
        "telefono": "0414-1234567",
        "banco": "Banco de Venezuela",
        "cuenta": "01020001234567891267"
    },
    {
        "username": "victoria@pget.gob.ve",
        "password": "password123",
        "role": "trabajador",
        "nombres": "VICTORIA ALEJANDRA",
        "apellidos": "CARMONA TORRES",
        "nombre": "VICTORIA ALEJANDRA CARMONA TORRES",
        "profesion": "Abogada",
        "genero": "femenino",
        "cedula": "27251622",
        "cargo": "ADMINISTRADOR PROFESIONAL I",
        "condicion": "FIJO",
        "salario": "Bs. 1.000,00",
        "dependencia": "PROCURADURÍA GENERAL DEL ESTADO TRUJILLO",
        "direccion": "DIRECCIÓN DE RECURSOS HUMANOS",
        "fecha_ingreso": "01/04/2024",
        "anos_servicio": "2",
        "codigo_rac": "0001827492",
        "telefono_codigo": "0414",
        "telefono_numero": "7251622",
        "telefono": "0414-7251622",
        "banco": "Banco de Venezuela",
        "cuenta": "01020384910029381267"
    },
    {
        "username": "lorenzo@pget.gob.ve",
        "password": "password123",
        "role": "trabajador",
        "nombres": "LORENZO FABIÁN",
        "apellidos": "ÁVILA GONZÁLEZ",
        "nombre": "ÁVILA GONZÁLEZ LORENZO FABIÁN",
        "profesion": "Ingeniero",
        "genero": "masculino",
        "cedula": "25006611",
        "cargo": "ANALISTA CENTRAL DE COMPUTACIÓN Y SISTEMAS",
        "condicion": "CONTRATADO",
        "salario": "Bs. 1.000,00",
        "dependencia": "PROCURADURÍA GENERAL DEL ESTADO TRUJILLO",
        "direccion": "DIRECCIÓN DE BIENES Y SERVICIOS",
        "fecha_ingreso": "21/11/2022",
        "anos_servicio": "4",
        "codigo_rac": "0002500661",
        "telefono_codigo": "0412",
        "telefono_numero": "5006611",
        "telefono": "0412-5006611",
        "banco": "Banco de Venezuela",
        "cuenta": "01020492817263541267"
    },
    {
        "username": "mario@pget.gob.ve",
        "password": "password123",
        "role": "trabajador",
        "nombres": "MARIO ANTONIO",
        "apellidos": "MAZZEY CASTELLANOS",
        "nombre": "MAZZEY CASTELLANOS MARIO ANTONIO",
        "profesion": "Licenciado",
        "genero": "masculino",
        "cedula": "9019850",
        "cargo": "AUDITOR JEFE",
        "condicion": "JUBILADO",
        "salario": "Bs. 142,00",
        "dependencia": "PROCURADURÍA GENERAL DEL ESTADO TRUJILLO",
        "direccion": "UNIDAD DE AUDITORÍA INTERNA",
        "fecha_ingreso": "15/03/1998",
        "anos_servicio": "25",
        "codigo_rac": "0000901985",
        "telefono_codigo": "0416",
        "telefono_numero": "9019850",
        "telefono": "0416-9019850",
        "banco": "Banco de Venezuela",
        "cuenta": "01020192837465011267"
    }
]

def format_user_doc(doc):
    if not doc:
        return None
    d = dict(doc)
    if "_id" in d:
        d["_id"] = str(d["_id"])
    if not d.get("nombres") or not d.get("apellidos"):
        nom, ape = split_nombre_apellidos(d.get("nombre", ""))
        if not d.get("nombres"):
            d["nombres"] = nom
        if not d.get("apellidos"):
            d["apellidos"] = ape
    if not d.get("nombre") and (d.get("nombres") or d.get("apellidos")):
        d["nombre"] = f"{d.get('nombres', '')} {d.get('apellidos', '')}".strip()
    return d

async def get_user_by_username(username: str):
    clean_name = unquote(str(username or "")).strip().lower()
    if not clean_name:
        return None
    try:
        user = await users_collection.find_one({"username": {"$regex": f"^{re.escape(clean_name)}$", "$options": "i"}})
        if user:
            return format_user_doc(user)
    except Exception as e:
        print(f"MongoDB warning in get_user_by_username: {e}")
    # Fallback memoria
    for u in memory_users:
        if u["username"].lower() == clean_name:
            return dict(u)
    return None

async def authenticate_user(username: str, password: str):
    # Soporte para alias simples
    effective_username = username
    if username == "admin":
        effective_username = "admin@pget.gob.ve"
    elif username == "trabajador1":
        effective_username = "victoria@pget.gob.ve"

    user = await get_user_by_username(effective_username)
    if not user and effective_username != username:
        user = await get_user_by_username(username)

    if user and user.get("password") == password:
        return user
    return None

async def get_all_users():
    try:
        cursor = users_collection.find({})
        docs = await cursor.to_list(length=200)
        valid_docs = [d for d in docs if d.get("username") not in ["admin", "trabajador1"]]
        return [format_user_doc(d) for d in valid_docs]
    except Exception as e:
        print(f"MongoDB warning in get_all_users: {e}")
    return [dict(u) for u in memory_users if u.get("username") not in ["admin", "trabajador1"]]

async def create_user_record(user_data: dict):
    # Asegurar consistencia de nombres, apellidos y nombre completo
    if not user_data.get("nombre") and (user_data.get("nombres") or user_data.get("apellidos")):
        user_data["nombre"] = f"{user_data.get('nombres', '')} {user_data.get('apellidos', '')}".strip()
    elif user_data.get("nombre") and (not user_data.get("nombres") or not user_data.get("apellidos")):
        nom, ape = split_nombre_apellidos(user_data["nombre"])
        if not user_data.get("nombres"):
            user_data["nombres"] = nom
        if not user_data.get("apellidos"):
            user_data["apellidos"] = ape

    # Verificar existencia
    existing = await get_user_by_username(user_data["username"])
    if existing:
        return None, "El correo electrónico o usuario ya se encuentra registrado."

    try:
        await users_collection.insert_one(user_data)
    except Exception as e:
        print(f"MongoDB warning in create_user_record: {e}")
        # Guardar en memoria
        memory_users.append(user_data)
        return user_data, None

    return user_data, None

async def update_user_record(username: str, update_fields: dict):
    clean_name = unquote(str(username or "")).strip().lower()
    if not clean_name:
        return None
    if "nombres" in update_fields or "apellidos" in update_fields:
        curr = await get_user_by_username(clean_name)
        curr_nom = update_fields.get("nombres") or (curr.get("nombres") if curr else "")
        curr_ape = update_fields.get("apellidos") or (curr.get("apellidos") if curr else "")
        update_fields["nombre"] = f"{curr_nom} {curr_ape}".strip()
    elif "nombre" in update_fields and ("nombres" not in update_fields or "apellidos" not in update_fields):
        nom, ape = split_nombre_apellidos(update_fields["nombre"])
        update_fields["nombres"] = nom
        update_fields["apellidos"] = ape

    new_clean_name = update_fields.get("username", clean_name).strip().lower()

    # Si arc_file es explícitamente None, preparar unset para MongoDB y memoria
    unset_fields = {}
    if "arc_file" in update_fields and update_fields["arc_file"] is None:
        unset_fields["arc_file"] = ""
        del update_fields["arc_file"]

    try:
        update_doc = {}
        if update_fields:
            update_doc["$set"] = update_fields
        if unset_fields:
            update_doc["$unset"] = unset_fields
        if update_doc:
            res = await users_collection.update_one(
                {"username": {"$regex": f"^{re.escape(clean_name)}$", "$options": "i"}},
                update_doc
            )
            if res.matched_count > 0:
                return await get_user_by_username(new_clean_name)
    except Exception as e:
        print(f"MongoDB warning in update_user_record: {e}")
    
    # Fallback memoria
    for idx, u in enumerate(memory_users):
        if u["username"].lower() == clean_name:
            if unset_fields:
                for uf in unset_fields:
                    memory_users[idx].pop(uf, None)
            if update_fields:
                memory_users[idx].update(update_fields)
            return dict(memory_users[idx])
    return None

async def delete_user_record(username: str):
    clean_name = unquote(str(username or "")).strip().lower()
    if not clean_name:
        return False
    deleted = False
    try:
        res = await users_collection.delete_one({"username": {"$regex": f"^{re.escape(clean_name)}$", "$options": "i"}})
        if res.deleted_count > 0:
            deleted = True
    except Exception as e:
        print(f"MongoDB warning in delete_user_record: {e}")
    
    # Sincronizar siempre con memoria
    initial_len = len(memory_users)
    memory_users[:] = [u for u in memory_users if u["username"].lower() != clean_name]
    if len(memory_users) < initial_len:
        deleted = True
    return deleted

async def create_initial_users():
    initial_accounts = [
        {
            "username": "admin@pget.gob.ve",
            "password": "admin123",
            "role": "admin",
            "nombres": "ADMINISTRADOR GENERAL",
            "apellidos": "PGET",
            "nombre": "ADMINISTRADOR GENERAL PGET",
            "profesion": "Ingeniero",
            "genero": "masculino",
            "cedula": "12345678",
            "cargo": "ADMINISTRADOR DEL SISTEMA",
            "condicion": "FIJO",
            "salario": "Bs. 1.500,00",
            "dependencia": "PROCURADURÍA GENERAL DEL ESTADO TRUJILLO",
            "direccion": "DESPACHO DEL PROCURADOR GENERAL",
            "fecha_ingreso": "01/01/2020",
            "anos_servicio": "6",
            "codigo_rac": "0001000001",
            "telefono_codigo": "0414",
            "telefono_numero": "1234567",
            "telefono": "0414-1234567",
            "banco": "Banco de Venezuela",
            "cuenta": "01020001234567891267"
        },
        {
            "username": "victoria@pget.gob.ve",
            "password": "password123",
            "role": "trabajador",
            "nombres": "VICTORIA ALEJANDRA",
            "apellidos": "CARMONA TORRES",
            "nombre": "VICTORIA ALEJANDRA CARMONA TORRES",
            "profesion": "Abogada",
            "genero": "femenino",
            "cedula": "27251622",
            "cargo": "ADMINISTRADOR PROFESIONAL I",
            "condicion": "FIJO",
            "salario": "Bs. 1.000,00",
            "dependencia": "PROCURADURÍA GENERAL DEL ESTADO TRUJILLO",
            "direccion": "DIRECCIÓN DE RECURSOS HUMANOS",
            "fecha_ingreso": "01/04/2024",
            "anos_servicio": "2",
            "codigo_rac": "0001827492",
            "telefono_codigo": "0414",
            "telefono_numero": "7251622",
            "telefono": "0414-7251622",
            "banco": "Banco de Venezuela",
            "cuenta": "01020384910029381267"
        },
        {
            "username": "lorenzo@pget.gob.ve",
            "password": "password123",
            "role": "trabajador",
            "nombres": "LORENZO FABIÁN",
            "apellidos": "ÁVILA GONZÁLEZ",
            "nombre": "ÁVILA GONZÁLEZ LORENZO FABIÁN",
            "profesion": "Ingeniero",
            "genero": "masculino",
            "cedula": "25006611",
            "cargo": "ANALISTA CENTRAL DE COMPUTACIÓN Y SISTEMAS",
            "condicion": "CONTRATADO",
            "salario": "Bs. 1.000,00",
            "dependencia": "PROCURADURÍA GENERAL DEL ESTADO TRUJILLO",
            "direccion": "DIRECCIÓN DE BIENES Y SERVICIOS",
            "fecha_ingreso": "21/11/2022",
            "anos_servicio": "4",
            "codigo_rac": "0002500661",
            "telefono_codigo": "0412",
            "telefono_numero": "5006611",
            "telefono": "0412-5006611",
            "banco": "Banco de Venezuela",
            "cuenta": "01020492817263541267"
        },
        {
            "username": "mario@pget.gob.ve",
            "password": "password123",
            "role": "trabajador",
            "nombres": "MARIO ANTONIO",
            "apellidos": "MAZZEY CASTELLANOS",
            "nombre": "MAZZEY CASTELLANOS MARIO ANTONIO",
            "profesion": "Licenciado",
            "genero": "masculino",
            "cedula": "9019850",
            "cargo": "AUDITOR JEFE",
            "condicion": "JUBILADO",
            "salario": "Bs. 142,00",
            "dependencia": "PROCURADURÍA GENERAL DEL ESTADO TRUJILLO",
            "direccion": "UNIDAD DE AUDITORÍA INTERNA",
            "fecha_ingreso": "15/03/1998",
            "anos_servicio": "25",
            "codigo_rac": "0000901985",
            "telefono_codigo": "0416",
            "telefono_numero": "9019850",
            "telefono": "0416-9019850",
            "banco": "Banco de Venezuela",
            "cuenta": "01020192837465011267"
        }
    ]

    try:
        # Eliminar alias redundantes antiguos para dejar un solo administrador
        await users_collection.delete_many({"username": {"$in": ["admin", "trabajador1"]}})

        # Verificar si la base de datos está totalmente vacía
        total = await users_collection.count_documents({})
        if total == 0:
            for acc in initial_accounts:
                await users_collection.insert_one(acc)
            print("Base de datos inicializada por primera vez.")
        else:
            # Si ya hay usuarios, asegurar exclusivamente que admin@pget.gob.ve exista
            admin_user = await users_collection.find_one({"username": "admin@pget.gob.ve"})
            if not admin_user:
                await users_collection.insert_one(initial_accounts[0])
                print("Administrador principal verificado.")
            print("Usuarios existentes preservados (no se reviven cuentas eliminadas).")
    except Exception as e:
        print(f"Error initializing users in MongoDB Atlas: {e}")

# =========================================================================
# GESTIÓN Y CATÁLOGO DE CARGOS INSTITUCIONALES PGET
# =========================================================================
DEFAULT_CARGOS = [
    "ADMINISTRADOR DEL SISTEMA",
    "ADMINISTRADOR PROFESIONAL I",
    "ANALISTA CENTRAL DE COMPUTACIÓN Y SISTEMAS",
    "AUDITOR JEFE",
    "ABOGADO I",
    "ABOGADO II",
    "ABOGADO III",
    "ASISTENTE ADMINISTRATIVO",
    "ASISTENTE JURÍDICO",
    "DIRECTOR GENERAL",
    "DIRECTOR DE LÍNEA",
    "DIRECTORA (E) DE RECURSOS HUMANOS",
    "ESPECIALISTA EN BIENES Y SERVICIOS",
    "SECRETARIA EJECUTIVA",
    "CHOFER",
    "OBRERO"
]

async def get_all_cargos():
    cargos = list(DEFAULT_CARGOS)
    try:
        cursor = cargos_collection.find({})
        docs = await cursor.to_list(length=300)
        for d in docs:
            name = (d.get("nombre") or "").strip().upper()
            if name and name not in cargos:
                cargos.append(name)
    except Exception as e:
        print(f"MongoDB warning in get_all_cargos: {e}")
    try:
        cursor_u = users_collection.find({}, {"cargo": 1})
        u_docs = await cursor_u.to_list(length=300)
        for u in u_docs:
            c = (u.get("cargo") or "").strip().upper()
            if c and c not in cargos:
                cargos.append(c)
    except Exception:
        pass
    return sorted(list(set(cargos)))

async def add_cargo_record(nombre: str):
    clean = (nombre or "").strip().upper()
    if not clean:
        return False, "El nombre del cargo no puede estar vacío"
    try:
        existing = await cargos_collection.find_one({"nombre": clean})
        if not existing:
            await cargos_collection.insert_one({"nombre": clean})
        return True, None
    except Exception as e:
        print(f"MongoDB warning in add_cargo_record: {e}")
        return True, None

async def delete_cargo_record(nombre: str):
    clean = (nombre or "").strip().upper()
    try:
        await cargos_collection.delete_one({"nombre": clean})
        return True
    except Exception as e:
        print(f"MongoDB warning in delete_cargo_record: {e}")
        return False

async def delete_user_arc(username: str, year: Optional[str] = None):
    clean_name = unquote(str(username or "")).strip().lower()
    try:
        if year:
            clean_year = str(year).strip()
            await users_collection.update_one(
                {"username": {"$regex": f"^{re.escape(clean_name)}$", "$options": "i"}},
                {"$unset": {f"arc_files.{clean_year}": ""}}
            )
        else:
            await users_collection.update_one(
                {"username": {"$regex": f"^{re.escape(clean_name)}$", "$options": "i"}},
                {"$unset": {"arc_file": "", "arc_files": ""}}
            )
    except Exception as e:
        print(f"MongoDB warning in delete_user_arc: {e}")
    for idx, u in enumerate(memory_users):
        if u["username"].lower() == clean_name:
            if year:
                clean_year = str(year).strip()
                if "arc_files" in memory_users[idx] and isinstance(memory_users[idx]["arc_files"], dict):
                    memory_users[idx]["arc_files"].pop(clean_year, None)
                if memory_users[idx].get("arc_file", {}).get("year") == clean_year:
                    memory_users[idx].pop("arc_file", None)
            else:
                memory_users[idx].pop("arc_file", None)
                memory_users[idx].pop("arc_files", None)
            return True
    return True

