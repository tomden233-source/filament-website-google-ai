import os
import sys
import zipfile

def export_zip(target_zip):
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    exclude_dirs = {'.git', 'node_modules', 'dist', '.aistudio', '.cache'}
    exclude_files = {'.DS_Store'}

    # Ensure parent dir exists
    os.makedirs(os.path.dirname(os.path.abspath(target_zip)), exist_ok=True)

    with zipfile.ZipFile(target_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(root_dir):
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            for file in files:
                if file in exclude_files:
                    continue
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, root_dir)
                zipf.write(full_path, rel_path)

if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else '/tmp/FilamentHub_v1.52_HAOS_Addon.zip'
    export_zip(target)
    print("OK")
