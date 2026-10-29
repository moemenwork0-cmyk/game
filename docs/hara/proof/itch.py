import sys, re, json, urllib.request, http.cookiejar, urllib.parse
page = sys.argv[1].rstrip('/'); out = sys.argv[2]; filt = sys.argv[3] if len(sys.argv) > 3 else ""
cj = http.cookiejar.CookieJar(); op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
op.addheaders = [("User-Agent", "Mozilla/5.0")]
def csrf(h): return (re.search(r'name="csrf_token" value="([^"]+)"', h) or re.search(r'csrf_token":"([^"]+)"', h)).group(1)
html = op.open(page).read().decode()
r = json.loads(op.open(page + "/download_url", urllib.parse.urlencode({"csrf_token": csrf(html)}).encode()).read())
d = op.open(r["url"]).read().decode()
ups = re.findall(r'data-upload_id="(\d+)"', d); names = re.findall(r'class="name" title="([^"]+)"', d)
print(list(zip(ups, names)))
for u, n in zip(ups, names):
    if filt and filt not in n: continue
    j = json.loads(op.open(f"{page}/file/{u}?source=game_download", urllib.parse.urlencode({"csrf_token": csrf(d)}).encode()).read())
    data = op.open(j["url"]).read(); open(f"{out}/{n}", "wb").write(data); print("saved", n, len(data))
