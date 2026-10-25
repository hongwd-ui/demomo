"""Run a real opaque direct-solar preview with explicit sun input, not weather data."""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import tempfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--worker', required=True, type=Path)
    parser.add_argument('--scene', required=True, type=Path)
    parser.add_argument('--sun', required=True, nargs=3, type=float, metavar=('E','N','U'))
    parser.add_argument('--dni', required=True, type=float)
    parser.add_argument('--task-root', type=Path)
    args = parser.parse_args()
    scene = json.loads(args.scene.read_text(encoding='utf-8'))
    task_root = args.task_root or Path(tempfile.mkdtemp(prefix='zhitan-preview-'))
    task_root.mkdir(parents=True, exist_ok=True)
    target = task_root/'scene.json'
    if target.resolve() != args.scene.resolve():
        if target.exists():
            parser.error('task-root already contains scene.json; use a new directory')
        shutil.copyfile(args.scene, target)
    request = {'protocol_version':1, 'request_id':'cli-preview', 'type':'analysis.start',
        'model_id':scene['model_id'], 'scene_revision':scene['scene_revision'],
        'payload':{'scene_path':'scene.json', 'mode':'direct_preview',
        'settings':{'sun_direction_enu':args.sun, 'dni_w_m2':args.dni}}}
    process = subprocess.Popen([str(args.worker.resolve()),str(task_root.resolve())],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
    try:
        process.stdin.write(json.dumps(request, allow_nan=False)+'\n');process.stdin.flush()
        while True:
            raw = process.stdout.readline()
            if not raw:
                raise RuntimeError('Worker exited without a valid result')
            event = json.loads(raw)
            if event['type'] in ('request.error','job.error'):
                raise RuntimeError(event['payload'].get('code','Worker failed'))
            if event['type'] == 'job.result':
                result_file=(task_root/event['payload']['result_path']).resolve()
                result_file.relative_to(task_root.resolve())
                if not result_file.is_file():
                    raise RuntimeError('Result file missing')
                print(json.dumps({'result_file':str(result_file),'quality':'direct_preview'}))
                break
    finally:
        process.stdin.close()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill();process.wait()
        process.stdout.close()

if __name__ == '__main__':
    main()
