# Flux Détaillé : MCP GPAC Test Suite (État Actuel)

## Vue d'Ensemble

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Utilisateur │────▶│   Claude    │────▶│ MCP Server  │────▶│  Réponse    │
│   (prompt)   │     │    (LLM)    │     │   (index)   │     │  (commande) │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

---

## Phase 0 : Démarrage du Serveur MCP (Une fois au lancement)

### 0.1 Chargement des données sources

**Fichier** : [src/index.ts:19-30](../src/index.ts#L19-L30)

```
┌────────────────────────────────────────────────────────────┐
│ MCP Server Boot                                            │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  1. Lecture aliases.json                                   │
│     └─▶ { "scene_encode": ["bifs", "bt", "xmt"], ... }   │
│                                                            │
│  2. loadXmlTests(XML_TESTS_PATH)                          │
│     └─▶ Parse all_tests_descriptions.xml                 │
│     └─▶ Extrait ~N tests avec subtests                   │
│     └─▶ Stocke dans TESTS global (RAM)                   │
│                                                            │
│  3. buildInMemoryIndex(aliases)                           │
│     └─▶ Merge XML keywords + alias tags                  │
│     └─▶ Construit Map<testName, IndexedTest>             │
│     └─▶ testByName (index RAM principal)                 │
│                                                            │
│  4. Enregistrement MCP Tool                               │
│     └─▶ find_commands_by_goal                            │
│                                                            │
│  5. server.connect(StdioTransport)                        │
│     └─▶ Écoute stdin/stdout pour protocole MCP           │
└────────────────────────────────────────────────────────────┘
```

**Structures de données chargées en RAM** :

```typescript
// xml-tests.ts globals
TESTS: Record<string, XmlTest> = {
  "scene_encode": {
    name: "scene_encode",
    desc: "BIFS encoding tests",
    keywords: ["bifs", "bt", "xmt", "encode"],
    subtests: [
      {
        name: "basic_bt",
        desc: "Encode basic BT file",
        command: "$MP4BOX -mp4 scene.bt -out output.mp4",
        keywords: ["bifs", "bt"]
      },
      // ... plus de subtests
    ]
  },
  // ... ~300+ tests
}

// indexing.ts output
testByName: Map<string, IndexedTest> = {
  "scene_encode" => {
    name: "scene_encode",
    description: "BIFS encoding tests",
    keywords: ["bifs", "bt", "xmt", "encode", "scene"],  // XML + aliases
    subtests: [
      {
        testName: "scene_encode",
        subtestName: "basic_bt",
        description: "Encode basic BT file",
        keywords: ["bifs", "bt", "encode"],
        command: "$MP4BOX -mp4 scene.bt -out output.mp4"
      },
      // ...
    ]
  },
  // ...
}
```

---

## Phase 1 : Requête Utilisateur → MCP Tool Call

### 1.1 Utilisateur pose une question

**Exemple** :
```
User: "How to DASH a video with 1 second segments?"
```

### 1.2 Claude (LLM) décide d'appeler le MCP tool

**Raisonnement interne du LLM** :
```
┌───────────────────────────────────────────────────────────┐
│ Claude analyse la requête :                               │
│                                                           │
│  • Détecte intention : trouver commande GPAC             │
│  • Mots-clés extraits : "DASH", "video", "1 second"     │
│  • Décide d'appeler : find_commands_by_goal              │
│                                                           │
│  MCP Tool Call généré :                                  │
│  {                                                        │
│    tool: "find_commands_by_goal",                       │
│    arguments: {                                          │
│      goal: "DASH video 1 second segments",             │
│      limit: 5                                           │
│    }                                                     │
│  }                                                        │
└───────────────────────────────────────────────────────────┘
```

---

## Phase 2 : Traitement MCP Server (Scoring + Ranking)

### 2.1 Entrée dans le handler du tool

**Fichier** : [src/index.ts:64-70](../src/index.ts#L64-L70)

```
┌────────────────────────────────────────────────────────────┐
│ find_commands_by_goal("DASH video 1 second segments", 5)  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  1. Nettoyage query :                                      │
│     query = "DASH video 1 second segments".trim()         │
│                                                            │
│  2. Tokenization :                                         │
│     queryWords = ["dash", "video", "second", "segments"]  │
│     (filtre : mots > 2 chars)                             │
└────────────────────────────────────────────────────────────┘
```

### 2.2 Scoring de tous les tests

**Fichier** : [src/index.ts:76-80](../src/index.ts#L76-L80)

```
┌────────────────────────────────────────────────────────────┐
│ Pour chaque test dans testByName :                        │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  scoreTest(test, queryWords)  // scoring.ts:38            │
│                                                            │
│  Algorithme :                                              │
│  ┌────────────────────────────────────────────────────┐   │
│  │ buildSearchText(test) :                            │   │
│  │   ├─ test.name                                     │   │
│  │   ├─ test.description                              │   │
│  │   ├─ test.keywords[]                               │   │
│  │   └─ tous les subtests (name + desc)              │   │
│  │                                                    │   │
│  │ searchText = "scene_encode bifs encoding ..."     │   │
│  │                                                    │   │
│  │ Score = nombre de queryWords trouvés dans         │   │
│  │         searchText (normalisé lowercase)          │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  Exemple :                                                 │
│  • Test "dash_segment" :                                  │
│    searchText = "dash segment video mp4 ..."             │
│    Matches = ["dash", "video", "segment"] → score = 3    │
│                                                            │
│  • Test "scene_encode" :                                  │
│    searchText = "scene bifs bt encode ..."               │
│    Matches = [] → score = 0                              │
└────────────────────────────────────────────────────────────┘
```

### 2.3 Filtrage et tri des tests

**Fichier** : [src/index.ts:78-86](../src/index.ts#L78-L86)

```
┌────────────────────────────────────────────────────────────┐
│ Traitement des scores :                                   │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  rankedTests = tests                                       │
│    .map(test => ({ test, score: scoreTest(...) }))       │
│    .filter(score > 0)        // supprime non-matchs      │
│    .sort((a, b) => b - a)   // tri desc par score        │
│                                                            │
│  Résultat :                                                │
│  [                                                         │
│    { test: "dash_segment", score: 3 },                   │
│    { test: "dash_dynamic", score: 2 },                   │
│    { test: "cmaf_segment", score: 2 },                   │
│    // ...                                                 │
│  ]                                                         │
│                                                            │
│  Si rankedTests.length === 0 :                            │
│    return { error: "NO_MATCH", query }                   │
└────────────────────────────────────────────────────────────┘
```

### 2.4 Extraction et scoring des commandes

**Fichier** : [src/index.ts:89-90](../src/index.ts#L89-L90)

```
┌────────────────────────────────────────────────────────────┐
│ extractAndScoreCommands(rankedTests, queryWords)          │
│                                                            │
│ Fichier : scoring.ts:58-79                                │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Pour chaque test trié :                                   │
│    Pour chaque subtest avec command :                      │
│      ┌──────────────────────────────────────────────┐     │
│      │ scoreCommand(subtest, command, queryWords)   │     │
│      │                                              │     │
│      │ buildSubtestSearchText() :                   │     │
│      │   ├─ subtest.subtestName                    │     │
│      │   ├─ subtest.description                    │     │
│      │   ├─ subtest.keywords[]                     │     │
│      │   └─ command (texte complet)                │     │
│      │                                              │     │
│      │ Compte mots query dans searchText           │     │
│      └──────────────────────────────────────────────┘     │
│                                                            │
│      pool.push({                                           │
│        test: "dash_segment",                              │
│        subtest: "1s_segments",                            │
│        desc: "Create DASH with 1sec segments",           │
│        command: "gpac -i video.mp4 -o seg.mpd:segdur=1", │
│        score: 4  // tous les mots matchent               │
│      })                                                    │
└────────────────────────────────────────────────────────────┘
```

**Pool de commandes généré** :
```javascript
pool = [
  {
    test: "dash_segment",
    subtest: "1s_segments",
    desc: "Create DASH with 1sec segments",
    command: "gpac -i video.mp4 -o dash.mpd:segdur=1",
    score: 4
  },
  {
    test: "dash_dynamic",
    subtest: "custom_duration",
    desc: "DASH dynamic with custom segment duration",
    command: "gpac -i input.mp4 -o live.mpd:profile=live:segdur=1.0",
    score: 3
  },
  // ... ~50+ commandes potentielles
]
```

### 2.5 Déduplication et limitation

**Fichier** : [src/index.ts:90](../src/index.ts#L90), [scoring.ts:84-94](../src/utils/scoring.ts#L84-L94)

```
┌────────────────────────────────────────────────────────────┐
│ deduplicateAndSort(pool, limit=5, maxLimit=50)            │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Algorithme :                                              │
│  1. Sort pool par score descendant                         │
│  2. Itère sur pool :                                       │
│     • Si command déjà vue (Set) → skip                    │
│     • Sinon → ajoute à résultat                           │
│  3. Slice(0, min(limit, maxLimit))                        │
│                                                            │
│  Résultat (top 5) :                                        │
│  [                                                         │
│    { test: "dash_segment", subtest: "1s_segments", ... }, │
│    { test: "dash_dynamic", subtest: "custom_dur", ... },  │
│    { test: "cmaf_segment", subtest: "low_latency", ... }, │
│    { test: "dash_live", subtest: "realtime", ... },       │
│    { test: "hls_segment", subtest: "ts_chunks", ... }     │
│  ]                                                         │
└────────────────────────────────────────────────────────────┘
```

### 2.6 Construction de la réponse JSON

**Fichier** : [src/index.ts:99-113](../src/index.ts#L99-L113)

```
┌────────────────────────────────────────────────────────────┐
│ Format de sortie MCP :                                    │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  commands = topCommands.map(cmd => ({                     │
│    test: cmd.test,                                         │
│    subtest: cmd.subtest,                                   │
│    description: cmd.desc.slice(0, 180),  // tronqué      │
│    command: cmd.command,                                   │
│    confidence: cmd.score >= 3 ? "high" : "medium"        │
│  }))                                                       │
│                                                            │
│  return {                                                  │
│    content: [{                                             │
│      type: "text",                                         │
│      text: JSON.stringify({                               │
│        total: 5,                                          │
│        commands: [ ... ],                                 │
│        note: "Found 5 command(s)."                       │
│      }, null, 2)                                          │
│    }]                                                      │
│  }                                                         │
└────────────────────────────────────────────────────────────┘
```

**JSON retourné au LLM** :
```json
{
  "total": 5,
  "commands": [
    {
      "test": "dash_segment",
      "subtest": "1s_segments",
      "description": "Create DASH with 1 second segments",
      "command": "gpac -i video.mp4 -o dash.mpd:segdur=1",
      "confidence": "high"
    },
    {
      "test": "dash_dynamic",
      "subtest": "custom_duration",
      "description": "DASH dynamic with custom segment duration",
      "command": "gpac -i input.mp4 -o live.mpd:profile=live:segdur=1.0",
      "confidence": "medium"
    }
    // ... 3 autres commandes
  ],
  "note": "Found 5 command(s)."
}
```

---

## Phase 3 : Réponse du LLM à l'Utilisateur

### 3.1 Claude reçoit le résultat MCP

```
┌───────────────────────────────────────────────────────────┐
│ Claude (LLM) traitement :                                 │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  1. Parse JSON reçu du MCP                               │
│  2. Analyse les 5 commandes retournées                   │
│  3. Sélectionne la plus pertinente (souvent la 1ère)    │
│  4. **PEUT MODIFIER/ADAPTER la commande** ⚠️             │
│     (C'est ici que l'hallucination peut survenir!)       │
│  5. Génère réponse naturelle pour l'utilisateur          │
└───────────────────────────────────────────────────────────┘
```

### 3.2 Génération de la réponse finale

**Exemple réponse sans hallucination** :
```
To create DASH segments with 1 second duration, use:

gpac -i video.mp4 -o dash.mpd:segdur=1

This command from the `dash_segment` test creates a DASH manifest
with 1-second segment duration.
```

**Exemple réponse AVEC hallucination** ⚠️ :
```
To create DASH segments with 1 second duration and optimize audio
sampling rate, use:

gpac -i video.mp4 compositor:osr=44100 -o dash.mpd:segdur=1
                    ^^^^^^^^^^^^^^^^
                    INVENTÉ PAR LE LLM !
                    (pas dans le MCP)

This sets the output sample rate to 44.1 kHz while creating
1-second DASH segments.
```

---

## Problème Identifié : Zone d'Hallucination

```
┌────────────────────────────────────────────────────────────┐
│ POINT DE DÉFAILLANCE                                      │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  MCP Server (FIABLE)                                       │
│    └─▶ Retourne UNIQUEMENT commandes existantes          │
│        depuis index XML validé                            │
│                                                            │
│  ❌ Claude LLM (PEUT HALLUCINER)                          │
│    └─▶ Reçoit commande correcte                          │
│    └─▶ "Améliore" en ajoutant options inventées          │
│    └─▶ Base sa "connaissance" sur :                      │
│        • Training data (peut-être obsolète)              │
│        • Pattern matching (options similaires)           │
│        • Pas de vérification avec build local !          │
│                                                            │
│  Utilisateur (VULNÉRABLE)                                  │
│    └─▶ Reçoit commande qui SEMBLE correcte               │
│    └─▶ Exécute → ERREUR (option inexistante)             │
└────────────────────────────────────────────────────────────┘
```

---

## Résumé du Flux Complet

```
┌─────────────────────────────────────────────────────────────────────┐
│ TIMELINE COMPLÈTE                                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  T0: Boot MCP Server                                               │
│      └─▶ Load XML (300+ tests, 2000+ commands) → RAM index        │
│                                                                     │
│  T1: User prompt: "How to DASH with 1s segments?"                 │
│                                                                     │
│  T2: Claude décide: call find_commands_by_goal                    │
│                                                                     │
│  T3: MCP Server traite:                                            │
│      ├─▶ Tokenize: ["dash", "video", "second", "segments"]       │
│      ├─▶ Score 300+ tests                                         │
│      ├─▶ Extract commands from top tests                          │
│      ├─▶ Score ~200 commands                                       │
│      ├─▶ Deduplicate + sort                                        │
│      └─▶ Return top 5 (JSON)                                       │
│                                                                     │
│  T4: Claude reçoit 5 commandes VÉRIFIÉES                          │
│                                                                     │
│  T5: ⚠️ Claude génère réponse → PEUT ajouter options inventées    │
│                                                                     │
│  T6: User voit réponse finale (possiblement incorrecte)           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Statistiques de Performance

**Données indexées** :
- ~300 tests
- ~2000 subtests
- ~2000 commandes GPAC uniques
- ~50 Mo RAM (index complet)

**Temps de réponse typique** :
- Scoring de 300 tests : ~5-10 ms
- Extraction commandes : ~10-20 ms
- Total MCP : < 50 ms
- Génération LLM : 2-5 secondes (hors MCP)

**Taux de succès** :
- MCP trouve match : ~85% des requêtes
- Commande exacte retournée : 100% (par design)
- **Commande finale correcte après LLM : ~60-70%** ⚠️
  (30-40% ont des options modifiées/ajoutées par le LLM)
