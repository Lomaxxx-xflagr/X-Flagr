# GitHub Veröffentlichungs-Anleitung für X-Flagr

Diese Anleitung führt dich Schritt für Schritt durch die Veröffentlichung deiner Extension auf GitHub.

## 📋 Voraussetzungen

Bevor wir starten, benötigst du:

1. ✅ **GitHub Account** - Falls noch nicht vorhanden, erstelle einen auf [github.com](https://github.com)
2. ✅ **Git installiert** - Prüfe mit `git --version` im Terminal
3. ✅ **Repository erstellt** - Du hast bereits das Repository `Lomaxxx-xflagr/X-Flagr` erstellt

---

## 🚀 Schritt-für-Schritt Anleitung

### Schritt 1: Git Repository initialisieren

Öffne das Terminal (oder Command Prompt) und navigiere zu deinem Projekt-Ordner:

```bash
cd "/Volumes/T7-MBP-2TB/Downloads/Xcom Mod Extension"
```

Initialisiere ein Git-Repository:

```bash
git init
```

### Schritt 2: Alle Dateien hinzufügen

Füge alle Dateien zum Git-Repository hinzu:

```bash
git add .
```

**Hinweis**: Die `.gitignore` Datei sorgt dafür, dass unnötige Dateien (wie BACKUP/, .DS_Store, etc.) nicht hochgeladen werden.

### Schritt 3: Ersten Commit erstellen

Erstelle den ersten Commit (Snapshot) deines Projekts:

```bash
git commit -m "Initial commit: X-Flagr v1.0.1 - Complete moderation tool for X.com communities"
```

### Schritt 4: Remote Repository verbinden

Verbinde dein lokales Repository mit dem GitHub-Repository:

```bash
git remote add origin https://github.com/Lomaxxx-xflagr/X-Flagr.git
```

**Wichtig**: Falls du SSH verwendest, wäre die URL: `git@github.com:Lomaxxx-xflagr/X-Flagr.git`

### Schritt 5: Branch benennen (optional, aber empfohlen)

Benenne den Haupt-Branch zu "main" (GitHub Standard):

```bash
git branch -M main
```

### Schritt 6: Code hochladen (Push)

Lade deinen Code auf GitHub hoch:

```bash
git push -u origin main
```

**Hinweis**: Beim ersten Push wirst du nach deinem GitHub-Benutzernamen und Passwort/Token gefragt.

---

## 🔐 GitHub Authentifizierung

### Option 1: Personal Access Token (Empfohlen)

1. Gehe zu GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Klicke "Generate new token (classic)"
3. Wähle Scopes: `repo` (vollständiger Zugriff auf Repositories)
4. Kopiere den Token
5. Verwende den Token als Passwort beim `git push`

### Option 2: GitHub CLI (Einfacher)

Installiere GitHub CLI und authentifiziere dich:

```bash
# Installation (macOS)
brew install gh

# Authentifizierung
gh auth login
```

Dann kannst du normal `git push` verwenden.

---

## ✅ Nach dem ersten Push

Nach erfolgreichem Push:

1. **Gehe zu deinem Repository**: https://github.com/Lomaxxx-xflagr/X-Flagr
2. **Prüfe die Dateien**: Alle Dateien sollten jetzt sichtbar sein
3. **README.md**: Sollte automatisch auf der Hauptseite angezeigt werden
4. **Screenshots**: Sollten im Repository sichtbar sein

---

## 📝 Zukünftige Updates

Wenn du Änderungen gemacht hast und diese hochladen möchtest:

```bash
# 1. Status prüfen (welche Dateien wurden geändert?)
git status

# 2. Geänderte Dateien hinzufügen
git add .

# 3. Commit erstellen (mit beschreibender Nachricht)
git commit -m "Beschreibung deiner Änderungen"

# 4. Hochladen
git push
```

---

## 🎯 Erste Release erstellen

Nach dem ersten Push kannst du ein Release erstellen:

1. Gehe zu deinem Repository auf GitHub
2. Klicke auf "Releases" (rechts in der Sidebar)
3. Klicke "Create a new release"
4. Tag: `v1.0.1`
5. Titel: `X-Flagr v1.0.1 - Quick-Mark & Advanced Analytics`
6. Beschreibung: Kopiere den Inhalt aus `RELEASE_NOTES.md`
7. Klicke "Publish release"

---

## 🆘 Häufige Probleme

### Problem: "Permission denied"
**Lösung**: Prüfe deine GitHub-Credentials oder verwende einen Personal Access Token

### Problem: "Repository not found"
**Lösung**: Stelle sicher, dass das Repository `Lomaxxx-xflagr/X-Flagr` existiert und du Zugriff hast

### Problem: "Large files"
**Lösung**: Prüfe die `.gitignore` - große Dateien sollten ignoriert werden

---

## 📞 Hilfe benötigt?

Falls du Probleme hast, kann ich dir helfen:
- Terminal-Befehle ausführen
- Fehlermeldungen analysieren
- Schritt-für-Schritt durch den Prozess führen

**Sag mir einfach Bescheid, wenn du bereit bist!** 🚀

