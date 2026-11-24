#!/usr/bin/env python3
"""组装 Windows / Android 客户端（Tauri）的前端目录 app/www。

仓库不含素材（见 AGENTS.md），本地也很少有完整 assets-raw，所以客户端不重跑 build.py：
- 界面代码直接用仓库 src/（含本次改动）；
- 12 个素材库的 JSON 数据从线上站点下载后打包进客户端（离线可浏览条目和提示词）；
- 图片仍从线上图床加载：相对路径的 m/i 指向主站，t 指向 R2 图床，o 经 app.js 的 AH 前缀走 R2。
用法：python3 scripts/build-app.py [输出目录，默认 app/www]
环境变量：POSEWEAR_SITE（默认 https://posewear.pages.dev）、POSEWEAR_ASSET_HOST（默认 https://pwimg.0vo.pro）
"""
import json, os, re, shutil, sys, urllib.request

SITE = os.environ.get('POSEWEAR_SITE', 'https://posewear.pages.dev').rstrip('/')
AH = os.environ.get('POSEWEAR_ASSET_HOST', 'https://pwimg.0vo.pro').rstrip('/')
OUT = sys.argv[1] if len(sys.argv) > 1 else 'app/www'
UA = {'User-Agent': 'Mozilla/5.0 (posewear-app-build)'}

def get(url):
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return r.read()
        except Exception as e:
            if i == 3: raise
            print('retry', url, e)

def absol(x, key):
    if isinstance(x, dict):
        return {k: absol(v, k) for k, v in x.items()}
    if isinstance(x, list):
        return [absol(v, key) for v in x]
    if isinstance(x, str) and x and not x.startswith(('http://', 'https://', 'data:')) and re.search(r'\.(webp|png|jpe?g)$', x):
        if key in ('m', 'i'): return SITE + '/' + x
        if key == 't': return AH + '/' + x
    return x

if os.path.exists(OUT): shutil.rmtree(OUT)
os.makedirs(OUT)
for f in os.listdir('src'):
    shutil.copy(os.path.join('src', f), OUT)

idx = get(SITE + '/').decode()
m = re.search(r'/assets/app\.[0-9a-f]+\.js', idx)
if not m: sys.exit('线上首页里找不到 app.js，无法定位数据文件')
app_prod = get(SITE + m.group(0)).decode()
names = sorted(set(re.findall(r'/assets/([a-z]+)\.([0-9a-f]+)\.json', app_prod)))
if len(names) < 5: sys.exit('线上数据文件太少：%r' % names)
for base, h in names:
    data = json.loads(get(f'{SITE}/assets/{base}.{h}.json'))
    data = absol(data, None)
    with open(os.path.join(OUT, base + '.json'), 'w', encoding='utf-8') as fp:
        json.dump(data, fp, ensure_ascii=False, separators=(',', ':'))
    print('data', base, len(data))

app = open(os.path.join(OUT, 'app.js'), encoding='utf-8').read()
assert "const AH='';" in app
app = app.replace("const AH='';", f"const AH='{AH}/';")
open(os.path.join(OUT, 'app.js'), 'w', encoding='utf-8').write(app)
os.remove(os.path.join(OUT, 'sw.js'))  # 客户端不用 Service Worker
print('OK ->', OUT)
