/* Catálogo. Troque nomes, preços e estampas aqui; o cabideiro se monta sozinho. */
window.VELCHRO = {
  whatsapp: '5500000000000', // número da loja com DDI + DDD (somente dígitos)
  sizes: ['P', 'M', 'G', 'GG'],
  ticker: ['Velchro', 'Feito pra quem fica', 'Novo drop', 'Peças limitadas', 'Envio para todo o Brasil'],
  products: [
    {
      id: 'concreto', name: 'Camiseta Boxy Concreto', price: 149, type: 'tee',
      color: '#8d9094', tag: { bg: '#ff3d12', fg: '#fff' },
      print: {
        front: [{ t: 'VELCHRO®', x: 262, y: 170, s: 14, fill: '#151513', ls: 1.5, distress: false }],
        back: [
          { t: 'FEITO', x: 200, y: 215, s: 58, fill: '#151513', ls: -1 },
          { t: 'EM', x: 200, y: 268, s: 58, fill: '#151513', ls: -1 },
          { t: 'CONCRETO', x: 200, y: 321, s: 58, fill: '#151513', ls: -2 },
        ],
      },
    },
    {
      id: 'ferrugem', name: 'Moletom Capuz Ferrugem', price: 289, type: 'hoodie',
      color: '#a8431f', trim: '#efe9d6', tag: { bg: '#efe9d6', fg: '#151513' },
      print: {
        front: [{ t: 'VELCHRO CLUB', x: 200, y: 330, s: 15, fill: '#efe9d6', ls: 3, distress: false }],
        back: [
          { t: 'V', x: 200, y: 340, s: 210, fill: '#efe9d6', ls: 0 },
          { t: 'NÃO É SORTE', x: 200, y: 392, s: 17, fill: '#efe9d6', ls: 3.5, font: 'reg', distress: false },
        ],
      },
    },
    {
      id: 'noite', name: 'Regata Noite', price: 119, type: 'tank',
      color: '#18181b', tag: { bg: '#d6ff3a', fg: '#151513' },
      print: {
        front: [
          { t: 'NOITE', x: 200, y: 300, s: 46, fill: '#f2efe6', ls: 1 },
          { t: 'SEM HORA PRA VOLTAR', x: 200, y: 326, s: 11, fill: '#f2efe6', ls: 3.2, font: 'reg', distress: false },
        ],
        back: [{ t: 'V', x: 200, y: 300, s: 120, fill: '#f2efe6' }],
      },
    },
    {
      id: 'jersey', name: 'Camisa Jersey 07', price: 219, type: 'jersey',
      color: '#f4c20d', trim: '#12110f', tag: { bg: '#12110f', fg: '#f4c20d' },
      print: {
        front: [
          { t: '07', x: 200, y: 330, s: 130, fill: '#12110f', ls: -4 },
          { t: 'VELCHRO', x: 200, y: 372, s: 18, fill: '#12110f', ls: 8, distress: false },
        ],
        back: [
          { t: 'VELCHRO', x: 200, y: 200, s: 26, fill: '#12110f', ls: 6, distress: false },
          { t: '07', x: 200, y: 340, s: 170, fill: '#12110f', ls: -6 },
        ],
      },
    },
    {
      id: 'varsity', name: 'Jaqueta Varsity Floresta', price: 459, type: 'varsity',
      color: '#1d3a2f', sleeve: '#e8e2d0', trim: '#ff3d12', tag: { bg: '#ff3d12', fg: '#fff' },
      print: {
        front: [{ t: 'V', x: 256, y: 226, s: 64, fill: '#e8e2d0', distress: false }],
        back: [
          { t: 'VELCHRO', x: 200, y: 258, s: 52, fill: '#e8e2d0', ls: -1, distress: false },
          { t: 'FEITO PRA QUEM FICA', x: 200, y: 288, s: 13, fill: '#ff3d12', ls: 4.5, font: 'reg', distress: false },
        ],
      },
    },
    {
      id: 'musgo', name: 'Manga Longa Musgo', price: 169, type: 'long',
      color: '#5d6b4a', tag: { bg: '#efe9d6', fg: '#151513' },
      print: {
        front: [{ t: 'VELCHRO®', x: 262, y: 168, s: 14, fill: '#efe9d6', ls: 1.5, distress: false }],
        back: [
          { t: 'SILÊNCIO', x: 200, y: 214, s: 40, fill: '#efe9d6', ls: -1 },
          { t: 'BARULHO', x: 200, y: 258, s: 40, fill: '#efe9d6', ls: -1 },
        ],
      },
    },
    {
      id: 'osso', name: 'Camiseta Osso Gráfica', price: 139, type: 'tee',
      color: '#e6dec9', tag: { bg: '#151513', fg: '#efe9d6' },
      print: {
        front: [{
          k: 'raw', svg: `<circle cx="200" cy="300" r="64" fill="none" stroke="#151513" stroke-width="9"/>
            <path d="M168,262 L200,338 L232,262" fill="none" stroke="#ff3d12" stroke-width="14" stroke-linejoin="miter"/>
            <path d="M120,300 H280" stroke="#151513" stroke-width="3"/>`,
        }],
        back: [{ t: 'SEM ROTEIRO', x: 200, y: 200, s: 30, fill: '#151513', ls: 1 }],
      },
    },
    {
      id: 'chiclete', name: 'Camiseta Chiclete', price: 139, type: 'tee',
      color: '#f08fb3', tag: { bg: '#2a0f1c', fg: '#f08fb3' },
      print: {
        front: [
          { t: 'CHICLETE', x: 200, y: 290, s: 46, fill: '#2a0f1c', ls: -1 },
          { t: 'CLUB', x: 200, y: 338, s: 46, fill: '#2a0f1c', ls: 12 },
        ],
        back: [{ t: 'DOCE', x: 200, y: 230, s: 90, fill: '#2a0f1c', ls: -3 }],
      },
    },
  ],
};
