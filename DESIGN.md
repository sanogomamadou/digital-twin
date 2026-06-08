---
name: Digital Twin UI
description: Plateforme Jumeau Numérique Intelligent
colors:
  accent: "#4865f2"
  green: "#10d98d"
  orange: "#f4723e"
  red: "#ef4444"
  bg-0: "#f4f5f7"
  bg-1: "#ffffff"
  bg-2: "#e2e4e9"
  bg-3: "#f9fafb"
  text-0: "#1e293b"
  text-1: "#475569"
  text-2: "#64748b"
typography:
  body:
    fontFamily: "'Inter', system-ui, sans-serif"
rounded:
  sm: "6px"
  md: "10px"
  lg: "16px"
  xl: "24px"
spacing:
  sm: "8px"
  md: "16px"
components:
  btn-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  btn-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-1}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
---

# Design System: Digital Twin UI

## 1. Overview

**Creative North Star: "The Professional Operations Deck"**

Le système visuel est conçu pour inspirer confiance, clarté et contrôle. Il s'appuie sur une structure "Bento box" propre, des fonds clairs (off-white) et des accents de couleur ciblés (inspirés du dégradé DXC) pour guider l'attention sans la saturer. L'interface rejette les clichés des tableaux de bord générés par IA (gradients excessifs, dark mode forcé par défaut, glassmorphism décoratif sans but) au profit d'une approche "Enterprise-grade" où la donnée prime.

**Key Characteristics:**
- Clarté structurelle (Data is the hero).
- Utilisation subtile et fonctionnelle des couleurs de statut.
- Typographie lisible et hiérarchisée.
- Conteneurs bien délimités.

## 2. Colors

La palette est lumineuse et fonctionnelle, utilisant l'accent bleu comme identité principale.

### Primary
- **Blue Accent** (#4865f2): Couleur d'action principale, boutons primaires, et focus states. Inspiré par la marque.

### Secondary
- **Orange DXC** (#f4723e / #f59e0b): Utilisé pour les statuts d'avertissement et pour enrichir ponctuellement l'accent primaire sous forme de dégradé.

### Neutral
- **Background Base** (#f4f5f7): Fond principal de l'application, réduit la fatigue visuelle comparé au blanc pur.
- **Surface Card** (#ffffff): Fond des cartes et conteneurs Bento pour les détacher du fond.
- **Ink Primary** (#1e293b): Texte principal.
- **Ink Secondary** (#475569): Texte secondaire, labels, icônes.

**The Functional Color Rule.** La couleur a un sens. Ne pas utiliser le vert, rouge ou orange de manière décorative. Ils sont réservés exclusivement aux statuts du système (Santé, Alerte, Erreur).

## 3. Typography

**Display Font:** Inter
**Body Font:** Inter, system-ui, sans-serif

**Character:** Neutre, technique, hautement lisible. Parfait pour la lecture de données denses.

### Hierarchy
- **Body** (400, 14px): Texte par défaut pour les données et descriptions.
- **Label** (600, 12px, 0.06em, UPPERCASE): Titres de sections, entêtes de bento boxes.

**The No-Caps Rule.** Les majuscules (uppercase) sont strictement limitées aux micro-labels (≤3 mots) ou badges. Jamais pour des phrases complètes ou des paragraphes.

## 4. Elevation

Le système utilise une combinaison de bordures douces et d'ombres diffuses pour séparer les conteneurs du fond sans créer trop de contraste dur.

### Shadow Vocabulary
- **Ambient Low** (`0 2px 8px rgba(0,0,0,0.05)`): Surélévation par défaut des petites cartes ou boutons.
- **Structural Mid** (`0 4px 24px rgba(0,0,0,0.08)`): Conteneurs principaux.
- **Action Glow** (`0 0 24px rgba(72,101,242,0.2)`): Feedback lumineux sur les actions primaires (focus, hover).

**The Flat-By-Default Rule.** Les données sont plates. Seuls les conteneurs interactifs ou les couches superposées (modales, tooltips) gagnent en élévation.

## 5. Components

### Buttons
- **Shape:** Arrondis modérés (10px).
- **Primary:** Dégradé subtil accent-to-orange, texte blanc. Léger lift au survol avec renforcement de l'ombre.
- **Ghost:** Transparent, bordure subtile, gagne un fond au survol.

### Cards / Containers (Bento Box)
- **Corner Style:** 16px à 24px pour les grands conteneurs.
- **Background:** Blanc pur (#ffffff) ou verre subtil (`rgba(255,255,255,0.7)`).
- **Border:** Bordure très légère (`rgba(72,101,242,0.15)`) pour délimiter sans alourdir.

### Inputs / Fields
- **Style:** Fond légèrement grisé (#f9fafb), bordure standard.
- **Focus:** Bordure bleue avec un halo lumineux (`box-shadow`).

## 6. Do's and Don'ts

### Do:
- **Do** utiliser les conteneurs Bento pour regrouper logiquement les métriques.
- **Do** utiliser des fonds clairs (off-white) pour maximiser la lisibilité.
- **Do** réserver l'usage du dégradé DXC aux éléments d'action majeurs.

### Don't:
- **Don't** utiliser des interfaces génériques "générées par IA" (AI-generated slop).
- **Don't** utiliser des gradients excessifs sur les textes ou les fonds de cartes standards.
- **Don't** surcharger l'interface avec du "glassmorphism" décoratif sans justification de profondeur.
- **Don't** utiliser des bordures colorées épaisses (ex: border-left de 4px) sur le côté des cartes comme seul indicateur de statut.
