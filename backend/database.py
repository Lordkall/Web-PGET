from typing import Optional, List, Dict, Any
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import sys
import time
from urllib.parse import unquote

# Importar nómina oficial de trabajadores y cargos institucionales
_cur_dir = os.path.dirname(os.path.abspath(__file__))
if _cur_dir not in sys.path:
    sys.path.insert(0, _cur_dir)
from initial_users import INITIAL_USERS, INITIAL_CARGOS

MONGO_URI = os.getenv("MONGO_URI", "mongodb+srv://lorenzoavila07_db_user:Jso40aJ1Z38xkmbV@pgetweb.npkuwlb.mongodb.net/?appName=pgetweb")

_client = None

def get_collections():
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(MONGO_URI, serverSelectionTimeoutMS=5000, connectTimeoutMS=5000)
    db = _client.pget_db
    return db.users, db.cargos

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

# Base de datos local en memoria (67 trabajadores + admin)
memory_users = [dict(u) for u in INITIAL_USERS]

# Catálogo predeterminado de cargos institucionales
DEFAULT_CARGOS = list(INITIAL_CARGOS)

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

def find_in_memory(clean_name: str):
    # 1. Admin aliases
    if clean_name in ["admin", "admin@pget.com", "admin@pget.gob.ve"]:
        for u in memory_users:
            if u["username"].lower() in ["admin@pget.com", "admin@pget.gob.ve"]:
                return dict(u)

    # 2. Cédula
    if clean_name.isdigit():
        for u in memory_users:
            if str(u.get("cedula", "")).strip() == clean_name:
                return dict(u)

    # 3. Exact username match
    for u in memory_users:
        if u["username"].lower() == clean_name:
            return dict(u)

    # 4. Username without domain or with @pget.com
    target_pget = f"{clean_name}@pget.com" if "@" not in clean_name else clean_name
    target_prefix = clean_name.split("@")[0]
    for u in memory_users:
        u_clean = u["username"].lower()
        if u_clean == target_pget or u_clean.split("@")[0] == target_prefix:
            return dict(u)

    return None

async def get_user_by_username(username: str):
    clean_name = unquote(str(username or "")).strip().lower()
    if not clean_name:
        return None

    clean_prefix = clean_name.split("@")[0]
    clean_full = f"{clean_name}@pget.com" if "@" not in clean_name else clean_name

    # 1. Priorizar MongoDB para obtener la información persistente más reciente
    try:
        users_col, _ = get_collections()
        query = {
            "$or": [
                {"username": {"$regex": f"^{re.escape(clean_name)}$", "$options": "i"}},
                {"username": {"$regex": f"^{re.escape(clean_full)}$", "$options": "i"}},
                {"username": {"$regex": f"^{re.escape(clean_prefix)}@pget\\.(com|gob\\.ve)$", "$options": "i"}}
            ]
        }
        if clean_name.isdigit():
            query = {"cedula": clean_name}

        user = await asyncio.wait_for(users_col.find_one(query), timeout=3.5)
        if user:
            doc = format_user_doc(user)
            # Sincronizar en memory_users si está presente
            for idx, u in enumerate(memory_users):
                if u["username"].lower() == doc["username"].lower() or u["username"].split("@")[0].lower() == clean_prefix:
                    memory_users[idx].update(doc)
                    break
            else:
                memory_users.append(doc)
            return doc
    except Exception:
        pass

    # 2. Fallback a búsqueda instantánea en memoria
    mem_user = find_in_memory(clean_name)
    if mem_user:
        return mem_user

    return None

async def authenticate_user(username: str, password: str):
    clean_user = (username or "").strip()
    effective_username = clean_user
    if clean_user == "admin":
        effective_username = "admin@pget.com"
    elif clean_user == "trabajador1":
        effective_username = "victoria@pget.gob.ve"

    user = await get_user_by_username(effective_username)
    if not user and effective_username != clean_user:
        user = await get_user_by_username(clean_user)

    if user:
        stored_pass = str(user.get("password", "")).strip()
        input_pass = str(password or "").strip()
        if stored_pass == input_pass or stored_pass.lower() == input_pass.lower():
            return user
    return None

async def get_all_users():
    """
    Retorna la lista completa de usuarios vigentes desde MongoDB Atlas asegurando
    que todas las modificaciones guardadas (teléfonos, RAC, cargos, etc.) se reflejen.
    Si MongoDB no responde, recurre al almacenamiento local en memoria.
    """
    try:
        users_col, _ = get_collections()
        cursor = users_col.find({"username": {"$nin": ["admin", "trabajador1"]}})
        mongo_users = await asyncio.wait_for(cursor.to_list(length=500), timeout=4.5)
        if mongo_users:
            formatted = [format_user_doc(u) for u in mongo_users]
            # Sincronizar en memoria
            user_map = {u["username"].lower(): u for u in formatted}
            for idx, mu in enumerate(memory_users):
                mu_name = mu["username"].lower()
                if mu_name in user_map:
                    memory_users[idx].update(user_map[mu_name])
            # Agregar los que no estén en memoria
            mem_names = {mu["username"].lower() for mu in memory_users}
            for u in formatted:
                if u["username"].lower() not in mem_names:
                    memory_users.append(u)
            return formatted
    except Exception as e:
        print(f"Información: get_all_users usando memoria ({e})")

    # Retornar usuarios vigentes (excluyendo alias deprecados)
    valid_users = [dict(u) for u in memory_users if u.get("username") not in ["admin", "trabajador1"]]
    return valid_users

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

    # Guardar en memoria inmediatamente
    memory_users.append(dict(user_data))

    # Persistir en MongoDB si está disponible
    try:
        users_col, _ = get_collections()
        await asyncio.wait_for(users_col.insert_one(dict(user_data)), timeout=5.0)
    except Exception as e:
        print(f"Error insertando en MongoDB: {e}")

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

    # Actualizar en memoria inmediatamente
    clean_prefix = clean_name.split("@")[0]
    matched_in_mem = False
    for idx, u in enumerate(memory_users):
        u_name = u["username"].lower()
        if u_name == clean_name or u_name.split("@")[0] == clean_name or u_name.split("@")[0] == clean_prefix:
            if unset_fields:
                for uf in unset_fields:
                    memory_users[idx].pop(uf, None)
            if update_fields:
                memory_users[idx].update(update_fields)
            matched_in_mem = True
            break
    if not matched_in_mem and update_fields:
        new_record = dict(update_fields)
        if "username" not in new_record:
            new_record["username"] = clean_name
        memory_users.append(new_record)

    # Persistir en MongoDB si está disponible
    try:
        users_col, _ = get_collections()
        update_doc = {}
        if update_fields:
            update_doc["$set"] = update_fields
        if unset_fields:
            update_doc["$unset"] = unset_fields
        if update_doc:
            clean_full = f"{clean_name}@pget.com" if "@" not in clean_name else clean_name
            query = {
                "$or": [
                    {"username": {"$regex": f"^{re.escape(clean_name)}$", "$options": "i"}},
                    {"username": {"$regex": f"^{re.escape(clean_full)}$", "$options": "i"}},
                    {"username": {"$regex": f"^{re.escape(clean_prefix)}@pget\\.(com|gob\\.ve)$", "$options": "i"}}
                ]
            }
            res = await asyncio.wait_for(users_col.update_one(query, update_doc), timeout=5.0)
            if res.matched_count == 0:
                full_doc = dict(update_fields)
                full_doc["username"] = clean_full
                await asyncio.wait_for(users_col.update_one({"username": clean_full}, {"$set": full_doc}, upsert=True), timeout=5.0)
    except Exception as e:
        print(f"Error persistiendo actualización en MongoDB: {e}")

    return await get_user_by_username(new_clean_name)

async def delete_user_record(username: str):
    clean_name = unquote(str(username or "")).strip().lower()
    if not clean_name:
        return False

    clean_prefix = clean_name.split("@")[0]
    initial_len = len(memory_users)
    memory_users[:] = [u for u in memory_users if u["username"].lower() != clean_name and u["username"].split("@")[0].lower() != clean_prefix]
    deleted = len(memory_users) < initial_len

    try:
        users_col, _ = get_collections()
        clean_full = f"{clean_name}@pget.com" if "@" not in clean_name else clean_name
        query = {
            "$or": [
                {"username": {"$regex": f"^{re.escape(clean_name)}$", "$options": "i"}},
                {"username": {"$regex": f"^{re.escape(clean_full)}$", "$options": "i"}},
                {"username": {"$regex": f"^{re.escape(clean_prefix)}@pget\\.(com|gob\\.ve)$", "$options": "i"}}
            ]
        }
        res = await asyncio.wait_for(users_col.delete_one(query), timeout=5.0)
        if res.deleted_count > 0:
            deleted = True
    except Exception as e:
        print(f"Error eliminando de MongoDB: {e}")

    return deleted

async def create_initial_users():
    """
    Inicializa y sincroniza en MongoDB Atlas todas las cuentas oficiales de la Procuraduría
    extraídas de la nómina en Excel, asegurando que admin@pget.com y cada trabajador existan
    y cargando cualquier edición previa en el cache en memoria.
    """
    initial_accounts = INITIAL_USERS

    try:
        users_col, cargos_col = get_collections()
        # Eliminar alias redundantes antiguos
        try:
            await asyncio.wait_for(users_col.delete_many({"username": {"$in": ["admin", "trabajador1"]}}), timeout=3.0)
        except Exception:
            pass

        # 1. Sincronizar usuarios faltantes en MongoDB en una sola verificación eficiente
        existing_docs = await asyncio.wait_for(users_col.find({}, {"username": 1}).to_list(length=500), timeout=4.0)
        existing_usernames = {d.get("username", "").strip().lower() for d in existing_docs if "username" in d}

        to_insert = [dict(acc) for acc in initial_accounts if acc.get("username", "").strip().lower() not in existing_usernames]
        if to_insert:
            await asyncio.wait_for(users_col.insert_many(to_insert), timeout=5.0)

        # 2. Cargar la nómina más actualizada desde MongoDB a memory_users
        all_docs = await asyncio.wait_for(users_col.find({"username": {"$nin": ["admin", "trabajador1"]}}).to_list(length=500), timeout=5.0)
        if all_docs:
            formatted = [format_user_doc(d) for d in all_docs]
            user_map = {u["username"].lower(): u for u in formatted}
            for idx, mu in enumerate(memory_users):
                mu_name = mu["username"].lower()
                if mu_name in user_map:
                    memory_users[idx].update(user_map[mu_name])
            mem_names = {mu["username"].lower() for mu in memory_users}
            for u in formatted:
                if u["username"].lower() not in mem_names:
                    memory_users.append(u)

        # 3. Sincronizar catálogo de cargos institucionales
        existing_cargos = await asyncio.wait_for(cargos_col.find({}, {"nombre": 1}).to_list(length=500), timeout=3.0)
        existing_cargo_names = {c.get("nombre", "").strip().upper() for c in existing_cargos if "nombre" in c}
        cargos_to_insert = [{"nombre": c.strip().upper()} for c in INITIAL_CARGOS if c.strip().upper() not in existing_cargo_names]
        if cargos_to_insert:
            await asyncio.wait_for(cargos_col.insert_many(cargos_to_insert), timeout=4.0)

        all_c_docs = await asyncio.wait_for(cargos_col.find({}).to_list(length=500), timeout=3.0)
        if all_c_docs:
            DEFAULT_CARGOS[:] = sorted(list({d["nombre"].strip().upper() for d in all_c_docs if d.get("nombre")}))

        print(f"Base de datos sincronizada: {len(initial_accounts)} cuentas oficiales y cargos PGET.")
    except Exception as e:
        print(f"Información: almacenamiento local activo con {len(memory_users)} usuarios listos. MongoDB Atlas en espera ({e}).")

async def get_all_cargos():
    try:
        _, cargos_col = get_collections()
        c_docs = await asyncio.wait_for(cargos_col.find({}).to_list(length=500), timeout=3.0)
        if c_docs:
            c_names = sorted(list({d["nombre"].strip().upper() for d in c_docs if d.get("nombre")}))
            DEFAULT_CARGOS[:] = c_names
            return c_names
    except Exception:
        pass
    return sorted(list(set(DEFAULT_CARGOS)))

async def add_cargo_record(nombre: str):
    clean = (nombre or "").strip().upper()
    if not clean:
        return False, "El nombre del cargo no puede estar vacío"
    if clean not in DEFAULT_CARGOS:
        DEFAULT_CARGOS.append(clean)
    try:
        _, cargos_col = get_collections()
        await asyncio.wait_for(cargos_col.insert_one({"nombre": clean}), timeout=3.0)
    except Exception:
        pass
    return True, None

async def delete_cargo_record(nombre: str):
    clean = (nombre or "").strip().upper()
    if clean in DEFAULT_CARGOS:
        DEFAULT_CARGOS.remove(clean)
    try:
        _, cargos_col = get_collections()
        await asyncio.wait_for(cargos_col.delete_one({"nombre": clean}), timeout=3.0)
    except Exception:
        pass


async def delete_user_arc(username: str, year: Optional[str] = None):
    clean_name = unquote(str(username or "")).strip().lower()
    for idx, u in enumerate(memory_users):
        if u["username"].lower() == clean_name or u["username"].split("@")[0].lower() == clean_name:
            if year:
                if "arc_files" in memory_users[idx] and isinstance(memory_users[idx]["arc_files"], dict):
                    memory_users[idx]["arc_files"].pop(str(year).strip(), None)
            else:
                memory_users[idx].pop("arc_file", None)
                memory_users[idx].pop("arc_files", None)
            break
    try:
        users_col, _ = get_collections()
        if year:
            clean_year = str(year).strip()
            await asyncio.wait_for(users_col.update_one(
                {"username": {"$regex": f"^{re.escape(clean_name)}$", "$options": "i"}},
                {"$unset": {f"arc_files.{clean_year}": ""}}
            ), timeout=5.0)
        else:
            await asyncio.wait_for(users_col.update_one(
                {"username": {"$regex": f"^{re.escape(clean_name)}$", "$options": "i"}},
                {"$unset": {"arc_file": "", "arc_files": ""}}
            ), timeout=5.0)
    except Exception:
        pass
    return True
