import os
import sys
import socket
import tempfile
import traceback
from pathlib import Path
from flask import Flask, request, render_template_string, jsonify
import qrcode

try:
    from scripts.planner_parser import parse_planner_image, save_planner_to_vault
except ImportError:
    from planner_parser import parse_planner_image, save_planner_to_vault

app = Flask(__name__)

# Absolute Project Root
PROJECT_ROOT = Path(__file__).resolve().parent.parent
VAULT_DIR = str(PROJECT_ROOT / "TestVault")

def get_local_ip():
    """Finds local Wi-Fi IP address for local network access."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

def generate_qr_code(url: str, output_path: str):
    """Generates a QR code image pointing to the local mobile upload URL."""
    qr = qrcode.QRCode(version=1, box_size=8, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#121316", back_color="#F5EDE0")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    img.save(output_path)

MOBILE_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LearnOS Mobile Planner Upload</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #121316;
      color: #E3E3E3;
      margin: 0;
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 90vh;
      text-align: center;
    }
    .card {
      background-color: #1E1F22;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      padding: 24px;
      width: 90%;
      max-width: 360px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    }
    h1 { font-size: 20px; color: #A8C7FA; margin-bottom: 8px; }
    p { font-size: 13px; color: #8E9196; margin-bottom: 24px; line-height: 1.4; }
    .file-label {
      background-color: #A8C7FA;
      color: #062E6F;
      padding: 16px 20px;
      border-radius: 14px;
      font-weight: 600;
      font-size: 15px;
      display: block;
      cursor: pointer;
      margin-bottom: 16px;
      box-shadow: 0 4px 12px rgba(168, 199, 250, 0.3);
    }
    input[type="file"] { display: none; }
    button[type="submit"] {
      background-color: #D0BCFF;
      color: #381E72;
      border: none;
      padding: 14px 20px;
      border-radius: 14px;
      font-weight: 600;
      font-size: 15px;
      width: 100%;
      cursor: pointer;
    }
    .status { margin-top: 16px; font-size: 13px; font-weight: 500; word-break: break-word; }
    .success { color: #4CAF50; }
    .error { color: #FF5449; }
  </style>
</head>
<body>
  <div class="card">
    <h1>📷 Snap Daily Planner</h1>
    <p>Take a photo of your handwritten or printed daily planner page to send it directly to LearnOS.</p>
    
    <form action="/upload" method="post" enctype="multipart/form-data">
      <label for="camera-input" class="file-label" id="label-text">
        📷 Take Photo / Select Image
      </label>
      <input type="file" name="planner_image" id="camera-input" accept="image/*" capture="environment" required>
      <button type="submit">Upload to LearnOS</button>
    </form>

    {% if message %}
      <div class="status {{ status }}">{{ message }}</div>
    {% endif %}
  </div>

  <script>
    const input = document.getElementById('camera-input');
    const label = document.getElementById('label-text');
    input.addEventListener('change', () => {
      if (input.files.length > 0) {
        label.innerText = "✓ Selected: " + input.files[0].name;
        label.style.backgroundColor = "#D0BCFF";
      }
    });
  </script>
</body>
</html>
"""

@app.route('/')
def index():
    return render_template_string(MOBILE_HTML)

@app.route('/upload', methods=['POST'])
def upload():
    if 'planner_image' not in request.files:
        return render_template_string(MOBILE_HTML, message="No image provided.", status="error")
    
    file = request.files['planner_image']
    if file.filename == '':
        return render_template_string(MOBILE_HTML, message="No file selected.", status="error")

    # Save permanently to vault attachments folder
    attachments_dir = os.path.join(VAULT_DIR, "Attachments", "planner_photos")
    os.makedirs(attachments_dir, exist_ok=True)
    saved_filename = f"planner_{int(time.time())}_{file.filename}"
    saved_path = os.path.join(attachments_dir, saved_filename)
    file.save(saved_path)

    print(f"\n[MOBILE UPLOAD] Received '{file.filename}' -> Saved permanently to '{saved_path}'. Processing with AI Vision...")

    try:
        parsed = parse_planner_image(saved_path)
        created_files = save_planner_to_vault(parsed, VAULT_DIR)
        msg = f"✨ Uploaded & Saved! Created {len(created_files)} tasks in LearnOS ({parsed.date})."
        print(f"[MOBILE UPLOAD SUCCESS] Created {len(created_files)} task files in '{VAULT_DIR}'.")
        return render_template_string(MOBILE_HTML, message=msg, status="success")
    except Exception as e:
        traceback.print_exc()
        error_msg = str(e)
        print(f"[MOBILE UPLOAD ERROR] {error_msg}")
        return render_template_string(MOBILE_HTML, message=f"Parsing Error: {error_msg}", status="error")

@app.route('/status')
def server_status():
    local_ip = get_local_ip()
    port = 5000
    upload_url = f"http://{local_ip}:{port}"
    return jsonify({
        "status": "running",
        "ip": local_ip,
        "port": port,
        "upload_url": upload_url
    })

def start_server(vault_directory: str = "TestVault", port: int = 5000):
    global VAULT_DIR
    if not os.path.isabs(vault_directory):
        VAULT_DIR = str(PROJECT_ROOT / vault_directory)
    else:
        VAULT_DIR = vault_directory

    local_ip = get_local_ip()
    upload_url = f"http://{local_ip}:{port}"

    # Always save QR code image to PROJECT_ROOT / sticky-widget / qr_code.png
    qr_path = PROJECT_ROOT / "sticky-widget" / "qr_code.png"
    generate_qr_code(upload_url, str(qr_path))
    print(f"📱 QR Code saved to '{qr_path}'")

    print(f"\n=======================================================")
    print(f"📱 LearnOS Mobile Ingestion Server Active!")
    print(f"📁 Target Vault Directory: '{VAULT_DIR}'")
    print(f"🔗 Connect your phone to Wi-Fi and open:")
    print(f"👉 {upload_url}\n")
    print(f"Scan ASCII QR Code below with your phone camera:")
    print(f"=======================================================")
    try:
        qr = qrcode.QRCode()
        qr.add_data(upload_url)
        qr.print_ascii(invert=True)
    except Exception as e:
        print(f"(ASCII QR render fallback: open {upload_url} in phone browser)")
    print(f"=======================================================\n")

    app.run(host="0.0.0.0", port=port, debug=False)

if __name__ == "__main__":
    target_vault = sys.argv[1] if len(sys.argv) > 1 else "TestVault"
    start_server(vault_directory=target_vault)
