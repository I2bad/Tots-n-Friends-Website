# Local preview server: python3 dev.py  ->  http://127.0.0.1:4321
# Knows the same clean links as the live site (see vercel.json).
import http.server, os
ROOT = os.path.dirname(os.path.abspath(__file__))
ROUTES = {"/contact": "/contact.html", "/philosophy": "/parents.html", "/timeline": "/story.html", "/progress": "/progress.html"}

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def translate_path(self, path):
        p = path.split("?")[0].split("#")[0].rstrip("/") or "/"
        return super().translate_path(ROUTES.get(p, path))
    def send_error(self, code, *a, **k):
        if code == 404 and os.path.exists(os.path.join(ROOT, "404.html")):
            body = open(os.path.join(ROOT, "404.html"), "rb").read()
            self.send_response(404); self.send_header("Content-Type", "text/html"); self.send_header("Content-Length", str(len(body))); self.end_headers()
            if self.command != "HEAD": self.wfile.write(body)
        else: super().send_error(code, *a, **k)

http.server.ThreadingHTTPServer(("127.0.0.1", 4321), H).serve_forever()
