"""
Chaya AI - Local Development & Production Server
Run this script to start a local web server:
    python server.py
Then open: http://localhost:8000
"""

import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Enable CORS for local data fetching
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

def run_server():
    os.chdir(DIRECTORY)
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print("=" * 60)
        print(f"🌿 छाया AI (Chaya AI Smart Agricultural System)")
        print(f"📡 Server running at: http://localhost:{PORT}")
        print(f"📁 Root directory: {DIRECTORY}")
        print("=" * 60)
        
        # Open in default browser
        try:
            webbrowser.open(f"http://localhost:{PORT}/index.html")
        except Exception:
            pass

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")
            sys.exit(0)

if __name__ == '__main__':
    run_server()
