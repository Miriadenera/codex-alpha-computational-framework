# Setup: deploy automatico su codexalpha.org

## Panoramica

Ogni volta che fai `git push` sul branch `main` del repository
`codex-alpha-computational-framework`, GitHub Actions:

1. esegue la pipeline Python (genera i JSON in `dashboard/public/data/`)
2. fa il build della dashboard React con Vite
3. deploya il risultato su Netlify

Il tuo sito principale `codexalpha.org` rimane intatto.
La dashboard sarà visibile all'URL che configuri nel pannello Netlify
(es. `computational-framework.codexalpha.org` oppure come sottopath
se usi il sito principale Netlify).

---

## Passo 1 — Recupera le credenziali Netlify

### NETLIFY_AUTH_TOKEN
1. Vai su https://app.netlify.com
2. Clicca sulla tua foto profilo in alto a destra → **User settings**
3. Sezione **Applications** → **Personal access tokens**
4. Clicca **New access token** → dai un nome tipo `github-actions`
5. Copia il token (lo vedrai solo una volta)

### NETLIFY_SITE_ID
1. Nel pannello Netlify, apri il sito della dashboard
   (se non esiste ancora, crea un nuovo sito vuoto: **Add new site → Deploy manually**)
2. Vai in **Site configuration → General**
3. Copia il valore **Site ID** (formato: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

---

## Passo 2 — Aggiungi i secrets su GitHub

1. Vai su https://github.com/Miriadenera/codex-alpha-computational-framework
2. Clicca **Settings** (in alto a destra nel repo)
3. Sidebar sinistra → **Secrets and variables → Actions**
4. Clicca **New repository secret** e aggiungi:
   - Nome: `NETLIFY_AUTH_TOKEN` → incolla il token
   - Nome: `NETLIFY_SITE_ID`    → incolla l'ID del sito

---

## Passo 3 — Aggiungi i file al repository

Struttura da aggiungere:

```
codex-alpha-computational-framework/
├── .github/
│   └── workflows/
│       └── deploy.yml          ← il file fornito
├── netlify.toml                ← il file fornito (nella root del repo)
├── dashboard/
│   ├── ...                     (già esistente)
└── ...
```

Crea la cartella `.github/workflows/` se non esiste, e inserisci `deploy.yml`.
Metti `netlify.toml` nella radice del repository.

```bash
mkdir -p .github/workflows
# copia deploy.yml in .github/workflows/
# copia netlify.toml nella root

git add .github/workflows/deploy.yml netlify.toml
git commit -m "ci: add GitHub Actions + Netlify deploy"
git push
```

---

## Passo 4 — Configura il dominio su Netlify

Se vuoi che la dashboard sia raggiungibile come sottodominio di codexalpha.org:

1. Nel pannello Netlify del sito dashboard → **Domain management**
2. Clicca **Add a domain** → inserisci `computational-framework.codexalpha.org`
3. Netlify ti darà un record DNS da aggiungere al tuo registrar
4. Aggiungi il record CNAME:
   - Host: `computational-framework`
   - Valore: `<nome-del-tuo-sito>.netlify.app`

---

## Passo 5 — Primo deploy

Dopo aver fatto il push, vai su:

```
https://github.com/Miriadenera/codex-alpha-computational-framework/actions
```

Vedrai il workflow in esecuzione. Se tutto va bene, in 3-5 minuti
la dashboard sarà live.

---

## Risoluzione problemi comuni

### La pipeline Python fallisce
- Verifica che `requirements.txt` contenga tutti i pacchetti
- Controlla i log nel tab Actions → step "Run Codex Alpha pipeline"

### I file JSON non vengono trovati dalla dashboard
- Assicurati che la pipeline scriva in `dashboard/public/data/`
  (non in `results/` soltanto)
- Il `vite.config.js` deve avere `base: "/"` oppure il base corretto

### Il sito mostra pagina bianca
- Controlla `vite.config.js`: se la dashboard è in un sottopath
  (es. `/computational-framework/`) devi aggiungere `base: '/computational-framework/'`
  nel config di Vite

### Aggiornamento manuale
Puoi lanciare il workflow anche senza fare push:
GitHub → Actions → "Codex Alpha Pipeline + Deploy" → "Run workflow"
