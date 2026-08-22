"""
Chaya AI - Local Development & Production Server
Run this script to start a local web server:
    python server.py
Then open: http://localhost:8000
"""

import http.server
import socketserver
import urllib.parse
import urllib.request
import urllib.error
import json
import webbrowser
import os
import sys

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

# Default API configurations
DEFAULT_ELEVENLABS_KEY = ""  # removed hardcoded key — set ELEVENLABS_API_KEY env var instead
DEFAULT_VOICE_ID = "k2intd1ORm0YUH8etnXg"

def load_env_file(filepath):
    """Load simple KEY=VALUE pairs from a file into os.environ."""
    if os.path.exists(filepath):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        k, v = line.split('=', 1)
                        k, v = k.strip(), v.strip()
                        if k and k not in os.environ:
                            os.environ[k] = v
        except Exception as e:
            print(f"Notice: Failed to read env file {filepath}: {e}")

# Load .env and .env.local if present
load_env_file(os.path.join(DIRECTORY, '.env'))
load_env_file(os.path.join(DIRECTORY, '.env.local'))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Enable CORS for local data fetching
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, xi-api-key')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path.startswith('/api/index') or parsed.path == '/api':
            query = urllib.parse.parse_qs(parsed.query)
            action = query.get('action', ['status'])[0]

            if action == 'status':
                api_key = os.environ.get('ELEVENLABS_API_KEY', DEFAULT_ELEVENLABS_KEY)
                resp_data = {
                    'gemini': bool(os.environ.get('GEMINI_API_KEY')),
                    'market': bool(os.environ.get('MARKET_API_KEY')),
                    'tts': bool(api_key)
                }
                payload = json.dumps(resp_data).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
                return

        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path.startswith('/api/index') or parsed.path == '/api':
            query = urllib.parse.parse_qs(parsed.query)
            action = query.get('action', [''])[0]

            if action == 'tts':
                content_length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else '{}'
                
                try:
                    data = json.loads(body)
                    text = data.get('text', '')
                    clean_text = ' '.join(text.replace('*', '').replace('#', '').split())[:2000]

                    api_key = os.environ.get('ELEVENLABS_API_KEY', DEFAULT_ELEVENLABS_KEY)
                    voice_id = os.environ.get('ELEVENLABS_VOICE_ID', DEFAULT_VOICE_ID)

                    eleven_req = urllib.request.Request(
                        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
                        data=json.dumps({
                            'text': clean_text,
                            'model_id': 'eleven_multilingual_v2',
                            'voice_settings': {'stability': 0.5, 'similarity_boost': 0.75}
                        }).encode('utf-8'),
                        headers={
                            'Content-Type': 'application/json',
                            'xi-api-key': api_key
                        }
                    )

                    with urllib.request.urlopen(eleven_req, timeout=25) as response:
                        audio_data = response.read()
                        self.send_response(200)
                        self.send_header('Content-Type', 'audio/mpeg')
                        self.send_header('Content-Length', str(len(audio_data)))
                        self.end_headers()
                        self.wfile.write(audio_data)
                        return
                except urllib.error.HTTPError as e:
                    err_body = e.read().decode('utf-8', errors='ignore')
                    print(f"ElevenLabs TTS HTTP Error ({e.code}): {err_body}")
                    self.send_response(502)
                    self.send_header('Content-Type', 'application/json')
                    payload = json.dumps({'error': 'tts_failed', 'status': e.code, 'detail': err_body}).encode('utf-8')
                    self.send_header('Content-Length', str(len(payload)))
                    self.end_headers()
                    self.wfile.write(payload)
                    return
                except Exception as e:
                    print(f"TTS Error: {e}")
                    self.send_response(500)
                    self.send_header('Content-Type', 'application/json')
                    payload = json.dumps({'error': 'tts_failed', 'detail': str(e)}).encode('utf-8')
                    self.send_header('Content-Length', str(len(payload)))
                    self.end_headers()
                    self.wfile.write(payload)
                    return

        self.send_response(404)
        self.end_headers()

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
