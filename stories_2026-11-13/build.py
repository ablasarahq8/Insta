"""يبني HTML الستوري من spec.json باستخدام سكربت المهارة (بدون التصيير)."""
import json, sys
from pathlib import Path

SKILL = "/root/.claude/skills/synced/8c29388b-8a6a-410a-9570-ad363e27fe3e_5a3f7d6a-ed40-42bc-919e-59691b8aa3e3/stories-and-scripts/scripts"
sys.path.insert(0, SKILL)
import build_stories as b  # noqa: E402

here = Path(__file__).parent
spec = json.loads((here / "spec.json").read_text(encoding="utf-8"))
page, flags = b.build_html(spec)
(here / "stories.html").write_text(page, encoding="utf-8")
(here / "script.md").write_text(b.build_script_md(spec), encoding="utf-8")
print("frames:", len(flags))
for w in b.WARN:
    print("WARN", w)
