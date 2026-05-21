from services.llm_service import llm_json_call, has_real_llm
import json

REPORT_SYSTEM_PROMPT = """Vous êtes un Analyste Expert de Jumeau Numérique (Digital Twin Data Analyst).
Votre tâche est d'analyser l'état du jumeau numérique et de rédiger un rapport exécutif professionnel pour la direction, EN FRANÇAIS.
Vous recevrez un JSON contenant le domaine du jumeau, les composants et les KPI actuels.

Rédigez un rapport très structuré au format JSON respectant strictement cette structure :
{
  "executiveSummary": "Un résumé exécutif clair en 2-3 phrases maximum.",
  "operationalStatus": "Un paragraphe décrivant ce qui fonctionne bien et listant les problèmes critiques.",
  "keyInsights": ["Insight majeur 1", "Insight majeur 2"],
  "recommendations": ["Recommandation stratégique 1", "Recommandation stratégique 2"]
}

Le ton doit être formel, professionnel et orienté 'business'. Concentrez-vous sur les actions concrètes (maintenance, optimisation, surveillance).
"""

def mock_report_agent(data_json: str) -> dict:
    data = json.loads(data_json)
    domain = data.get("domain", "Inconnu")
    kpis = data.get("kpis", [])
    
    critical = [k for k in kpis if k.get("status") == "red"]
    warnings = [k for k in kpis if k.get("status") == "orange"]
    
    exec_summary = f"Le jumeau numérique ({domain}) est actuellement opérationnel. "
    if critical:
        exec_summary += f"Cependant, {len(critical)} systèmes critiques nécessitent une attention immédiate."
    elif warnings:
        exec_summary += f"Il y a {len(warnings)} avertissements qui doivent être surveillés de près."
    else:
        exec_summary += "Tous les systèmes fonctionnent dans des paramètres optimaux."
        
    op_status = ""
    if critical:
        op_status += "Des problèmes critiques ont été détectés dans les indicateurs suivants : " + ", ".join([c.get("name", "Inconnu") for c in critical]) + ". "
    if warnings:
        op_status += "Des avertissements sont actifs pour : " + ", ".join([w.get("name", "Inconnu") for w in warnings]) + ". "
    if not critical and not warnings:
        op_status += "Aucun problème n'a été détecté. Les plannings de maintenance sont à jour."
        
    insights = [
        "Les données actuelles des KPIs montrent des possibilités d'optimisation sur les flux principaux.",
        "La corrélation entre les temps d'arrêt et les baisses de performance est clairement visible."
    ]
    
    recs = []
    if critical:
        recs.append("Déployer immédiatement une équipe technique pour investiguer les alertes critiques.")
        recs.append("Revoir les seuils de tolérance pour s'assurer qu'ils correspondent aux limites opérationnelles.")
    else:
        recs.append("Maintenir la surveillance de routine actuelle.")
        recs.append("Analyser les données historiques pour identifier des améliorations d'efficacité à long terme.")
        
    return {
        "executiveSummary": exec_summary,
        "operationalStatus": op_status.strip(),
        "keyInsights": insights,
        "recommendations": recs
    }

async def run_report_agent(twin_data: dict) -> dict:
    data_json = json.dumps(twin_data, indent=2)
    
    if has_real_llm():
        result = await llm_json_call(
            system_prompt=REPORT_SYSTEM_PROMPT,
            user_message=f"Analysez les données suivantes du jumeau numérique et générez le rapport en français :\n{data_json}",
            fallback_fn=lambda _: mock_report_agent(data_json)
        )
        return result
    else:
        return mock_report_agent(data_json)
