#!/usr/bin/env python3
"""
Local proxy that strips unsupported fields (e.g. context_management)
before forwarding requests to the upstream API proxy.
"""

import json
import sys
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

UPSTREAM_URL = "https://api3.xhub.chat"
LISTEN_PORT = 18900

FIELDS_TO_STRIP = {"context_management"}


class ProxyHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        try:
            data = json.loads(body)
            stripped = {k: v for k, v in data.items() if k not in FIELDS_TO_STRIP}
            if set(data.keys()) - set(stripped.keys()):
                print(f"[proxy] Stripped fields: {set(data.keys()) - set(stripped.keys())}", flush=True)
            body = json.dumps(stripped).encode()
        except (json.JSONDecodeError, AttributeError):
            pass

        target_url = f"{UPSTREAM_URL}{self.path}"
        req = Request(target_url, data=body, method="POST")
        for key, val in self.headers.items():
            if key.lower() in ("host", "content-length", "transfer-encoding"):
                continue
            req.add_header(key, val)
        req.add_header("Content-Length", str(len(body)))

        try:
            with urlopen(req, timeout=300) as resp:
                resp_body = resp.read()
                self.send_response(resp.status)
                for key, val in resp.getheaders():
                    if key.lower() in ("transfer-encoding", "content-encoding", "content-length"):
                        continue
                    self.send_header(key, val)
                self.send_header("Content-Length", str(len(resp_body)))
                self.end_headers()
                self.wfile.write(resp_body)
        except HTTPError as e:
            err_body = e.read()
            self.send_response(e.code)
            for key, val in e.headers.items():
                if key.lower() in ("transfer-encoding", "content-encoding", "content-length"):
                    continue
                self.send_header(key, val)
            self.send_header("Content-Length", str(len(err_body)))
            self.end_headers()
            self.wfile.write(err_body)
        except URLError as e:
            msg = str(e).encode()
            self.send_response(502)
            self.send_header("Content-Length", str(len(msg)))
            self.end_headers()
            self.wfile.write(msg)

    def do_GET(self):
        target_url = f"{UPSTREAM_URL}{self.path}"
        req = Request(target_url, method="GET")
        for key, val in self.headers.items():
            if key.lower() in ("host", "content-length"):
                continue
            req.add_header(key, val)
        try:
            with urlopen(req, timeout=300) as resp:
                resp_body = resp.read()
                self.send_response(resp.status)
                for key, val in resp.getheaders():
                    if key.lower() in ("transfer-encoding", "content-encoding", "content-length"):
                        continue
                    self.send_header(key, val)
                self.send_header("Content-Length", str(len(resp_body)))
                self.end_headers()
                self.wfile.write(resp_body)
        except HTTPError as e:
            err_body = e.read()
            self.send_response(e.code)
            self.send_header("Content-Length", str(len(err_body)))
            self.end_headers()
            self.wfile.write(err_body)

    def log_message(self, format, *args):
        print(f"[proxy] {args[0]}", flush=True)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else LISTEN_PORT
    server = HTTPServer(("127.0.0.1", port), ProxyHandler)
    print(f"[proxy] Listening on http://127.0.0.1:{port}", flush=True)
    print(f"[proxy] Forwarding to {UPSTREAM_URL}", flush=True)
    print(f"[proxy] Stripping fields: {FIELDS_TO_STRIP}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
