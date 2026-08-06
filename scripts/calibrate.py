import build_final_clean_60p_report as b

with open('scripts/build_final_clean_60p_report.py', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace("font.size = Pt(8.35)", "font.size = Pt(8.3)")
if "useRealtime.ts" not in code:
    code = code.replace(
        '("9. 3D Building Geometry Definitions (apps/web/src/features/digital-twin/building-geometry.ts)", "apps/web/src/features/digital-twin/building-geometry.ts")',
        '("9. 3D Building Geometry Definitions (apps/web/src/features/digital-twin/building-geometry.ts)", "apps/web/src/features/digital-twin/building-geometry.ts"),\n        ("10. Web Application Realtime Hook (apps/web/src/hooks/useRealtime.ts)", "apps/web/src/hooks/useRealtime.ts")'
    )

with open('scripts/build_final_clean_60p_report.py', 'w', encoding='utf-8') as f:
    f.write(code)

doc_path = b.create_report()
pages = b.measure_word_pages(doc_path)
print(f"RESULT WITH 10 MODULES (8.3pt): MS WORD PAGE COUNT = {pages} PAGES")
