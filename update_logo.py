import os
import glob

html_files = glob.glob(r'd:\pagina web\frontend\*.html')

for file in html_files:
    with open(file, 'r', encoding='utf-8') as f:
        c = f.read()
    
    # Reemplaza la etiqueta de apertura
    c = c.replace('<div class="logo-container">', '<a href="index.html" class="logo-container" style="text-decoration: none;">')
    
    # Reemplaza la de cierre que está justo antes del nav-links
    old_closing = '''                </div>
            </div>
            <nav class="nav-links">'''
    
    new_closing = '''                </div>
            </a>
            <nav class="nav-links">'''
            
    c = c.replace(old_closing, new_closing)
    
    with open(file, 'w', encoding='utf-8') as f:
        f.write(c)
