# GitHub Personal Access Token - Schritt für Schritt

## 🎯 Warum ein Token?

GitHub erlaubt seit 2021 kein Passwort mehr für Git-Operationen. Du benötigst einen Personal Access Token.

---

## 📝 Schritt-für-Schritt Anleitung

### Schritt 1: Gehe zu den Token-Einstellungen

1. Öffne deinen Browser
2. Gehe zu: **https://github.com/settings/tokens**
3. Du musst eingeloggt sein

### Schritt 2: Neuen Token erstellen

1. Klicke auf **"Generate new token"** (oben rechts)
2. Wähle **"Generate new token (classic)"**

### Schritt 3: Token konfigurieren

1. **Note** (Name): Gib einen beschreibenden Namen ein, z.B.:
   - `X-Flagr Extension Development`
   - `X-Flagr Repository Access`

2. **Expiration** (Ablaufzeit):
   - Wähle eine Dauer (z.B. "90 days")
   - Oder "No expiration" (wenn du willst, dass er nie abläuft)

3. **Select scopes** (Berechtigungen):
   - ✅ **WICHTIG**: Aktiviere `repo` (vollständiger Zugriff auf Repositories)
   - Das gibt dir alle Berechtigungen für private und öffentliche Repositories

### Schritt 4: Token generieren

1. Scrolle nach unten
2. Klicke auf **"Generate token"** (grüner Button)

### Schritt 5: Token kopieren

⚠️ **WICHTIG**: Der Token wird nur EINMAL angezeigt!

1. **Kopiere den Token sofort** (er beginnt mit `ghp_...`)
2. Speichere ihn an einem sicheren Ort (z.B. Passwort-Manager)
3. Du wirst ihn beim `git push` als Passwort verwenden

---

## 🔐 Token verwenden

Wenn du `git push` ausführst:

1. **Username**: Dein GitHub-Benutzername (z.B. `Lomaxxx-xflagr`)
2. **Password**: Der Token (nicht dein GitHub-Passwort!)

---

## ✅ Beispiel

```
Username: Lomaxxx-xflagr
Password: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 🆘 Hilfe

Falls du Probleme hast:
- Stelle sicher, dass `repo` Scope aktiviert ist
- Prüfe, ob der Token nicht abgelaufen ist
- Erstelle einen neuen Token, falls nötig

---

**Sag mir Bescheid, sobald du den Token hast, dann führe ich die Git-Befehle für dich aus!** 🚀

