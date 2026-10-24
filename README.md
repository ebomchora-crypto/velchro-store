# Velchro — loja de roupas

Site estático (HTML + CSS + JS puro, sem build). Inspirado no conceito de "loja de verdade": as peças ficam penduradas num cabideiro, balançam com a física das molas, giram de lado para frente e mostram frente/costas.

## Rodar
Abra `index.html` no navegador, ou sirva a pasta (`npx serve .`). Deploy em Netlify/Vercel/GitHub Pages: publique a raiz.

## Editar a loja
- `js/products.js` — nomes, preços, cores, estampas, número do WhatsApp (`whatsapp`) e frases da faixa inferior.
- `js/garments.js` — desenho das peças (tee, long, tank, hoodie, jersey, varsity).
- `css/styles.css` — cores (`:root`), tipografia e layout.

## Interações
Arrastar/rolar o cabideiro · passar o mouse separa os cabides · clicar abre a peça · setas ← → trocam de peça · arrastar na peça gira · Esc fecha · sacola salva no navegador e finaliza pelo WhatsApp.
