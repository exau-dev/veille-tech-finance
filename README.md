# veille-tech-finance

Dashboard statique agrégeant des flux RSS tech & finance (sources anglophones
et francophones), avec actualisation automatique via GitHub Actions.

## Fonctionnement

1. `feeds.yaml` liste les sources RSS suivies (nom, url, catégorie
   `tech`/`finance`, langue).
2. `scripts/fetch_feeds.py` récupère chaque flux, dé-duplique les articles et
   génère `docs/data/articles.json`.
3. `docs/index.html` (+ `style.css` / `app.js`) affiche ce JSON sous forme de
   liste filtrable par catégorie, source et mot-clé — aucun framework, aucune
   étape de build.
4. `.github/workflows/update-feeds.yml` relance le script toutes les 6 heures
   (et à chaque modification de `feeds.yaml`), puis commit le JSON mis à jour.

## Lancer en local

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python scripts/fetch_feeds.py

# servir le dashboard (le fetch() du JSON échoue en file://)
cd docs && python -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Ajouter / retirer une source

Éditez `feeds.yaml` et ajoutez une entrée :

```yaml
- name: Nom affiché
  url: https://exemple.com/rss
  category: tech   # ou finance
  lang: fr          # ou en
```

Un flux qui échoue au parsing n'interrompt pas les autres : il est listé dans
`failed_sources` du JSON généré et un avertissement est affiché dans les logs
du script/workflow.

## Publier sur GitHub Pages

Une fois cette branche fusionnée sur la branche par défaut :

1. Repo → **Settings → Pages**
2. **Source** : `Deploy from a branch`
3. **Branch** : branche par défaut, dossier `/docs`

Le site se met alors à jour tout seul à chaque commit poussé par le workflow
d'actualisation.

## Notes

Les URLs de flux dans `feeds.yaml` n'ont pas pu être vérifiées depuis cet
environnement (accès réseau restreint dans le sandbox de développement) —
elles sont correctes au moment de l'écriture mais un site peut changer son
URL de flux RSS avec le temps. Si `failed_sources` contient une entrée après
un run, vérifiez/mettez à jour son URL dans `feeds.yaml`.
