<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# J.A.R.V.I.S. Assistant Vocal IA (Stack Locale)

Ceci est une application de chat vocal mains libres, avec une interface inspirée de J.A.R.V.I.S., conçue pour fonctionner avec une stack d'IA 100% locale. Elle utilise Porcupine pour la détection du mot-clé ("wake word") et orchestre les services locaux Whisper, Ollama et Piper pour une expérience entièrement hors ligne.

## Fonctionnalités

-   **Détection de Mot-Clé**: Activation mains libres avec le mot "Tornade" via PicoVoice Porcupine.
-   **STT Local**: Reconnaissance vocale (Speech-to-Text) assurée par une instance locale de Whisper.
-   **LLM Local**: IA conversationnelle et appel d'outils ("tool-calling") gérés par un modèle local d'Ollama.
-   **TTS Local**: Réponses vocales générées par une instance locale de Piper.
-   **Contrôle MCPO**: Peut interagir avec un serveur MCPO d'OpenWebUI pour gérer d'autres services.

## Prérequis

-   Node.js et npm
-   Python 3.8+ et pip
-   [Ollama](https://ollama.com/) installé et en cours d'exécution.
-   (Optionnel) Un serveur MCPO d'OpenWebUI.

---

## 1. Configuration de l'Application Frontend

### A. Cloner le Dépôt et Installer les Dépendances

```bash
git clone <repository_url>
cd jarvis-ai-voice-assistant
npm install
```

### B. Configurer les Variables d'Environnement

Créez un fichier nommé `.env` à la racine de votre projet. Vous aurez besoin d'une clé d'accès PicoVoice pour la détection du mot-clé.

-   Créez un compte gratuit sur la [console PicoVoice](https://console.picovoice.ai/).
-   Copiez votre `Access Key`.

Ajoutez cette clé à votre fichier `.env` :
```env
PICOVOICE_ACCESS_KEY=VOTRE_CLÉ_D'ACCÈS_PICOVOICE
```

### C. Télécharger les Modèles Porcupine

Cette application est configurée pour utiliser le mot-clé "Tornade".

-   Téléchargez le fichier de modèle de base de Porcupine (`porcupine_params.pv`) et le fichier du mot-clé "Tornade" (`tornade_wasm.ppn`).
    -   Le fichier `porcupine_params.pv` se trouve généralement dans le dossier `resources/params` du [dépôt GitHub de Porcupine](https://github.com/Picovoice/porcupine).
    -   Le fichier `tornade_wasm.ppn` se trouve dans `resources/keyword_files/wasm`.
-   Créez un dossier `public/porcupine` dans votre projet.
-   Placez-y les fichiers téléchargés :
    ```
    public/
    └── porcupine/
        ├── porcupine_params.pv
        └── tornade_wasm.ppn
    ```

---

## 2. Mise en Place des Serveurs Backend

Pour que l'application fonctionne, vous devez lancer trois serveurs Python : un pour la transcription (Whisper), un pour la synthèse vocale (Piper), et un pour simuler le contrôle des serveurs (MCPO).

### A. Serveur de Transcription (Whisper)

Ce serveur reçoit un fichier audio, le transcrit avec Whisper, et renvoie le texte.

**Prérequis :**
```bash
pip install "openai-whisper" "fastapi" "uvicorn[standard]" "python-multipart"
```

**Créez un fichier `whisper_server.py`:**
```python
import os
import whisper
import uvicorn
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
import tempfile

app = FastAPI()

try:
    print("Chargement du modèle Whisper...")
    model = whisper.load_model("base.en") # 'base.en' est un bon compromis vitesse/précision
    print("Modèle Whisper chargé avec succès.")
except Exception as e:
    print(f"Erreur lors du chargement du modèle Whisper : {e}")
    model = None

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    if not model:
        raise HTTPException(status_code=500, detail="Le modèle Whisper n'est pas disponible.")
    
    if not file.content_type.startswith("audio/"):
         raise HTTPException(status_code=400, detail="Type de fichier invalide. Un fichier audio est attendu.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        print(f"Transcription du fichier audio : {file.filename}")
        result = model.transcribe(tmp_path, fp16=False)
        print(f"Texte transcrit : '{result['text']}'")
        return JSONResponse(content={"text": result["text"]})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la transcription : {e}")
    finally:
        os.remove(tmp_path)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### B. Serveur de Synthèse Vocale (Piper TTS)

Ce serveur reçoit du texte et génère un fichier audio `.wav` en utilisant Piper.

**Prérequis :**
1.  Téléchargez l'exécutable de [Piper](https://github.com/rhasspy/piper/releases).
2.  Téléchargez un modèle vocal (fichier `.onnx` et `.json`) depuis la même page.
3.  Placez l'exécutable dans votre PATH ou spécifiez son chemin dans le script. Placez le modèle (`.onnx` et `.json`) dans le même dossier que le script.
```bash
pip install "fastapi" "uvicorn[standard]" "pydantic"
```

**Créez un fichier `piper_server.py`:**
```python
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
import subprocess
import shutil

# --- Configuration ---
PIPER_EXECUTABLE = "piper" # ou le chemin complet vers l'exécutable
MODEL_PATH = "./en_US-lessac-medium.onnx" # Chemin vers votre modèle vocal
# --- Fin de la configuration ---

app = FastAPI()

class TTSRequest(BaseModel):
    text: str

@app.on_event("startup")
async def startup_event():
    if not shutil.which(PIPER_EXECUTABLE):
        raise RuntimeError(f"L'exécutable '{PIPER_EXECUTABLE}' est introuvable. Assurez-vous que Piper est installé et dans votre PATH.")

@app.post("/tts")
async def text_to_speech(request: TTSRequest):
    text = request.text
    if not text:
        raise HTTPException(status_code=400, detail="Le texte ne peut pas être vide.")

    try:
        command = [PIPER_EXECUTABLE, "--model", MODEL_PATH, "--output-file", "-"]
        process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        audio_bytes, stderr = process.communicate(input=text.encode("utf-8"))

        if process.returncode != 0:
            error_message = stderr.decode("utf-8")
            raise HTTPException(status_code=500, detail=f"Erreur du serveur Piper: {error_message}")

        return Response(content=audio_bytes, media_type="audio/wav")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5000)
```

### C. Serveur de Contrôle (MCPO Mock)

Ce serveur simule l'API MCPO pour vous permettre de tester les commandes de gestion de serveurs ("list", "start", "stop").

**Prérequis :**
```bash
pip install "fastapi" "uvicorn[standard]"
```

**Créez un fichier `mcpo_server.py`:**
```python
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from typing import Dict

app = FastAPI()

# Simule une base de données en mémoire de l'état des serveurs
mock_servers_db: Dict[str, Dict] = {
    "web": {"name": "web", "status": "stopped"},
    "database": {"name": "database", "status": "stopped"},
    "cache": {"name": "cache", "status": "running"},
}

@app.get("/api/mcpo/servers")
async def list_servers():
    return JSONResponse(content=list(mock_servers_db.values()))

@app.post("/api/mcpo/servers/{server_name}/start")
async def start_server(server_name: str):
    if server_name not in mock_servers_db:
        raise HTTPException(status_code=404, detail=f"Serveur '{server_name}' non trouvé.")
    if mock_servers_db[server_name]["status"] == "running":
        return JSONResponse(content={"message": f"Le serveur '{server_name}' est déjà en cours d'exécution."})
    mock_servers_db[server_name]["status"] = "running"
    return JSONResponse(content={"message": f"Le serveur '{server_name}' a été démarré."})

@app.post("/api/mcpo/servers/{server_name}/stop")
async def stop_server(server_name: str):
    if server_name not in mock_servers_db:
        raise HTTPException(status_code=404, detail=f"Serveur '{server_name}' non trouvé.")
    if mock_servers_db[server_name]["status"] == "stopped":
        return JSONResponse(content={"message": f"Le serveur '{server_name}' est déjà arrêté."})
    mock_servers_db[server_name]["status"] = "stopped"
    return JSONResponse(content={"message": f"Le serveur '{server_name}' a été arrêté."})

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)
```

---

## 3. Mise en Route

### A. Lancer Ollama

Assurez-vous que le service Ollama est lancé. Puis, téléchargez un modèle compatible avec les outils.
```bash
ollama pull llama3
```

### B. Lancer les Serveurs Python

Ouvrez trois terminaux distincts et lancez chaque serveur.

**Terminal 1 (Whisper) :**
```bash
python whisper_server.py
```

**Terminal 2 (Piper) :**
```bash
python piper_server.py
```

**Terminal 3 (MCPO) :**
```bash
python mcpo_server.py
```

### C. Lancer l'Application J.A.R.V.I.S.

Une fois tous vos serveurs actifs, ouvrez un quatrième terminal et lancez l'application web :
```bash
npm run dev
```

L'application sera disponible à l'adresse `http://localhost:3000`. Autorisez l'accès au microphone lorsque le navigateur vous le demande.