#!/usr/bin/env python3
"""Bundle each app's tracked source files into one readable .txt.

Run it from anywhere:  python3 tools-export-source.py
Writes <App>-source-code.txt next to this script. The outputs are gitignored -
they're a snapshot for reading offline, regenerate them whenever you want a
current copy.
"""
import os, subprocess, datetime

ROOT = os.path.dirname(os.path.abspath(__file__))
SKIP_EXT = {'.png', '.jpg', '.jpeg', '.ico', '.zip', '.pdf', '.gif', '.webp', '.mp3', '.wav'}
SKIP_NAME = {'package-lock.json'}


def tracked(prefix):
    out = subprocess.run(['git', 'ls-files', prefix], cwd=ROOT,
                         capture_output=True, text=True, check=True).stdout.split('\n')
    files = []
    for f in out:
        if not f.strip():
            continue
        if os.path.basename(f) in SKIP_NAME:
            continue
        if os.path.splitext(f)[1].lower() in SKIP_EXT:
            continue
        files.append(f)
    # Code first, bulk content last, so the file opens on something readable.
    def rank(f):
        if f.endswith('.md'):
            return 0
        if '/data/' in f:
            return 3
        if f.endswith(('.js', '.json')) and '/server/' in f:
            return 1
        return 2
    return sorted(files, key=lambda f: (rank(f), f))


def build(prefix, title, out_path):
    files = tracked(prefix)
    stamp = datetime.date.today().isoformat()
    ver = subprocess.run(['git', 'rev-parse', '--short', 'HEAD'], cwd=ROOT,
                         capture_output=True, text=True).stdout.strip()
    parts = []
    head = []
    head.append('=' * 78)
    head.append(title)
    head.append('Complete source code')
    head.append(f'Exported {stamp}   ·   commit {ver}')
    head.append('=' * 78)
    head.append('')
    head.append('CONTENTS')
    head.append('')
    total = 0
    for i, f in enumerate(files, 1):
        n = os.path.getsize(os.path.join(ROOT, f))
        total += n
        head.append(f'  {i:>2}. {f}   ({n:,} bytes)')
    head.append('')
    head.append(f'  {len(files)} files, {total:,} bytes total.')
    head.append('')
    head.append('Each file below starts with a line of ===== and its path,')
    head.append('so you can search this document for a filename to jump to it.')
    head.append('')
    parts.append('\n'.join(head))

    for i, f in enumerate(files, 1):
        with open(os.path.join(ROOT, f), encoding='utf-8', errors='replace') as fh:
            body = fh.read()
        parts.append('\n' + '=' * 78 + f'\nFILE {i} of {len(files)}:  {f}\n' + '=' * 78 + '\n\n' + body)

    text = '\n'.join(parts).rstrip() + '\n\n' + '=' * 78 + f'\nEND OF {title}\n' + '=' * 78 + '\n'
    with open(out_path, 'w', encoding='utf-8') as fh:
        fh.write(text)
    print(f'{out_path}: {len(files)} files, {len(text):,} chars, {os.path.getsize(out_path):,} bytes')


def app_version(prefix):
    """Read the app's own version so the header never goes stale."""
    try:
        import json
        with open(os.path.join(ROOT, prefix, 'package.json'), encoding='utf-8') as fh:
            return '  \u2014  v' + json.load(fh)['version']
    except Exception:
        return ''


if __name__ == '__main__':
    build('TurnSomeDayIntoOneday', 'TURN SOMEDAY INTO DAY ONE' + app_version('TurnSomeDayIntoOneday'),
          os.path.join(ROOT, 'TurnSomeDayIntoOneday-source-code.txt'))
    build('Studio', 'STUDIO  \u2014  creator workspace' + app_version('Studio'),
          os.path.join(ROOT, 'Studio-source-code.txt'))
