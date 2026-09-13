import os
import re

directory = r"e:\ai_project_git\frontend\pages"
pattern = re.compile(r'userName=\{localStorage\.getItem\((.*?)\)\s*\|\|\s*(".*?")\}')
replacement = r'userName={typeof window !== "undefined" ? (localStorage.getItem(\1) || \2) : \2}'

for root, _, files in os.walk(directory):
    for file in files:
        if file.endswith(".js"):
            path = os.path.join(root, file)
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            
            new_content = pattern.sub(replacement, content)
            
            if new_content != content:
                with open(path, "w", encoding="utf-8") as f:
                    f.write(new_content)
                print(f"Fixed {path}")
