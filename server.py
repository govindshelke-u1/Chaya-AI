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
                self._send_json(200, resp_data)
                return

            if action == 'market':
                self._handle_market(query)
                return

        super().do_GET()

    def _send_json(self, status, data):
        payload = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    # -------------------------------------------------------------
    # MARKET — mirrors api/index.js handleMarket (data.gov.in Agmarknet)
    # -------------------------------------------------------------
    def _handle_market(self, query):
        api_key = os.environ.get('MARKET_API_KEY', '')
        resource_id = os.environ.get('MARKET_RESOURCE_ID', '9ef84268-d588-465a-a308-a864a43d0070')
        district = query.get('district', ['Nanded'])[0]
        state = query.get('state', ['Maharashtra'])[0]

        if not api_key:
            self._send_json(200, {'source': 'not_configured', 'rates': []})
            return

        try:
            url = (
                f"https://api.data.gov.in/resource/{resource_id}"
                f"?api-key={urllib.parse.quote(api_key)}&format=json&limit=50"
                f"&filters[state]={urllib.parse.quote(state)}"
                f"&filters[district]={urllib.parse.quote(district)}"
            )
            with urllib.request.urlopen(url, timeout=15) as resp:
                data = json.loads(resp.read().decode('utf-8'))

            records = data.get('records') or []
            if not records:
                raise ValueError('empty_records')

            rates = [{
                'commodity': r.get('commodity'),
                'market': r.get('market'),
                'modal_price': float(r.get('modal_price', 0) or 0),
                'max_price': float(r.get('max_price', 0) or 0),
                'min_price': float(r.get('min_price', 0) or 0),
                'date': r.get('arrival_date')
            } for r in records]

            self._send_json(200, {'source': 'live', 'rates': rates})
        except Exception as e:
            print(f"Market proxy error: {e}")
            self._send_json(200, {'source': 'error', 'rates': []})

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path.startswith('/api/index') or parsed.path == '/api':
            query = urllib.parse.parse_qs(parsed.query)
            action = query.get('action', [''])[0]

            if action == 'tts':
                self._handle_tts()
                return

            if action == 'gemini':
                self._handle_gemini()
                return

        self.send_response(404)
        self.end_headers()

    # -------------------------------------------------------------
    # TTS — tries eleven_v3 first (proper Marathi + Hindi support),
    # falls back to eleven_multilingual_v2 (Hindi only, best-effort
    # Marathi) if v3 isn't available on this account/plan.
    # -------------------------------------------------------------
    def _handle_tts(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else '{}'

        try:
            data = json.loads(body)
            text = data.get('text', '')
            clean_text = ' '.join(text.replace('*', '').replace('#', '').split())[:2000]

            api_key = os.environ.get('ELEVENLABS_API_KEY', DEFAULT_ELEVENLABS_KEY)
            voice_id = os.environ.get('ELEVENLABS_VOICE_ID', DEFAULT_VOICE_ID)

            def call_elevenlabs(model_id):
                req = urllib.request.Request(
                    f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
                    data=json.dumps({
                        'text': clean_text,
                        'model_id': model_id,
                        'voice_settings': {
                            'stability': 0.65,
                            'similarity_boost': 0.8,
                            'style': 0.25,
                            'use_speaker_boost': True
                        }
                    }).encode('utf-8'),
                    headers={'Content-Type': 'application/json', 'xi-api-key': api_key}
                )
                return urllib.request.urlopen(req, timeout=25)

            try:
                response = call_elevenlabs('eleven_v3')
                used_model = 'eleven_v3'
            except urllib.error.HTTPError as e:
                if e.code in (400, 401, 403):
                    response = call_elevenlabs('eleven_multilingual_v2')
                    used_model = 'eleven_multilingual_v2'
                else:
                    raise

            audio_data = response.read()
            self.send_response(200)
            self.send_header('Content-Type', 'audio/mpeg')
            self.send_header('Content-Length', str(len(audio_data)))
            self.send_header('X-Chaya-TTS-Model', used_model)
            self.end_headers()
            self.wfile.write(audio_data)
        except urllib.error.HTTPError as e:
            err_body = e.read().decode('utf-8', errors='ignore')
            print(f"ElevenLabs TTS HTTP Error ({e.code}): {err_body}")
            self._send_json(502, {'error': 'tts_failed', 'status': e.code, 'detail': err_body})
        except Exception as e:
            print(f"TTS Error: {e}")
            self._send_json(500, {'error': 'tts_failed', 'detail': str(e)})

    # -------------------------------------------------------------
    # GEMINI — mirrors api/index.js handleGemini (Google Gemini proxy)
    # -------------------------------------------------------------
    def _handle_gemini(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else '{}'

        api_key = os.environ.get('GEMINI_API_KEY', '')
        if not api_key:
            self._send_json(200, {'error': 'not_configured'})
            return

        try:
            data = json.loads(body)
            system_prompt = data.get('systemPrompt', '')
            grounded_context = data.get('groundedContext', '')
            user_question = data.get('userQuestion', '')

            if not grounded_context:
                self._send_json(400, {'error': 'missing_context'})
                return

            prompt_text = (
                f"{system_prompt}\n\nडेटा:\n{grounded_context}\n\n"
                f"शेतकऱ्याचा प्रश्न: {user_question}\n\nथेट संक्षिप्त मराठी सल्ला:"
            )

            endpoint = (
                "https://generativelanguage.googleapis.com/v1beta/models/"
                f"gemini-1.5-flash:generateContent?key={urllib.parse.quote(api_key)}"
            )
            payload = {
                'contents': [{'role': 'user', 'parts': [{'text': prompt_text}]}],
                'generationConfig': {'temperature': 0.3, 'maxOutputTokens': 800}
            }
            req = urllib.request.Request(
                endpoint,
                data=json.dumps(payload).encode('utf-8'),
                headers={'Content-Type': 'application/json'}
            )
            with urllib.request.urlopen(req, timeout=25) as resp:
                result = json.loads(resp.read().decode('utf-8'))

            text = (
                result.get('candidates', [{}])[0]
                .get('content', {})
                .get('parts', [{}])[0]
                .get('text')
            )
            if not text:
                raise ValueError('empty_response')

            self._send_json(200, {'text': text})
        except urllib.error.HTTPError as e:
            err_body = e.read().decode('utf-8', errors='ignore')
            print(f"Gemini proxy HTTP error ({e.code}): {err_body}")
            self._send_json(200, {'error': 'gemini_failed'})
        except Exception as e:
            print(f"Gemini proxy error: {e}")
            self._send_json(200, {'error': 'gemini_failed'})

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
