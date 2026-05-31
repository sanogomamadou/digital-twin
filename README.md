# ⬡ Digital Twin Platform — DXC Intelligent Analytics

> **Real-Time Industrial Digital Twin** — Airport · Factory · Warehouse  
> Full-stack platform with 3D visualization, live KPI streaming, and AI analytics.

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Three.js](https://img.shields.io/badge/Three.js-0.183-black?logo=three.js)](https://threejs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![LangChain](https://img.shields.io/badge/LangChain-0.3-1C3C3C)](https://langchain.com)
[![Groq](https://img.shields.io/badge/LLM-Groq%20API-f55036)](https://groq.com)
[![SQLite](https://img.shields.io/badge/Database-SQLite-003B57?logo=sqlite)](https://sqlite.org)

---

## 🎯 What It Does

A **5-step wizard** that builds and then monitors your digital twin in real-time:

| Step | Page | What happens |
|------|------|-------------|
| 1️⃣ | **Configure** | Name your twin, pick domain (airport / factory / warehouse), set dimensions |
| 2️⃣ | **Layout** | Drag-and-drop components onto a 2D/3D grid |
| 3️⃣ | **Connections** | Define flow paths — passenger flow, material flow, goods movement |
| 4️⃣ | **KPI Setup** | Upload one CSV/Excel → assign each column to a component with thresholds |
| 5️⃣ | **Live View** | 3D scene updates in real-time + charts + AI chatbot |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Browser (React + Vite)                 │
│  Scene3D (Three.js)  │  KpiCharts (Recharts)  │ Chatbot │
│─────────────────────────────────────────────────────────│
│  Zustand Store  ←  useKpiWebSocket (auto-reconnect)     │
└─────────────────────┬───────────────────────────────────┘
                      │  WebSocket /ws/kpis
┌─────────────────────▼───────────────────────────────────┐
│                FastAPI Backend (Python)                  │
│  /source/upload → FileConnector → KPI_BUS (asyncio Q)  │
│  /ws/kpis broadcaster → streams to all WS clients      │
│  /analytics → LangChain NLQ + chart agents             │
│  /layout    → LangGraph layout-editing agent           │
│─────────────────────────────────────────────────────────│
│  SQLite (SQLAlchemy)  │  Pandas  │  Groq API           │
└─────────────────────────────────────────────────────────┘
```

---

## ✨ Features

### 3D Digital Twin
- Interactive **Three.js** scene with domain-specific 3D shapes per component type
- Animated **connection tubes** colored by status (Fluid 🟢 / Congested 🟠 / Bottleneck 🔴)
- Camera views: **Isometric**, **Top**, **Front**, **Free** (orbit)
- Click a component → instantly see its KPI charts

### Real-Time Data Pipeline
- Upload **one CSV or Excel file** containing all KPI columns
- **Column assignment UI**: map each column → component + label + unit + thresholds
- **File connector** replays data rows continuously as a live stream
- **WebSocket streaming** — backend pushes updates to all connected browsers
- Optional: **MQTT** connector for real IoT sensors, **REST** connector for external APIs

### KPI Monitoring
- Live value cards with status coloring (green / orange / red)
- Threshold **reference lines** on charts
- **Area, Line, Bar** chart type switcher
- Per-component filtering — click any component to see only its KPIs
- Alert bell showing critical KPI count

### AI Analytics (Groq API)
- **NLQ Chatbot**: ask questions like *"What is the average security wait time?"*
- **Chart agent**: generates dynamic charts from prompts
- **Layout agent**: *"Add a security zone between Gate 2 and Terminal 1"*
- Falls back gracefully if Groq API is not available

### Multi-Domain Support
| Domain | Sample Components |
|--------|-----------------|
| ✈️ Airport | Terminal, Gate, Runway, Check-In Desk, Security Zone |
| 🏭 Factory | Assembly Line, Press, CNC Machine, Quality Control, Storage |
| 📦 Warehouse | Receiving Dock, Rack, Sorting Belt, Dispatch |

---

## 🚀 Quick Start / 🇫🇷 Lancement Rapide

### Prerequisites / Prérequis
- **Python 3.11+** (Assurez-vous d'avoir ajouté Python au PATH sur Windows)
- **Node.js 20+**
- **Clé API Groq** (pour les fonctionnalités d'IA)

---

### 1. Cloner le projet (Clone)

```bash
git clone https://github.com/Hibabenkaddour/digital-twin-ui.git
cd digital-twin-ui
```

### 2. Démarrer le Backend (API Python)

Ouvrez un terminal au dossier racine du projet (là où se trouve ce fichier README), puis :

```bash
cd digital-twin-backend

# 1. Créer un environnement virtuel (Create virtual environment)
python -m venv venv

# 2. Activer l'environnement virtuel (Activate)
# Sur Windows :
.\venv\Scripts\activate
# Sur Linux / Mac :
# source venv/bin/activate

# 3. Installer les dépendances (Install packages)
pip install -r requirements.txt

# 4. Configurer les variables d'environnement (Configure)
# Sur Windows :
copy .env.example .env
# Sur Linux / Mac :
# cp .env.example .env

# 5. Lancer le serveur (Start backend)
python main.py
```
> ✅ **API prête sur** : http://localhost:8000  
> ✅ **Documentation Swagger** : http://localhost:8000/docs

---

### 3. Démarrer le Frontend (UI React)

Ouvrez un **nouveau terminal** (N'arrêtez pas le backend !) au dossier racine du projet (`digital-twin`), puis :

```bash
# 1. Installer les dépendances (Install Node modules)
npm install

# 2. Lancer l'interface utilisateur (Start Dev Server)
npm run dev
```
> ✅ **Application prête sur** : http://localhost:5173

### 4. Sample Data

Ready-to-use CSV files are in `digital-twin-backend/sample_data/`:

| File | Domain | Columns |
|---|---|---|
| `airport_data.csv` | Airport | passenger_flow · security_wait · gate_util · baggage_delay · checkin_queue · runway_movements |
| `factory_data.csv` | Factory | machine_temp · throughput · pressure · quality_rate · downtime · belt_speed |
| `warehouse_data.csv` | Warehouse | pick_rate · rack_fill · dock_util · cycle_time · conveyor · error_rate |

---

## 🗄️ Avancé : Base de Données (PostgreSQL) & Scripts de Données

Le backend utilise **SQLite par défaut** (`digital_twin.db`) pour que le projet soit facile à lancer. Cependant, le projet est prêt pour la production avec **PostgreSQL**.

### 1. Lancer PostgreSQL via Docker
Un fichier `docker-compose.yml` est fourni dans le dossier backend.
```bash
cd digital-twin-backend
docker-compose up -d
```
Cela démarrera une base de données fonctionnelle sur `localhost:5432` (utilisateur: `postgres`, mdp: `postgrespassword`).

### 2. Connecter le projet à PostgreSQL
Ouvrez le fichier `.env` du backend et ajoutez ou modifiez la ligne `DATABASE_URL` :
```env
DATABASE_URL=postgresql://postgres:postgrespassword@localhost:5432/digital_twin
```
Relancez ensuite `python main.py`.

### 3. Scripts de Génération de Données (Data Generation)
Dans le dossier `digital-twin-backend`, vous disposez de 3 scripts très utiles :

- **`generate_sample_data.py`** : Génère les gros fichiers CSV consolidés (un par domaine) pour que vous puissiez tester l'upload de fichiers via l'interface UI. Les données incluent des anomalies et des heures de pointe.
- **`generate_airport_data.py`** : Génère des KPI détaillés spécifiques uniquement à l'aéroport dans `sample_data/airport/` (un fichier CSV par composant).
- **`generate_pg_data.py`** : **Script de Streaming Temps Réel.** Exécutez `python generate_pg_data.py` dans un terminal séparé. Il va injecter en continu (toutes les 2 secondes) de nouvelles données directement dans la base PostgreSQL / SQLite, imitant des capteurs IoT réels !

---

## ⚙️ Environment Variables

Copy `digital-twin-backend/.env.example` → `.env` and configure:

```env
# LLM (Groq API)
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.3-70b-versatile


# Optional connectors
MQTT_ENABLED=false
MQTT_BROKER=localhost
MQTT_PORT=1883
REST_ENABLED=false

# App
DEFAULT_DOMAIN=airport    # airport | factory | warehouse
FRONTEND_URL=http://localhost:5173
```

---

## 🛠️ Tech Stack

### Frontend
| Layer | Technology |
|---|---|
| Framework | **React 19** + Vite 7 |
| 3D Engine | **Three.js** + @react-three/fiber + @react-three/drei |
| Charts | **Recharts** (Area, Line, Bar, Pie, Radar) |
| State | **Zustand** |
| Animations | **Framer Motion** |
| Icons | Lucide React |
| Font | Inter (fontsource) |
| Styling | Vanilla CSS — dark mode, glassmorphism |
| Real-time | Native WebSocket API |

### Backend
| Layer | Technology |
|---|---|
| Framework | **FastAPI** 0.115 + Uvicorn |
| Database | **SQLite** via SQLAlchemy 2.0 + aiosqlite |
| Data | **Pandas** 2.2 + openpyxl |
| AI/LLM | **LangChain** 0.3 + **LangGraph** 0.2 |
| LLM | **Groq API** |
| HTTP | httpx (async REST polling) |
| Validation | Pydantic 2.10 |

See [`TECH_STACK.md`](./TECH_STACK.md) for the full detailed breakdown.

---

## 📂 Project Structure

```
digital-twin-ui/           ← this repo
│
├── src/                   ← React frontend
│   ├── pages/
│   │   ├── FormStep.jsx           # Step 1: Configure
│   │   ├── GridStep.jsx           # Step 2: Layout
│   │   ├── ConnectionsStep.jsx    # Step 3: Connections
│   │   ├── KpiStep.jsx            # Step 4: Data source setup ← NEW
│   │   └── TwinView.jsx           # Step 5: Live dashboard
│   ├── components/
│   │   ├── Scene3D.jsx            # Three.js 3D scene
│   │   ├── KpiPanel.jsx           # Live KPI value cards
│   │   ├── KpiCharts.jsx          # Interactive charts
│   │   └── Chatbot.jsx            # NLQ AI chatbot
│   ├── hooks/
│   │   └── useKpiWebSocket.js     # WS hook + auto-reconnect
│   ├── store/
│   │   └── useTwinStore.js        # Zustand global state
│   └── services/
│       └── api.js                 # REST API client
│
└── digital-twin-backend/  ← FastAPI Python backend
    ├── main.py
    ├── requirements.txt
    ├── .env.example
    ├── routers/
    │   ├── layout.py              # LLM layout editing
    │   ├── kpis.py                # KPI history
    │   ├── analytics.py           # NLQ + charts
    │   ├── stream.py              # WebSocket /ws/kpis
    │   └── data_source.py         # Upload + assign
    ├── connectors/
    │   ├── file_connector.py      # Primary: CSV streaming
    │   ├── mqtt_connector.py      # IoT optional
    │   └── rest_connector.py      # REST optional
    ├── services/
    │   ├── llm_service.py         # Groq API
    │   └── data_service.py        # Pandas helpers
    ├── db/                        # SQLAlchemy + SQLite
    └── sample_data/               # Ready-to-use CSV files
```
---

## Ameliorations
-Ajouter modification de la superficie de l'espace sans avoir à retourner à l'étape 1
-Ajouter modification de la taille des composants
-Ajouter posibilité de superposition des composants, importants pour certains domaines comme l'aéroportuaire
-Ajouter possibilité CRUD et persistence d'un nouveau composant par l'utilisateur



---

## 📄 License

MIT — DXC Intelligent Analytics © 2026
