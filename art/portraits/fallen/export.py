"""Export the seven fallen hero portraits without altering their painted sources."""
import argparse
import json
import subprocess
import tempfile
from pathlib import Path

source_dir = Path(__file__).resolve().parent
root = source_dir.parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
manifest = json.loads((source_dir / 'generation.json').read_text())
with tempfile.TemporaryDirectory() as temporary:
    target = Path(temporary) if args.check else root / 'img/portraits/fallen'
    target.mkdir(parents=True, exist_ok=True)
    for identity, entry in manifest['portraits'].items():
        output = target / f'{identity}.webp'
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
                        '-i', str(source_dir / entry['source']), '-vf', 'scale=512:512:flags=lanczos',
                        '-c:v', 'libwebp', '-quality', '85', str(output)], check=True)
        if args.check and output.read_bytes() != (root / 'img/portraits/fallen' / output.name).read_bytes():
            raise SystemExit(f'Stale fallen portrait: {identity}')
    print(f'{len(manifest["portraits"])} fallen portraits {"verified" if args.check else "exported"}.')
