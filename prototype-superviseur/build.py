"""Convertit le XLSForm Kobo en JSON et l'intègre dans le prototype.

Usage : python3 build.py chemin/vers/formulaire.xlsx [sortie.html] [--artifact] [--sans-corrections]
        python3 build.py chemin/vers/formulaire.xlsx --xlsform-bilingue sortie.xlsx

La traduction anglaise est lue dans traduction_en.json (clé = libellé français).
--xlsform-bilingue écrit une copie du XLSForm avec les colonnes label::English
et constraint_message::English, prête à importer dans Kobo.
Le fichier produit (par défaut index.html) est autonome : il fonctionne hors ligne
dans un navigateur ou dans une WebView Android.
"""
import json
import sys
from pathlib import Path

import openpyxl

ICI = Path(__file__).parent


def lignes(ws):
    rows = list(ws.iter_rows(values_only=True))
    entetes = [str(h).strip() if h else "" for h in rows[0]]
    for r in rows[1:]:
        d = {h: ("" if v is None else str(v).strip()) for h, v in zip(entetes, r) if h}
        if any(d.values()):
            yield d


def texte(d, base):
    """Valeur d'une colonne traduisible : base, base::Français, sinon la première langue."""
    for k in (base, base + "::Français", base + "::French (fr)"):
        if d.get(k):
            return d[k]
    for k in d:
        if k.startswith(base + "::") and d[k]:
            return d[k]
    return ""


def label(d):
    return texte(d, "label")


def convertir(xlsx):
    wb = openpyxl.load_workbook(xlsx, read_only=True)
    survey = []
    for d in lignes(wb["survey"]):
        if not d.get("type"):
            continue
        q = {"type": d["type"], "name": d.get("name", "")}
        for cle, src in [("label", None), ("required", "required"), ("relevant", "relevant"),
                         ("appearance", "appearance"), ("choice_filter", "choice_filter"),
                         ("calculation", "calculation"), ("constraint", "constraint"),
                         ("constraint_message", "constraint_message"), ("hint", "hint")]:
            v = texte(d, cle) if cle in ("label", "hint", "constraint_message") else d.get(src, "")
            if cle == "required":
                v = v.lower() in ("true", "yes", "1")
            if v:
                q[cle] = v
        survey.append(q)
    choices = {}
    for d in lignes(wb["choices"]):
        if d.get("list_name"):
            item = [d.get("name", ""), label(d)]
            if d.get("parent"):
                item.append(d["parent"])
            choices.setdefault(d["list_name"], []).append(item)
    settings = next(lignes(wb["settings"]), {}) if "settings" in wb.sheetnames else {}
    return {"survey": survey, "choices": choices, "settings": settings}


def controler(form, corriger=True):
    """Repère les codes de choix cités dans les expressions mais absents des listes.

    Cas corrigés automatiquement (si corriger=True) :
    - question oui/non testée avec '1' / '2' (ancien codage) -> 'oui' / 'non' ;
    - code qui ne diffère que par un tiret bas final.
    Les autres anomalies sont seulement signalées.
    """
    import re
    listes = {q["name"]: q["type"].split()[1] for q in form["survey"]
              if q["type"].split()[0] in ("select_one", "select_multiple") and len(q["type"].split()) > 1}
    notes = []
    motif = re.compile(r"(\$\{(\w+)\}\s*=\s*|selected\(\s*\$\{(\w+)\}\s*,\s*)(['\"])([^'\"]*)\4")
    for q in form["survey"]:
        for cle in ("relevant", "calculation", "constraint"):
            expr = q.get(cle)
            if not expr:
                continue

            def remplacer(m):
                champ = m.group(2) or m.group(3)
                val = m.group(5)
                if champ not in listes or not val:
                    return m.group(0)
                codes = [c[0] for c in form["choices"].get(listes[champ], [])]
                if val in codes:
                    return m.group(0)
                nouveau = None
                if set(codes) == {"oui", "non"} and val in ("1", "2"):
                    nouveau = "oui" if val == "1" else "non"
                elif val.rstrip("_") in codes:
                    nouveau = val.rstrip("_")
                if nouveau and corriger:
                    notes.append({"champ": champ, "dans": q["name"], "avant": val, "apres": nouveau, "corrige": True})
                    return m.group(1) + m.group(4) + nouveau + m.group(4)
                notes.append({"champ": champ, "dans": q["name"], "avant": val, "apres": nouveau, "corrige": False})
                return m.group(0)

            q[cle] = motif.sub(remplacer, expr)
            for champ in re.findall(r"sum\(\s*\$\{(\w+)\}\s*\)", q[cle]):
                if champ in listes:
                    codes = [c[0] for c in form["choices"].get(listes[champ], [])]
                    if not all(c.lstrip("-").isdigit() for c in codes):
                        notes.append({"champ": champ, "dans": q["name"], "avant": "sum()", "apres": None, "corrige": False,
                                      "message": "sum() porte sur des codes non numériques (" + ", ".join(codes) + ") : le résultat est NaN."})
    return notes


def charger_traduction():
    f = ICI / "traduction_en.json"
    return json.loads(f.read_text(encoding="utf-8")) if f.exists() else {}


def xlsform_bilingue(xlsx, sortie, trad):
    """Copie du XLSForm avec une colonne anglaise à côté de chaque colonne française."""
    wb = openpyxl.load_workbook(xlsx)
    manquants = set()
    for feuille in ("survey", "choices"):
        ws = wb[feuille]
        entetes = [c.value for c in ws[1]]
        for i, h in enumerate(list(entetes)):
            h = str(h or "")
            base = h.split("::")[0]
            if base not in ("label", "hint", "constraint_message") or h.endswith("::English"):
                continue
            if h == base:  # colonne sans langue : la marquer comme française
                ws.cell(row=1, column=i + 1, value=base + "::Français")
            col = ws.max_column + 1
            ws.cell(row=1, column=col, value=base + "::English")
            for r in range(2, ws.max_row + 1):
                v = ws.cell(row=r, column=i + 1).value
                if v in (None, ""):
                    continue
                en = trad.get(str(v).strip())
                if en is None and not (feuille == "choices" and ws.cell(row=r, column=1).value in
                                       ("region", "province", "district", "commune", "csps", "village", "asbc")):
                    manquants.add(str(v).strip())
                ws.cell(row=r, column=col, value=en if en is not None else v)
    if "settings" in wb.sheetnames:
        ws = wb["settings"]
        entetes = [c.value for c in ws[1]]
        if "default_language" not in entetes:
            ws.cell(row=1, column=ws.max_column + 1, value="default_language")
            ws.cell(row=2, column=ws.max_column, value="Français")
    wb.save(sortie)
    print(f"{sortie} : XLSForm bilingue, {len(manquants)} texte(s) sans traduction (gardés en français)")


def main():
    if "--xlsform-bilingue" in sys.argv:
        i = sys.argv.index("--xlsform-bilingue")
        xlsform_bilingue(sys.argv[1], sys.argv[i + 1], charger_traduction())
        return
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        sys.exit(__doc__)
    sortie = Path(args[1]) if len(args) > 1 else ICI / "index.html"
    form = convertir(args[0])
    form["controles"] = controler(form, corriger="--sans-corrections" not in sys.argv)
    form["i18n"] = {"en": charger_traduction()}
    donnees = json.dumps(form, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    gabarit = (ICI / "app.html").read_text(encoding="utf-8")
    html = gabarit.replace("/*FORMULAIRE*/null", donnees)
    if "--artifact" not in sys.argv:
        html = ('<!doctype html>\n<html lang="fr"><head><meta charset="utf-8">\n'
                '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
                '</head><body>\n' + html + "\n</body></html>\n")
    sortie.write_text(html, encoding="utf-8")
    n = sum(len(v) for v in form["choices"].values())
    print(f"{sortie} : {len(form['survey'])} lignes survey, {n} choix, {sortie.stat().st_size // 1024} Ko")


if __name__ == "__main__":
    main()
