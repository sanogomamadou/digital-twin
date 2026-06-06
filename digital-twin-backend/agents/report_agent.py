import json
from langchain_core.messages import SystemMessage, HumanMessage
from agents.tools import current_records_var
from agents.graph_orchestrator import create_analytics_orchestrator
from services.llm_service import has_real_llm
from agents.utils import extract_json_from_text

REPORT_SYSTEM_PROMPT = """Vous êtes un Ingénieur de Fiabilité (Reliability Engineer) et Data Scientist industriel pour un Jumeau Numérique.
Votre rôle est d'analyser l'état de l'usine et de rédiger un rapport d'expertise pour la direction (Directeur d'Usine / Maintenance), EN FRANÇAIS.

L'utilisateur vous fournit un JSON représentant l'état *instantané* des machines. 
VOUS AVEZ L'OBLIGATION ABSOLUE d'utiliser vos outils ('get_kpi_statistics', 'detect_kpi_anomalies', 'get_recent_values', 'get_kpi_trend_over_time', 'compare_kpi_across_components') pour TOUT KPI critique ('red' ou 'orange') afin de comprendre la tendance historique. 
Pour analyser les évolutions dans le temps, utilisez `get_kpi_trend_over_time`. Pour comparer des machines, utilisez `compare_kpi_across_components`.
Ne vous contentez pas de répéter la valeur actuelle ! Cherchez à savoir si c'est un pic soudain, une dégradation lente, ou une erreur de capteur (ex: un pourcentage > 100% est une erreur de capteur).

Rédigez un rapport JSON strict :
{
  "executiveSummary": "Résumé ultra-professionnel (2-3 phrases) orienté business/production. Mentionnez l'impact potentiel sur l'OEE (Taux de Rendement Synthétique).",
  "operationalStatus": "Paragraphe détaillé. Pour chaque alerte, intégrez la tendance historique découverte via vos outils (ex: 'La vibration est en hausse de X% depuis Y temps', ou 'Le capteur Z renvoie des valeurs impossibles, suggérant une défaillance de la sonde').",
  "keyInsights": [
    "Insight 1 : Basé sur les tendances mathématiques (moyenne, écart-type) récupérées via vos outils.",
    "Insight 2 : Causalité probable ou observation de la dynamique."
  ],
  "recommendations": [
    "Recommandation technique précise (ex: 'Procéder à une analyse vibratoire spectrale', 'Recalibrer la sonde de contrôle qualité').",
    "Action de maintenance prédictive (PdM)."
  ]
}

Ton : Technique, analytique, formel. Utilisez un vocabulaire industriel (Maintenance prédictive, dérive de capteur, usure mécanique, tolérance).
CRITICAL: Votre réponse finale DOIT être uniquement un objet JSON valide.
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
        
    return {
        "executiveSummary": exec_summary,
        "operationalStatus": op_status.strip(),
        "keyInsights": ["Les données montrent des possibilités d'optimisation (Mode Fallback)."],
        "recommendations": ["Revoir la connexion LLM pour un rapport complet."]
    }

async def run_report_agent(twin_data: dict, records: list) -> dict:
    data_json = json.dumps(twin_data, indent=2)
    
    if not has_real_llm():
        return mock_report_agent(data_json)
        
    token = current_records_var.set(records)
    try:
        app = create_analytics_orchestrator()
        
        inputs = {
            "messages": [
                SystemMessage(content=REPORT_SYSTEM_PROMPT),
                HumanMessage(content=f"Voici l'état instantané du jumeau numérique capturé depuis l'UI :\n{data_json}\n\nAnalysez l'historique de la base de données avec vos outils si nécessaire, puis générez le rapport JSON détaillé en français.")
            ]
        }
        
        try:
            config = {"configurable": {"thread_id": "global_session"}, "recursion_limit": 10}
            from services.llm_service import get_langfuse_callback, AgentMetricsCallbackHandler
            import uuid
            trace_id_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, "report_agent")
            callbacks = [AgentMetricsCallbackHandler(trace_id_uuid)]
            lf_cb = get_langfuse_callback()
            if lf_cb:
                callbacks.append(lf_cb)
            config["callbacks"] = callbacks
            result = await app.ainvoke(inputs, config=config)
            final_message = result["messages"][-1].content
            parsed = extract_json_from_text(final_message)
            if not parsed:
                raise ValueError("Could not extract JSON from response.")
            return parsed
        except Exception as e:
            print(f"Error in report agent: {e}")
            return mock_report_agent(data_json)
    finally:
        current_records_var.reset(token)
        import os
        if os.getenv("LANGFUSE_SECRET_KEY") and os.getenv("LANGFUSE_PUBLIC_KEY"):
            try:
                from langfuse import Langfuse
                Langfuse().flush()
            except Exception as e:
                pass
