#!/usr/bin/env python3
"""Build app/js/config-data.js from the authoritative JSON configuration files."""
import json, os
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
def load(rel):
    with open(os.path.join(ROOT, 'config', rel), encoding='utf-8') as f: return json.load(f)
master=load('master-config.json')
config={
  'lesson_catalog':load(master['files']['lesson_catalog']),
  'calculation_rules':load(master['files']['calculation_rules']),
  'brand_config':load(master['files']['brand_config']),
  'diagnostic_difficulty_maps':{},
  'diagnostic_templates':{}
}
for rel in master['files'].get('diagnostic_difficulty_maps', []):
    d=load(rel); config['diagnostic_difficulty_maps'][d['template_id']]=d
for rel in master['files']['diagnostic_templates']:
    d=load(rel); config['diagnostic_templates'][d['test_id']]=d
out='// GENERATED from /config/*.json. Do not edit manually.\nwindow.TP_CONFIG = '+json.dumps(config,indent=2,ensure_ascii=False)+';\n'
path=os.path.join(ROOT,'app','js','config-data.js')
with open(path,'w',encoding='utf-8') as f:f.write(out)
print('wrote',path)
