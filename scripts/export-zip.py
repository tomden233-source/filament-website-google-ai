import fnmatch
import os
import sys
import zipfile

# Nie in den Download aufnehmen: Zugangsdaten, lokale Laufzeitdaten und Build-/Cache-Ordner.
EXCLUDE_DIRS = {'.git', 'node_modules', 'dist', '.aistudio', '.cache', 'data'}
EXCLUDE_FILE_PATTERNS = [
    '.DS_Store',
    '.env', '.env.*',                # Umgebungsvariablen (die Vorlage .env.example bleibt erlaubt)
    '.git-credentials*.json',        # GitHub-Token
    '.bambu-config*.json',           # Bambu-Zugangsdaten
    '.ha-config*.json',              # Home-Assistant-Token
    '*.pem', '*.key', '*.p12',       # Schlüssel und Zertifikate
]
ALLOWED_EXAMPLES = {'.env.example', '.git-credentials.example.json', '.bambu-config.example.json'}


def is_excluded_file(name):
    if name in ALLOWED_EXAMPLES:
        return False
    return any(fnmatch.fnmatch(name, pattern) for pattern in EXCLUDE_FILE_PATTERNS)


def export_zip(target_zip):
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    # Ensure parent dir exists
    os.makedirs(os.path.dirname(os.path.abspath(target_zip)), exist_ok=True)

    with zipfile.ZipFile(target_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(root_dir):
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            for file in files:
                if is_excluded_file(file):
                    continue
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, root_dir)
                zipf.write(full_path, rel_path)


if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else '/tmp/FilamentHub_v1.53_HAOS_Addon.zip'
    export_zip(target)
    print("OK")
