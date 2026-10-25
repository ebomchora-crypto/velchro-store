# Velchro — loja de roupas em 3D

Site estático (sem build). O cabideiro é uma cena WebGL (three.js) com peças 3D penduradas num arco de meia-lua.

## Rodar
Sirva a pasta por HTTP (módulos ES não abrem via `file://`): `npx serve .` ou `python3 -m http.server`. Deploy: publique a raiz (Vercel/Netlify/GitHub Pages).

## Catálogo
- `js/products.js` — 5 modelos 3D (`models`) e 24 peças (`products`). Para criar uma peça nova basta repetir um modelo com outra cor (`color`, e `gray: true` para tirar a cor original da textura antes de tingir), nome e preço. O número do WhatsApp (`whatsapp`) fica aí também.
- `assets/models/*.glb` — modelos já otimizados (~1 MB cada).
- `tools/` — conversão dos modelos originais (OBJ/GLB de 15–50 MB) para GLB leve: `node tools/obj-to-glb.mjs entrada.obj saida.glb basecolor.jpg normal.png 30000` (precisa de `sharp`, `meshoptimizer`, `@gltf-transform/core`).
- `js/vendor/three-bundle.js` — three.js 0.186 + GLTFLoader + RoomEnvironment empacotados com esbuild.
- `js/landing.js` + `js/vendor/motion-bundle.js` — landing: Lenis (rolagem suave), GSAP 3.15 + ScrollTrigger (animações), seções de conteúdo.

## Interações
Roda do mouse sobre o cabideiro (ou arrastar) gira o arco · mouse sobre uma peça traz ela de frente · clique abre (frente/costas, tamanho, sacola) · setas ← → trocam de peça · arrastar na peça aberta gira · Esc fecha · a sacola fecha o pedido pelo WhatsApp.
