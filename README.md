# Plateforme Jumeau Numérique (Digital Twin) Intelligent

Bienvenue sur le dépôt de la plateforme **Digital Twin Intelligent**, une solution complète et modulaire permettant de modéliser, visualiser et interagir avec des environnements industriels (usines, entrepôts, aéroports, etc.) en temps réel. Grâce à l'intégration poussée d'agents d'Intelligence Artificielle, cette plateforme ne se contente pas d'afficher des données : elle les comprend, les analyse, et propose des recommandations proactives.

## 🌟 Fonctionnalités Principales

- **Modélisation 3D Dynamique** : Visualisation spatiale des jumeaux numériques (machines, zones de stockage, terminaux) via un rendu Three.js performant.
- **Connexion de Données en Temps Réel** : Intégration fluide avec des sources de télémétrie diverses (Bases de données SQL/NoSQL, flux en temps réel).
- **Assistant IA Conversationnel (NLQ)** : Interrogation des données du jumeau en langage naturel (ex: "Quelle est la tendance de la température sur la presse hydraulique ?").
- **Génération Automatique de Rapports** : Analyse de la fiabilité et détection des anomalies par un agent IA spécialisé (Reliability Engineer).
- **Auto-Configuration Intelligente** : Propositions de KPIs, de seuils d'alerte et de configurations spatiales 3D générées par l'IA en fonction du domaine sélectionné.
- **Support Multi-Domaines** : Préréglé pour fonctionner avec des contextes variés (`Factory`, `Warehouse`, `Airport`).
- **Partage et Live View** : Possibilité de partager un jumeau numérique via un lien sécurisé permettant aux collaborateurs d'interagir avec les rapports et le chat.

---

## 🏛️ Architecture Globale

Le projet suit une architecture moderne, séparant clairement la présentation visuelle du traitement de la donnée et de l'orchestration de l'IA.

*   **Frontend (`/`)** : Une Single Page Application développée en **React** et **Vite**, utilisant **Three.js / React Three Fiber** pour le rendu 3D. Le frontend intègre un assistant de configuration (Wizard) étape par étape (Connexion, Typage, KPIs, 3D Layout) et un tableau de bord en temps réel.
*   **Backend (`/digital-twin-backend`)** : Une API robuste en **Python (FastAPI)** qui gère l'état des jumeaux, orchestre les flux de télémétrie asynchrones, expose les WebSockets pour le temps réel, et héberge les agents LLM basés sur **LangChain/LangGraph**.
*   **Base de Données** : Utilisation de **PostgreSQL** (via SQLAlchemy) pour la persistance des configurations, de l'état des jumeaux, et de l'historique des requêtes IA.

---

## 🤖 Les Agents Intelligents (AI)

La force de cette plateforme réside dans son écosystème d'agents IA hautement spécialisés qui collaborent pour donner vie au jumeau numérique. Tous les agents sont connectés au moteur Groq LLM pour une latence minimale.

1.  **KPI Agent (`kpi_agent.py`)** : Intervient lors de la configuration du jumeau. Il analyse le type d'équipement (composants) et le domaine d'application pour proposer les meilleurs indicateurs de performance (KPIs) à suivre, avec des seuils d'avertissement et critiques adaptés à la réalité industrielle.
2.  **Layout Agent (`layout_agent.py`)** : Génère intelligemment les coordonnées spatiales (X, Y, Z) des composants dans la scène 3D, garantissant une disposition logique et esthétique selon le type d'environnement (ex: disposition en chaîne pour une usine, en rayons pour un entrepôt).
3.  **NLQ Agent (Chat) (`nlq_agent.py`)** : Un agent conversationnel orchestré par LangGraph. Il reçoit des outils (Tool Calling) lui permettant de requêter directement les statistiques temporelles des KPIs, de comparer les machines, et de détecter les anomalies. Il traduit les requêtes de l'utilisateur ("Où est le goulot d'étranglement ?") en appels SQL/Python sécurisés.
4.  **Chart Agent (`chart_agent.py`)** : Invoqué par le NLQ Agent, il est spécialisé en dataviz. Il décide du meilleur type de graphique (Line, Bar, Area) et le configure dynamiquement en fonction de la réponse textuelle de l'agent principal.
5.  **Report Agent (`report_agent.py`)** : Agit comme un Ingénieur de Fiabilité. Il prend une "photo" de l'état actuel de tous les KPIs, utilise ses outils d'analyse temporelle pour comprendre les tendances des alertes critiques, et rédige un rapport exécutif avec des recommandations de maintenance prédictive.

---

## 🔌 Les Connecteurs de Données

Le backend abstrait la récupération de la télémétrie grâce à un système de connecteurs scalables (`BaseTelemetryConnector`). Les connecteurs supportés incluent :

*   **PostgresConnector** : Polling asynchrone sur une base de données PostgreSQL relationnelle (souvent utilisée pour simuler ou stocker les données d'usine).
*   **MongoDBConnector** : Lecture de documents NoSQL.
*   **CassandraConnector** : Connexion à des bases de données orientées colonnes optimisées pour les séries temporelles.
*   **DatabricksConnector** : Intégration analytique pour des lacs de données massifs.

*Note : Lors du démarrage, l'application génère automatiquement des données factices et réalistes pour le domaine sélectionné si aucune source externe réelle n'est connectée.*

---

## 🔒 Sécurité et Isolation (Multi-Tenancy)

La sécurité a été placée au cœur de l'architecture pour permettre un déploiement SaaS d'entreprise sécurisé.

*   **Multi-Tenancy Stricte (Row-Level Security)** : Chaque configuration, ressource, et historique de requêtes est lié à un `user_id` unique (UUID) et un `twin_id`. Toutes les requêtes vers la base de données effectuent un filtrage rigoureux pour garantir l'imperméabilité absolue entre les tenants (utilisateurs).
*   **Protection contre le SSRF / LFI** : Les URL de bases de données et les paramètres fournis par l'utilisateur sont scannés, validés et assainis. L'accès aux adresses IP locales, de loopback (`127.0.0.1`, `localhost`) ou aux domaines internes non autorisés est strictement bloqué côté serveur.
*   **Mitigation des Dénis de Service (DoS)** : 
    *   Les connexions asynchrones aux bases de données externes comportent des **Timeouts** stricts (`connect_timeout=3`) afin d'éviter l'épuisement des threads et du ThreadPool.
*   **Sécurité de l'Éxécution de Code (IA)** : Contrairement aux systèmes vulnérables faisant appel à `eval()` ou à l'exécution de code Python arbitraire pour analyser les données (Pandas), l'agent NLQ utilise uniquement un ensemble d'outils (Tools) limités, prédéfinis et validés (min, max, moyennes, tendances), garantissant zéro risque d'Injection de Code.
*   **Prévention des Hallucinations LLM** : Les prompts des agents sont rigoureusement construits pour restreindre l'IA aux données réelles de l'utilisateur, en l'empêchant d'inventer des KPIs (Prompt Hardening).

---

## 🏢 Domaines Supportés

La plateforme adapte son comportement, sa 3D, et ses calculs analytiques selon le profil choisi :

1.  **Factory (Usine 4.0)** : Machines CNC, Presses Hydrauliques, Lignes d'Assemblage. KPIs : OEE, Taux de défauts, Énergie, Vibrations.
2.  **Warehouse (Entrepôt Intelligent)** : Convoyeurs, Racks de stockage, Quais d'expédition. KPIs : Efficacité de préparation, Taux d'utilisation, Batterie des chariots.
3.  **Airport (Aéroport Connecté)** : Terminaux, Portes d'embarquement, Pistes. KPIs : Flux passagers, Temps d'attente, Efficacité du tri bagages, Retards.

---

## 🚀 Installation et Lancement

### Prérequis
- Node.js (v16+)
- Python (3.10+)
- Une clé API Groq (Optionnelle, mais recommandée pour activer l'IA)

### 1. Démarrer le Backend
```bash
cd digital-twin-backend
python -m venv venv
source venv/Scripts/activate  # Sur Windows
pip install -r requirements.txt

# Configurer l'environnement
cp .env.example .env
# Remplir la variable GROQ_API_KEY dans le fichier .env

# Lancer le serveur
python main.py
```
Le backend sera disponible sur `http://localhost:8000`.

### 2. Démarrer le Frontend
Ouvrez un nouveau terminal à la racine du projet :
```bash
npm install
npm run dev
```
Le frontend sera accessible sur `http://localhost:5173`. L'application est alors prête à être utilisée !
