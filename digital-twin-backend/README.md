# Backend du Digital Twin Intelligent (FastAPI & IA)

Bienvenue dans le dépôt du **Backend du Jumeau Numérique**. Ce projet est le "cerveau" de l'application, développé en Python avec **FastAPI**, chargé de la modélisation des données, de l'orchestration des connecteurs de télémétrie, et de la résolution complexe via un écosystème d'Agents d'Intelligence Artificielle.

## 🛠️ Stack Technologique

- **Framework Web** : FastAPI (Asynchrone, rapide, et auto-documenté via Swagger/OpenAPI).
- **Base de Données & ORM** : SQLAlchemy (PostgreSQL) pour les métadonnées et la configuration multi-tenant.
- **Orchestration d'IA** : LangChain & LangGraph pour le routage cognitif et le "Tool Calling".
- **Modèle de Langage (LLM)** : Groq API (pour une latence d'inférence ultra-faible) ou un système "Mock" de repli pour le développement local.
- **Temps Réel** : WebSockets (Starlette) pour le streaming haute fréquence de la télémétrie vers le client.
- **Connecteurs Télémétriques** : Intégrations prêtes pour PostgreSQL, MongoDB, Cassandra, et Databricks.

---

## 🧠 Architecture et Orchestration IA (LangGraph)

L'intelligence du backend repose sur un paradigme de **ReAct** (Reasoning and Acting) orchestré par LangGraph.
Plutôt que d'avoir un LLM statique, le backend héberge plusieurs agents qui possèdent des "Outils" (Tools Python) leur permettant de réfléchir, de lire la base de données, et de calculer des statistiques en temps réel.

### Le Processus NLQ (Natural Language Query)
1.  **Entrée** : L'utilisateur pose une question dans le chat (ex: "Quelle machine consomme le plus d'énergie ?").
2.  **Routage (`graph_orchestrator.py`)** : LangGraph initialise l'état cognitif et transmet la question à l'Agent Principal (`NLQ Agent`).
3.  **Appel d'outils (`tools.py`)** : L'Agent Principal n'invente pas la réponse. Il appelle dynamiquement les outils à sa disposition :
    - `get_kpi_list` : Découvre les KPIs disponibles.
    - `get_kpi_statistics` : Calcule la moyenne, le min, le max et l'écart-type.
    - `compare_kpi_across_components` : Agrège les données par composant.
    - `get_kpi_trend_over_time` : Évalue l'évolution temporelle.
    - `detect_kpi_anomalies` : Identifie les pics mathématiques basés sur le Z-score.
4.  **Synthèse** : Une fois les données récoltées, l'agent génère une réponse textuelle et ordonne la création d'un graphique pertinent.
5.  **Chart Agent** : Le `Chart Agent` prend le relais, génère une configuration JSON de graphique structurée (`Recharts`), et la renvoie au frontend.

---

## 🔒 Sécurité & Hardening (SaaS Multi-Tenant)

Ce backend a été conçu pour supporter un environnement SaaS de production, où les données de multiples entreprises transitent.

### 1. Véritable Multi-Tenancy (Isolation DB)
*   Toutes les opérations CRUD (lecture, sauvegarde, mise à jour) sont filtrées au niveau de la requête SQL par `user_id` et `twin_id`.
*   Il est mathématiquement impossible pour un utilisateur A d'accéder, même par ingénierie inverse, à la configuration d'un utilisateur B.

### 2. Sécurité Applicative (SSRF / Réseau)
*   L'Assistant de Connexion de données empêche formellement le **Server-Side Request Forgery (SSRF)**.
*   Les hôtes réseau (`localhost`, `127.0.0.1`, `0.0.0.0`, `169.254.x.x`) sont bloqués pour prévenir l'accès aux ressources internes du serveur hébergeant le backend.
*   Protection de l'Event Loop : Limitation drastique de la durée de vie des requêtes SQL (`connect_timeout=3`) afin d'éviter les attaques par épuisement de ressources (Threadpool starvation).

### 3. Exécution IA Sandboxée
*   L'évaluation dynamique du code (ex: `eval()`, exécution arbitraire de scripts Pandas via LLM) a été **complètement bannie**.
*   Les agents LLM interagissent avec la donnée uniquement au travers de fonctions déterministes et typées (`@tool`), évitant tout risque d'injection de code dans l'environnement Python.

---

## 🗄️ Connecteurs de Télémétrie Asynchrones

Le système de streaming (`routers/data_source.py` & `/connectors/`) gère le cycle de vie de la donnée :
1.  **Démarrage** : Lorsqu'un utilisateur configure un jumeau, un thread démon de connecteur est lancé.
2.  **Polling** : Le connecteur récupère les données brutes (ou en génère par simulation si le connecteur est un mock ou un postgres de test) depuis la base distante.
3.  **Évaluation Mathématique** : Les données ingérées sont passées à travers un évaluateur de formules AST strict pour transformer des champs natifs en KPIs complexes (ex: `defect_rate / (timestamp + 0.1)`).
4.  **Diffusion WebSocket** : Les KPIs sont formatés puis "push" vers les clients abonnés au WebSocket en moins de 100 millisecondes.

---

## 🚀 Lancement Local

1.  Assurez-vous que Python 3.10 ou supérieur est installé.
2.  Installez les dépendances : `pip install -r requirements.txt`.
3.  Configurez vos variables d'environnement (`cp .env.example .env`).
4.  Assurez-vous que votre base de données PostgreSQL est lancée et accessible via l'URL spécifiée dans `DATABASE_URL`.
5.  Démarrez le serveur avec rechargement à chaud (Hot Reload) :
    ```bash
    python main.py
    ```
6.  Accédez à la documentation automatique de l'API à l'adresse : `http://localhost:8000/docs`.

---

## 🧪 Tests et Génération de Données (PostgreSQL)

Pour tester la plateforme avec un flux de données réaliste, un environnement de test local est inclus avec Docker.

### 1. Lancer le conteneur PostgreSQL de Télémétrie
À la racine du dossier backend, lancez le docker-compose :
```bash
docker-compose up -d
```
Cela lancera une base de données sur le port `5433` spécifiquement dédiée aux tests de télémétrie.

### 2. Générer les Données
Utilisez le script de génération pour remplir la base avec des tables spécifiques au domaine testé (`factory_data`, `warehouse_data`, ou `airport_data`) :
```bash
python generate_pg_data.py --domain factory
```
*(Remplacez `factory` par `warehouse` ou `airport` selon le jumeau que vous configurez dans l'interface).*

Lors de la configuration de votre Jumeau sur l'interface UI, connectez-vous avec l'URL :
`postgresql://postgres:postgrespassword@localhost:5433/telemetry_db` et indiquez la table correspondante.
