"""Package the current UI and Ruby adapter; native engines are separate."""
import argparse
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, default=root/'artifacts'/'zhitan-0.1.0.rbz')
args = parser.parse_args()
if not (root/'dist-sketchup'/'index.html').is_file():
    parser.error('Build the host UI first with npm run build:sketchup')
args.output.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(args.output, 'w', zipfile.ZIP_DEFLATED) as package:
    package.write(root/'sketchup'/'zhitan.rb', 'zhitan.rb')
    for file in sorted((root/'sketchup'/'zhitan').glob('*.rb')):
        package.write(file, 'zhitan/'+file.name)
    for file in sorted((root/'dist-sketchup').rglob('*')):
        if file.is_file():
            relative=file.relative_to(root/'dist-sketchup').as_posix()
            if relative=='index.html':
                # IIFE bundle deliberately uses a classic deferred script for older CEF/file loading.
                html=file.read_text().replace('type="module" crossorigin', 'defer').replace('rel="stylesheet" crossorigin', 'rel="stylesheet"')
                package.writestr('zhitan/ui/index.html',html)
            else:
                package.write(file,'zhitan/ui/'+relative)
print(args.output)
print('Development adapter only. SketchUp versions unverified; native worker not bundled.')
