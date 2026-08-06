import build_final_clean_60p_report as b

with open('scripts/build_final_clean_60p_report.py', 'r', encoding='utf-8') as f:
    code_orig = f.read()

for sz in [8.35, 8.37, 8.38, 8.4, 8.42]:
    code = code_orig
    # replace font.size in code blocks
    import re
    code = re.sub(r'font\.size = Pt\(\d+\.?\d*\)', f'font.size = Pt({sz})', code)
    with open('scripts/build_final_clean_60p_report.py', 'w', encoding='utf-8') as f:
        f.write(code)
    
    doc_path = b.create_report()
    pages = b.measure_word_pages(doc_path)
    print(f"Font size {sz}: MS Word Pages = {pages}")
    if pages == 60:
        print(f"SUCCESS: Locked at font size {sz}pt!")
        break
