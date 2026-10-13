import os
import sys
import urllib.parse

# Agregar la carpeta backend al sys.path
backend_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from main import app as fastapi_app

class VercelPathRewriteMiddleware:
    """
    Middleware ASGI que restaura la ruta original solicitada en Vercel Serverless.
    Cuando Vercel reescribe /api/(.*) a /api/index.py?__p=/api/$1,
    este middleware extrae la ruta original y la asigna a scope['path'] y scope['raw_path'],
    permitiendo que FastAPI enrute correctamente todos los métodos HTTP (GET, POST, PUT, DELETE, OPTIONS).
    """
    def __init__(self, inner_app):
        self.inner_app = inner_app

    async def __call__(self, scope, receive, send):
        if scope.get("type") == "http":
            query_string = scope.get("query_string", b"")
            path = scope.get("path", "")
            
            # 1. Si viene el parámetro __p en query_string (inyectado por vercel.json)
            if b"__p=" in query_string:
                parsed_qs = urllib.parse.parse_qsl(query_string.decode("utf-8", errors="ignore"))
                new_path = None
                remaining_qs = []
                for k, v in parsed_qs:
                    if k == "__p":
                        new_path = v
                    else:
                        remaining_qs.append((k, v))
                if new_path:
                    scope["path"] = new_path
                    scope["raw_path"] = new_path.encode("utf-8")
                    cleaned_qs = urllib.parse.urlencode(remaining_qs).encode("utf-8")
                    scope["query_string"] = cleaned_qs

            # 2. Si el path sigue siendo index.py o /api/index.py, intentar x-matched-path o x-forwarded-uri
            elif path.endswith("index.py") or path in ["/api", "/api/"]:
                headers = dict(scope.get("headers", []))
                for header_key in [b"x-matched-path", b"x-forwarded-uri"]:
                    matched = headers.get(header_key)
                    if matched:
                        m_str = matched.decode("utf-8", errors="ignore").split("?")[0]
                        if m_str and not m_str.endswith(".py"):
                            scope["path"] = m_str
                            scope["raw_path"] = m_str.encode("utf-8")
                            break

        await self.inner_app(scope, receive, send)

app = VercelPathRewriteMiddleware(fastapi_app)
