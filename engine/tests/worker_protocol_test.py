"""Exercise the real NDJSON worker, scene IO and cancellation boundary."""
import json
import pathlib
import subprocess
import sys
import tempfile
import unittest

class WorkerTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.tmp.name)
        self.scene = {
            'schema_version': 1, 'model_id': 'm1', 'scene_revision': 2,
            'coordinate_system': 'local_enu_m',
            'surfaces': [{'id': 'floor', 'triangles': [[[0,0,0],[2,0,0],[0,2,0]]]}],
        }
        (self.root / 'scene.json').write_text(json.dumps(self.scene))
        self.process = subprocess.Popen([sys.argv[1], str(self.root)], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    def tearDown(self):
        self.process.stdin.close()
        self.process.wait(timeout=10)
        self.process.stdout.close()
        self.process.stderr.close()
        self.tmp.cleanup()
    def request(self, **payload):
        request = {'protocol_version':1,'request_id':'r1','type':'analysis.start','model_id':'m1','scene_revision':2,'payload':{'scene_path':'scene.json','mode':'direct_preview','settings':{'sun_direction_enu':[0,0,1],'dni_w_m2':800},**payload}}
        self.process.stdin.write(json.dumps(request)+'\n'); self.process.stdin.flush()
        return json.loads(self.process.stdout.readline())
    def test_computes_real_result_and_preserves_identity(self):
        accepted = self.request()
        self.assertEqual(accepted['type'], 'analysis.start')
        event = json.loads(self.process.stdout.readline())
        self.assertEqual(event['type'], 'job.result')
        self.assertEqual(event['scene_revision'], 2)
        result = json.loads((self.root/event['payload']['result_path']).read_text())
        self.assertEqual(result['samples'][0]['value'], 800)
        self.assertEqual(result['quality'], 'direct_preview')
        self.assertEqual(result['unit'], 'W_m2')
        self.assertEqual(result['model_id'], 'm1')
    def test_cancel_does_not_publish_a_completed_result(self):
        self.scene['surfaces'][0]['triangles'] = [[[i*3,0,0],[i*3+2,0,0],[i*3,2,0]] for i in range(6000)]
        (self.root/'scene.json').write_text(json.dumps(self.scene))
        accepted = self.request()
        job = accepted['payload']['job_id']
        self.process.stdin.write(json.dumps({'protocol_version':1,'request_id':'cancel','type':'analysis.cancel','model_id':'m1','scene_revision':2,'payload':{'job_id':job}})+'\n')
        self.process.stdin.flush()
        events = [json.loads(self.process.stdout.readline()), json.loads(self.process.stdout.readline())]
        self.assertEqual({event['type'] for event in events}, {'analysis.cancel', 'job.error'})
        failed = next(event for event in events if event['type']=='job.error')
        self.assertEqual(failed['payload']['code'], 'CANCELLED')
        self.assertFalse((self.root/job/'result.json').exists())
    def test_cli_runs_real_worker_and_returns_a_result_file(self):
        script = pathlib.Path(__file__).resolve().parents[2]/'scripts'/'run_direct_preview.py'
        task_root = self.root/'cli-job'
        completed = subprocess.run([sys.executable,str(script),'--worker',sys.argv[1],'--scene',str(self.root/'scene.json'),'--sun','0','0','1','--dni','800','--task-root',str(task_root)],capture_output=True,text=True,timeout=10)
        self.assertEqual(completed.returncode,0,completed.stderr)
        output=json.loads(completed.stdout)
        result=json.loads(pathlib.Path(output['result_file']).read_text())
        self.assertEqual(result['samples'][0]['value'],800)
    def test_rejects_path_traversal(self):
        self.assertEqual(self.request(scene_path='../scene.json')['type'], 'request.error')
    def test_rejects_absolute_paths(self):
        self.assertEqual(self.request(scene_path=str(self.root/'scene.json'))['type'], 'request.error')
    def test_rejects_symlink_escape(self):
        (self.root/'escape.json').symlink_to('/etc/passwd')
        self.assertEqual(self.request(scene_path='escape.json')['type'], 'request.error')
    def test_rejects_unsupported_professional_mode(self):
        self.assertEqual(self.request(mode='radiance_solar')['type'], 'request.error')
    def test_rejects_scene_identity_mismatch(self):
        self.scene['scene_revision'] = 1
        (self.root/'scene.json').write_text(json.dumps(self.scene))
        self.assertEqual(self.request()['type'], 'request.error')
    def test_rejects_oversized_message_then_remains_usable(self):
        self.process.stdin.write('x'*1048577+'\n');self.process.stdin.flush()
        self.assertEqual(json.loads(self.process.stdout.readline())['type'], 'request.error')
        self.assertEqual(self.request()['type'], 'analysis.start')
        self.assertEqual(json.loads(self.process.stdout.readline())['type'], 'job.result')
    def test_rejects_negative_dni_without_publishing_result(self):
        self.assertEqual(self.request(settings={'sun_direction_enu':[0,0,1],'dni_w_m2':-1})['type'], 'request.error')

if __name__ == '__main__':
    unittest.main(argv=[sys.argv[0]])
