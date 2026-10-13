from motor.motor_asyncio import AsyncIOMotorClient
import os

MONGO_URI = os.getenv("MONGO_URI", "mongodb+srv://lorenzoavila07_db_user:Jso40aJ1Z38xkmbV@pgetweb.npkuwlb.mongodb.net/?appName=pgetweb")

client = AsyncIOMotorClient(MONGO_URI)
db = client.pget_db
users_collection = db.users

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
        "anos_servicio": "6"
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
        "anos_servicio": "2"
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
        "anos_servicio": "4"
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
        "anos_servicio": "25"
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
    try:
        user = await users_collection.find_one({"username": username})
        if user:
            return format_user_doc(user)
    except Exception as e:
        print(f"MongoDB warning in get_user_by_username: {e}")
    # Fallback memoria
    for u in memory_users:
        if u["username"].lower() == username.lower():
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
        if docs:
            return [format_user_doc(d) for d in docs]
    except Exception as e:
        print(f"MongoDB warning in get_all_users: {e}")
    return [dict(u) for u in memory_users]

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
    if "nombres" in update_fields or "apellidos" in update_fields:
        curr = await get_user_by_username(username)
        curr_nom = update_fields.get("nombres") or (curr.get("nombres") if curr else "")
        curr_ape = update_fields.get("apellidos") or (curr.get("apellidos") if curr else "")
        update_fields["nombre"] = f"{curr_nom} {curr_ape}".strip()
    elif "nombre" in update_fields and ("nombres" not in update_fields or "apellidos" not in update_fields):
        nom, ape = split_nombre_apellidos(update_fields["nombre"])
        update_fields["nombres"] = nom
        update_fields["apellidos"] = ape

    try:
        res = await users_collection.update_one(
            {"username": username},
            {"$set": update_fields}
        )
        if res.matched_count > 0:
            return await get_user_by_username(username)
    except Exception as e:
        print(f"MongoDB warning in update_user_record: {e}")
    
    # Fallback memoria
    for idx, u in enumerate(memory_users):
        if u["username"].lower() == username.lower():
            memory_users[idx].update(update_fields)
            return dict(memory_users[idx])
    return None

async def delete_user_record(username: str):
    try:
        res = await users_collection.delete_one({"username": username})
        if res.deleted_count > 0:
            return True
    except Exception as e:
        print(f"MongoDB warning in delete_user_record: {e}")
    
    # Fallback memoria
    initial_len = len(memory_users)
    memory_users[:] = [u for u in memory_users if u["username"].lower() != username.lower()]
    return len(memory_users) < initial_len

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
            "anos_servicio": "6"
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
            "anos_servicio": "2"
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
            "anos_servicio": "4"
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
            "anos_servicio": "25"
        }
    ]

    try:
        for acc in initial_accounts:
            await users_collection.update_one(
                {"username": acc["username"]},
                {"$set": acc, "$unset": {"rac": ""}},
                upsert=True
            )
        # Sincronizar alias antiguos si existieran
        await users_collection.update_one(
            {"username": "admin"},
            {"$set": {"role": "admin", "nombres": "ADMINISTRADOR GENERAL", "apellidos": "PGET", "nombre": "ADMINISTRADOR GENERAL PGET", "cargo": "ADMINISTRADOR DEL SISTEMA", "dependencia": "DESPACHO DEL PROCURADOR GENERAL", "password": "admin123"}, "$unset": {"rac": ""}}
        )
        await users_collection.update_one(
            {"username": "trabajador1"},
            {"$set": {"role": "trabajador", "nombres": "VICTORIA ALEJANDRA", "apellidos": "CARMONA TORRES", "nombre": "VICTORIA ALEJANDRA CARMONA TORRES", "cargo": "ADMINISTRADOR PROFESIONAL I", "dependencia": "PROCURADURÍA GENERAL DEL ESTADO TRUJILLO", "cedula": "27251622", "profesion": "Abogada", "genero": "femenino"}, "$unset": {"rac": ""}}
        )
        print("Usuarios iniciales verificados y sincronizados en MongoDB Atlas (sin rac).")
    except Exception as e:
        print(f"Error initializing users in MongoDB Atlas: {e}")
