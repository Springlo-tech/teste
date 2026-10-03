// ============================================================
// AR LIVRO
// MindAR + WebGL + homografia + captura + textura + guia visual
// ============================================================


// ============================================================
// 1. CONFIGURAÇÕES
// ============================================================

const TARGET_ASPECT = 1.414;
const TEXTURA_TAMANHO = 1024;

// Quantos frames consecutivos em boa posição
// antes de capturar a pintura.
const FRAMES_ESTAVEIS_PARA_CAPTURA = 18;


// ============================================================
// 2. ELEMENTOS HTML
// ============================================================

const splash = document.getElementById('splash-screen');
const startButton = document.getElementById('start-button');
const erroEl = document.getElementById('erro');

const scene = document.getElementById('minha-cena');
const statusAR = document.getElementById('status-ar');

const modeloAtivo = document.getElementById('modelo-ativo');

const guiaBolinha = document.getElementById('guia-bolinha');
const guiaTexto = document.getElementById('guia-texto');

const overlayGuia = document.getElementById('overlay-guia');

const overlayCtx = overlayGuia
  ? overlayGuia.getContext('2d')
  : null;

const cornerElements = [
  document.getElementById('corner-0'),
  document.getElementById('corner-1'),
  document.getElementById('corner-2'),
  document.getElementById('corner-3')
];


// ============================================================
// 3. TABELA DOS PERSONAGENS
// ============================================================

const personagens = [
  {
    nome: 'Abóbora',
    targetId: 'targetA',
    targetIndex: 0,
    glb: 'assets/modelos/abobora.glb',
    scale: '0.6 0.6 0.6',
    position: '0 0 0',
    rotation: '0 0 0'
  },
  {
    nome: 'Bruxa',
    targetId: 'targetB',
    targetIndex: 1,
    glb: 'assets/modelos/bruxa.glb',
    scale: '0.5 0.5 0.5',
    position: '0 0 0',
    rotation: '0 0 0'
  },
  {
    nome: 'Fantasma',
    targetId: 'targetC',
    targetIndex: 2,
    glb: 'assets/modelos/fantasma.glb',
    scale: '0.6 0.6 0.6',
    position: '0 0 0',
    rotation: '0 0 0'
  },
  {
    nome: 'Morcego',
    targetId: 'targetD',
    targetIndex: 3,
    glb: 'assets/modelos/morcego.glb',
    scale: '0.5 0.5 0.5',
    position: '0 0 0',
    rotation: '0 0 0'
  },
  {
    nome: 'Múmia',
    targetId: 'targetE',
    targetIndex: 4,
    glb: 'assets/modelos/mumia.glb',
    scale: '0.6 0.6 0.6',
    position: '0 0 0',
    rotation: '0 0 0'
  },
  {
    nome: 'Vampiro',
    targetId: 'targetF',
    targetIndex: 5,
    glb: 'assets/modelos/vampiro.glb',
    scale: '0.6 0.6 0.6',
    position: '0 0 0',
    rotation: '0 0 0'
  }
];


// associa os objetos HTML aos personagens
personagens.forEach(personagem => {
  personagem.target =
    document.getElementById(
      personagem.targetId
    );
});


// ============================================================
// 4. ESTADO DO PERSONAGEM ATUAL
// ============================================================

let personagemAtual = null;
let targetAtivo = null;

let modeloCarregado = false;


// ============================================================
// 5. ESTADO
// ============================================================

let targetEncontrado = false;
let arIniciado = false;
let capturaRealizada = false;

let framesBons = 0;
let ultimoCentro = null;


// ============================================================
// 6. CÂMERA
// ============================================================

let cameraVideo = null;
let cameraTexture = null;


// ============================================================
// 7. PREVIEW WEBGL
// ============================================================

let previewCanvas = null;
let previewRenderer = null;
let previewScene = null;
let previewCamera = null;
let previewMaterial = null;

let uH0 = null;
let uH1 = null;
let uH2 = null;


// ============================================================
// 8. TEXTURA FINAL
// ============================================================

let canvasTexturaFinal = null;
let texturaFinal = null;


// ============================================================
// 9. ESPERAR A CENA CARREGAR
// ============================================================

function esperarCenaCarregar() {
  if (scene.hasLoaded) {
    return Promise.resolve();
  }

  return new Promise(resolve => {
    scene.addEventListener(
      'loaded',
      resolve,
      { once: true }
    );
  });
}


// ============================================================
// 10. ESPERAR VÍDEO DO MINDAR
// ============================================================

async function esperarVideoMindAR() {
  const tempoMaximo = 5000;
  const intervalo = 100;

  let tempo = 0;

  while (tempo < tempoMaximo) {
    const videos =
      document.querySelectorAll('video');

    if (videos.length > 0) {
      const video = videos[0];

      if (
        video.videoWidth > 0 &&
        video.videoHeight > 0 &&
        video.readyState >= 2
      ) {
        return video;
      }
    }

    await new Promise(resolve => {
      setTimeout(resolve, intervalo);
    });

    tempo += intervalo;
  }

  return null;
}


// ============================================================
// 11. PREPARAR VIDEOTEXTURE
// ============================================================

async function prepararVideoTexture() {
  console.log(
    'Procurando vídeo do MindAR...'
  );

  cameraVideo =
    await esperarVideoMindAR();

  if (!cameraVideo) {
    console.error(
      'Vídeo não encontrado.'
    );

    return false;
  }

  console.log(
    'Vídeo encontrado:',
    cameraVideo.videoWidth,
    'x',
    cameraVideo.videoHeight
  );

  cameraTexture =
    new THREE.VideoTexture(
      cameraVideo
    );

  cameraTexture.minFilter =
    THREE.LinearFilter;

  cameraTexture.magFilter =
    THREE.LinearFilter;

  cameraTexture.generateMipmaps =
    false;

  if ('colorSpace' in cameraTexture) {
    cameraTexture.colorSpace =
      THREE.SRGBColorSpace;
  }

  cameraTexture.needsUpdate =
    true;

  console.log(
    'VideoTexture criada.'
  );

  return true;
}


// ============================================================
// 12. CRIAR PREVIEW WEBGL
// ============================================================

function criarPreviewWebGL() {
  if (previewCanvas) return;

  previewCanvas =
    document.createElement('canvas');

  previewCanvas.id =
    'preview-webgl';

  // proporção 1000 x 1414
  previewCanvas.width = 500;
  previewCanvas.height = 707;

  Object.assign(
    previewCanvas.style,
    {
      position: 'fixed',
      right: '15px',
      bottom: '15px',
      width: '200px',
      height: '283px',
      zIndex: '9996',
      border: '3px solid white',
      borderRadius: '8px',
      background: 'black',
      display: 'none'
    }
  );

  document.body.appendChild(
    previewCanvas
  );

  previewRenderer =
    new THREE.WebGLRenderer({
      canvas: previewCanvas,
      antialias: true,
      alpha: false,

      // necessário para copiar o canvas WebGL
      preserveDrawingBuffer: true
    });

  previewRenderer.setSize(
    previewCanvas.width,
    previewCanvas.height,
    false
  );

  previewScene =
    new THREE.Scene();

  previewCamera =
    new THREE.OrthographicCamera(
      -1,
      1,
      1,
      -1,
      0,
      1
    );

  uH0 =
    new THREE.Vector3(
      1,
      0,
      0
    );

  uH1 =
    new THREE.Vector3(
      0,
      1,
      0
    );

  uH2 =
    new THREE.Vector3(
      0,
      0,
      1
    );

  previewMaterial =
    new THREE.ShaderMaterial({
      uniforms: {
        uVideo: {
          value: cameraTexture
        },

        uH0: {
          value: uH0
        },

        uH1: {
          value: uH1
        },

        uH2: {
          value: uH2
        }
      },

      vertexShader: `
        varying vec2 vUv;

        void main() {
          vUv = uv;

          gl_Position =
            projectionMatrix *
            modelViewMatrix *
            vec4(position, 1.0);
        }
      `,

      fragmentShader: `
        precision highp float;

        uniform sampler2D uVideo;

        uniform vec3 uH0;
        uniform vec3 uH1;
        uniform vec3 uH2;

        varying vec2 vUv;

        void main() {
          vec3 ponto = vec3(
            vUv.x,
            vUv.y,
            1.0
          );

          float divisor =
            dot(
              uH2,
              ponto
            );

          vec2 uvCamera =
            vec2(
              dot(
                uH0,
                ponto
              ),

              dot(
                uH1,
                ponto
              )
            ) / divisor;

          if (
            uvCamera.x < 0.0 ||
            uvCamera.x > 1.0 ||
            uvCamera.y < 0.0 ||
            uvCamera.y > 1.0
          ) {
            gl_FragColor =
              vec4(
                0.0,
                0.0,
                0.0,
                1.0
              );

            return;
          }

          gl_FragColor =
            texture2D(
              uVideo,
              uvCamera
            );
        }
      `
    });

  const geometria =
    new THREE.PlaneGeometry(
      2,
      2
    );

  const plano =
    new THREE.Mesh(
      geometria,
      previewMaterial
    );

  previewScene.add(
    plano
  );

  console.log(
    'Preview WebGL criado.'
  );
}


// ============================================================
// 13. CRIAR CANVAS DA TEXTURA FINAL
// ============================================================

function criarCanvasTexturaFinal() {
  if (canvasTexturaFinal) return;

  canvasTexturaFinal =
    document.createElement(
      'canvas'
    );

  canvasTexturaFinal.width =
    TEXTURA_TAMANHO;

  canvasTexturaFinal.height =
    TEXTURA_TAMANHO;

  texturaFinal =
    new THREE.CanvasTexture(
      canvasTexturaFinal
    );

  texturaFinal.minFilter =
    THREE.LinearFilter;

  texturaFinal.magFilter =
    THREE.LinearFilter;

  texturaFinal.generateMipmaps =
    false;

  texturaFinal.flipY =
    false;

  if ('colorSpace' in texturaFinal) {
    texturaFinal.colorSpace =
      THREE.SRGBColorSpace;
  }

  console.log(
    'Canvas 1024x1024 criado.'
  );
}


// ============================================================
// 14. BOTÃO INICIAR
// ============================================================

startButton.addEventListener(
  'click',

  async () => {
    if (arIniciado) return;

    arIniciado = true;

    startButton.disabled =
      true;

    startButton.textContent =
      'Abrindo câmera...';

    if (erroEl) {
      erroEl.textContent =
        '';
    }

    try {
      await esperarCenaCarregar();

      const mindarSystem =
        scene.systems[
        'mindar-image-system'
        ];

      if (!mindarSystem) {
        throw new Error(
          'MindAR não encontrado.'
        );
      }

      await mindarSystem.start();

      console.log(
        'MindAR iniciado.'
      );

      const videoOK =
        await prepararVideoTexture();

      if (!videoOK) {
        throw new Error(
          'Não foi possível acessar o vídeo.'
        );
      }

      criarPreviewWebGL();

      criarCanvasTexturaFinal();

      ajustarOverlayGuia();

      splash.style.display =
        'none';

      statusAR.style.display =
        'block';

      statusAR.textContent =
        'Procurando desenho...';

      setGuiaStatus(
        'red',
        'Procure o desenho'
      );
    }

    catch (erro) {
      console.error(
        erro
      );

      if (erroEl) {
        erroEl.textContent =
          erro.message;
      }

      startButton.disabled =
        false;

      startButton.textContent =
        'Tentar novamente';

      arIniciado =
        false;
    }
  }
);


// ============================================================
// 15. GUIA VISUAL
// ============================================================

function ajustarOverlayGuia() {
  if (!overlayGuia) return;

  overlayGuia.width =
    window.innerWidth;

  overlayGuia.height =
    window.innerHeight;
}


function setGuiaStatus(
  cor,
  texto
) {
  if (guiaBolinha) {
    guiaBolinha.style.background =
      cor;
  }

  if (guiaTexto) {
    guiaTexto.textContent =
      texto;
  }
}


function desenharContorno(
  cantosTela,
  cor
) {
  if (
    !overlayCtx ||
    !overlayGuia ||
    !cantosTela ||
    cantosTela.length < 4
  ) {
    return;
  }

  overlayCtx.clearRect(
    0,
    0,
    overlayGuia.width,
    overlayGuia.height
  );

  overlayCtx.beginPath();

  overlayCtx.moveTo(
    cantosTela[0].x,
    cantosTela[0].y
  );

  overlayCtx.lineTo(
    cantosTela[1].x,
    cantosTela[1].y
  );

  overlayCtx.lineTo(
    cantosTela[2].x,
    cantosTela[2].y
  );

  overlayCtx.lineTo(
    cantosTela[3].x,
    cantosTela[3].y
  );

  overlayCtx.closePath();

  overlayCtx.strokeStyle =
    cor;

  overlayCtx.lineWidth =
    4;

  overlayCtx.stroke();
}


function limparContorno() {
  if (
    !overlayCtx ||
    !overlayGuia
  ) {
    return;
  }

  overlayCtx.clearRect(
    0,
    0,
    overlayGuia.width,
    overlayGuia.height
  );
}


function calcularCentro(
  cantosTela
) {
  let somaX = 0;
  let somaY = 0;

  cantosTela.forEach(
    ponto => {
      somaX += ponto.x;
      somaY += ponto.y;
    }
  );

  return {
    x: somaX / 4,
    y: somaY / 4
  };
}


function calcularAreaAproximada(
  cantosTela
) {
  const larguraTopo =
    Math.hypot(
      cantosTela[1].x -
      cantosTela[0].x,

      cantosTela[1].y -
      cantosTela[0].y
    );

  const larguraBase =
    Math.hypot(
      cantosTela[2].x -
      cantosTela[3].x,

      cantosTela[2].y -
      cantosTela[3].y
    );

  const alturaEsq =
    Math.hypot(
      cantosTela[3].x -
      cantosTela[0].x,

      cantosTela[3].y -
      cantosTela[0].y
    );

  const alturaDir =
    Math.hypot(
      cantosTela[2].x -
      cantosTela[1].x,

      cantosTela[2].y -
      cantosTela[1].y
    );

  const larguraMedia =
    (
      larguraTopo +
      larguraBase
    ) / 2;

  const alturaMedia =
    (
      alturaEsq +
      alturaDir
    ) / 2;

  return (
    larguraMedia *
    alturaMedia
  );
}


function avaliarPosicao(
  cantosTela
) {
  if (!cantosTela) {
    setGuiaStatus(
      'red',
      'Procure o desenho'
    );

    limparContorno();

    ultimoCentro =
      null;

    return 'ruim';
  }

  const area =
    calcularAreaAproximada(
      cantosTela
    );

  const areaTela =
    window.innerWidth *
    window.innerHeight;

  const proporcaoArea =
    area / areaTela;

  const centro =
    calcularCentro(
      cantosTela
    );

  let movimento =
    0;

  if (ultimoCentro) {
    movimento =
      Math.hypot(
        centro.x -
        ultimoCentro.x,

        centro.y -
        ultimoCentro.y
      );
  }

  ultimoCentro =
    centro;

  const diagonalTela =
    Math.hypot(
      window.innerWidth,
      window.innerHeight
    );

  const limiteMovimento =
    diagonalTela *
    0.007;

  // muito longe
  if (
    proporcaoArea <
    0.10
  ) {
    setGuiaStatus(
      'orange',
      'Chegue mais perto'
    );

    desenharContorno(
      cantosTela,
      'orange'
    );

    return 'medio';
  }

  // muito perto
  if (
    proporcaoArea >
    0.72
  ) {
    setGuiaStatus(
      'orange',
      'Afaste um pouco'
    );

    desenharContorno(
      cantosTela,
      'orange'
    );

    return 'medio';
  }

  // mexendo muito
  if (
    movimento >
    limiteMovimento
  ) {
    setGuiaStatus(
      'yellow',
      'Segure firme'
    );

    desenharContorno(
      cantosTela,
      'yellow'
    );

    return 'medio';
  }

  // posição adequada
  setGuiaStatus(
    'lime',
    'Posição boa!'
  );

  desenharContorno(
    cantosTela,
    'lime'
  );

  return 'bom';
}


// ============================================================
// 16. CANTOS DO TARGET
// ============================================================

function esconderCantos() {
  cornerElements.forEach(
    elemento => {
      if (elemento) {
        elemento.style.display =
          'none';
      }
    }
  );
}


function projetarParaTela(
  ponto3D,
  camera
) {
  const ponto =
    ponto3D.clone();

  ponto.project(
    camera
  );

  return {
    x:
      (ponto.x * 0.5 + 0.5) *
      window.innerWidth,

    y:
      (-ponto.y * 0.5 + 0.5) *
      window.innerHeight
  };
}


function obterCantosLocais() {
  const largura =
    1;

  const altura =
    TARGET_ASPECT;

  return [
    new THREE.Vector3(
      -largura / 2,
      altura / 2,
      0
    ),

    new THREE.Vector3(
      largura / 2,
      altura / 2,
      0
    ),

    new THREE.Vector3(
      largura / 2,
      -altura / 2,
      0
    ),

    new THREE.Vector3(
      -largura / 2,
      -altura / 2,
      0
    )
  ];
}


function obterCantosTela() {
  if (!targetAtivo) {
    return null;
  }

  const camera =
    scene.camera;

  const targetObject =
    targetAtivo.object3D;

  if (
    !camera ||
    !targetObject
  ) {
    return null;
  }

  targetObject.updateMatrixWorld(
    true
  );

  camera.updateMatrixWorld(
    true
  );

  return obterCantosLocais().map(
    canto => {
      const mundo =
        canto.clone();

      targetObject.localToWorld(
        mundo
      );

      return projetarParaTela(
        mundo,
        camera
      );
    }
  );
}


function atualizarCantosDebug(
  cantos
) {
  cantos.forEach(
    (ponto, index) => {
      const elemento =
        cornerElements[index];

      if (!elemento) {
        return;
      }

      elemento.style.left =
        `${ponto.x}px`;

      elemento.style.top =
        `${ponto.y}px`;

      elemento.style.display =
        'flex';
    }
  );
}


// ============================================================
// 17. TELA → UV DO VÍDEO
// ============================================================

function telaParaVideoUV(
  xTela,
  yTela
) {
  if (!cameraVideo) {
    return null;
  }

  const rect =
    cameraVideo.getBoundingClientRect();

  const telaW =
    rect.width;

  const telaH =
    rect.height;

  const videoW =
    cameraVideo.videoWidth;

  const videoH =
    cameraVideo.videoHeight;

  if (
    telaW <= 0 ||
    telaH <= 0 ||
    videoW <= 0 ||
    videoH <= 0
  ) {
    return null;
  }

  const escala =
    Math.max(
      telaW / videoW,
      telaH / videoH
    );

  const renderW =
    videoW *
    escala;

  const renderH =
    videoH *
    escala;

  const corteX =
    (
      renderW -
      telaW
    ) / 2;

  const corteY =
    (
      renderH -
      telaH
    ) / 2;

  const localX =
    xTela -
    rect.left;

  const localY =
    yTela -
    rect.top;

  const videoX =
    (
      localX +
      corteX
    ) / escala;

  const videoY =
    (
      localY +
      corteY
    ) / escala;

  return {
    x:
      videoX /
      videoW,

    y:
      1 -
      (
        videoY /
        videoH
      )
  };
}


// ============================================================
// 18. SISTEMA LINEAR
// ============================================================

function resolverSistemaLinear(
  matriz
) {
  const n =
    matriz.length;

  for (
    let coluna = 0;
    coluna < n;
    coluna++
  ) {
    let linhaPivo =
      coluna;

    let maior =
      Math.abs(
        matriz[coluna][coluna]
      );

    for (
      let linha =
        coluna + 1;

      linha < n;

      linha++
    ) {
      const valor =
        Math.abs(
          matriz[linha][coluna]
        );

      if (
        valor >
        maior
      ) {
        maior =
          valor;

        linhaPivo =
          linha;
      }
    }

    if (
      maior <
      1e-10
    ) {
      return null;
    }

    if (
      linhaPivo !==
      coluna
    ) {
      const temp =
        matriz[coluna];

      matriz[coluna] =
        matriz[linhaPivo];

      matriz[linhaPivo] =
        temp;
    }

    const divisor =
      matriz[coluna][coluna];

    for (
      let j = coluna;
      j <= n;
      j++
    ) {
      matriz[coluna][j] /=
        divisor;
    }

    for (
      let linha = 0;
      linha < n;
      linha++
    ) {
      if (
        linha ===
        coluna
      ) {
        continue;
      }

      const fator =
        matriz[linha][coluna];

      for (
        let j = coluna;
        j <= n;
        j++
      ) {
        matriz[linha][j] -=
          fator *
          matriz[coluna][j];
      }
    }
  }

  return matriz.map(
    linha =>
      linha[n]
  );
}


// ============================================================
// 19. CALCULAR HOMOGRAFIA
// ============================================================

function calcularHomografia(
  destino,
  origem
) {
  const matriz =
    [];

  for (
    let i = 0;
    i < 4;
    i++
  ) {
    const x =
      destino[i].x;

    const y =
      destino[i].y;

    const u =
      origem[i].x;

    const v =
      origem[i].y;

    matriz.push([
      x,
      y,
      1,

      0,
      0,
      0,

      -u * x,
      -u * y,

      u
    ]);

    matriz.push([
      0,
      0,
      0,

      x,
      y,
      1,

      -v * x,
      -v * y,

      v
    ]);
  }

  return resolverSistemaLinear(
    matriz
  );
}


// ============================================================
// 20. ATUALIZAR HOMOGRAFIA
// ============================================================

function atualizarHomografiaPreview(
  cantosTela
) {
  const origem =
    cantosTela.map(
      ponto =>
        telaParaVideoUV(
          ponto.x,
          ponto.y
        )
    );

  if (
    origem.some(
      ponto => !ponto
    )
  ) {
    return;
  }

  const destino = [
    {
      x: 0,
      y: 1
    },
    {
      x: 1,
      y: 1
    },
    {
      x: 1,
      y: 0
    },
    {
      x: 0,
      y: 0
    }
  ];

  const h =
    calcularHomografia(
      destino,
      origem
    );

  if (!h) return;

  uH0.set(
    h[0],
    h[1],
    h[2]
  );

  uH1.set(
    h[3],
    h[4],
    h[5]
  );

  uH2.set(
    h[6],
    h[7],
    1
  );
}


function renderizarPreview() {
  if (
    !previewRenderer ||
    !previewScene ||
    !previewCamera
  ) {
    return;
  }

  previewRenderer.render(
    previewScene,
    previewCamera
  );
}


// ============================================================
// 21. REFORÇO DAS CORES
// ============================================================

function reforcarCores(
  ctx,
  largura,
  altura
) {
  const imagem =
    ctx.getImageData(
      0,
      0,
      largura,
      altura
    );

  const dados =
    imagem.data;

  for (
    let i = 0;
    i < dados.length;
    i += 4
  ) {
    let r =
      dados[i];

    let g =
      dados[i + 1];

    let b =
      dados[i + 2];

    const luminancia =
      0.299 * r +
      0.587 * g +
      0.114 * b;

    // MANTIDO EXATAMENTE COMO ESTAVA
    const saturacao =
      2.0;

    r =
      luminancia +
      (
        r -
        luminancia
      ) *
      saturacao;

    g =
      luminancia +
      (
        g -
        luminancia
      ) *
      saturacao;

    b =
      luminancia +
      (
        b -
        luminancia
      ) *
      saturacao;

    const contraste =
      0.96;

    r =
      (
        r -
        128
      ) *
      contraste +
      128;

    g =
      (
        g -
        128
      ) *
      contraste +
      128;

    b =
      (
        b -
        128
      ) *
      contraste +
      128;

    const brilho =
      0.86;

    r *= brilho;
    g *= brilho;
    b *= brilho;

    dados[i] =
      Math.max(
        0,
        Math.min(
          255,
          r
        )
      );

    dados[i + 1] =
      Math.max(
        0,
        Math.min(
          255,
          g
        )
      );

    dados[i + 2] =
      Math.max(
        0,
        Math.min(
          255,
          b
        )
      );
  }

  ctx.putImageData(
    imagem,
    0,
    0
  );
}


// ============================================================
// 22. CAPTURA DA PINTURA
// ============================================================

function capturarPinturaCorrigida() {
  if (
    !previewCanvas ||
    !canvasTexturaFinal
  ) {
    return false;
  }

  const ctx =
    canvasTexturaFinal.getContext(
      '2d',
      {
        willReadFrequently: true
      }
    );

  ctx.clearRect(
    0,
    0,
    TEXTURA_TAMANHO,
    TEXTURA_TAMANHO
  );

  ctx.filter =
    'none';

  const origemX =
    previewCanvas.width *
    0.20;

  const origemY =
    previewCanvas.height *
    0.15;

  const origemW =
    previewCanvas.width *
    0.60;

  const origemH =
    previewCanvas.height *
    0.70;

  ctx.drawImage(
    previewCanvas,

    origemX,
    origemY,
    origemW,
    origemH,

    0,
    0,
    TEXTURA_TAMANHO,
    TEXTURA_TAMANHO
  );

  reforcarCores(
    ctx,
    TEXTURA_TAMANHO,
    TEXTURA_TAMANHO
  );

  texturaFinal.needsUpdate =
    true;

  console.log(
    'Pintura capturada com cores reforçadas.'
  );

  return true;
}


// ============================================================
// 23. MATERIAL DO GLB
// ============================================================

function aplicarTexturaNoModelo() {
  const objeto3D =
    modeloAtivo.object3D;

  if (!objeto3D) {
    console.error(
      'Objeto GLB não encontrado.'
    );

    return;
  }

  objeto3D.traverse(
    objeto => {
      if (!objeto.isMesh) {
        return;
      }

      console.log(
        'Aplicando textura em:',
        objeto.name
      );

      const materialNovo =
        new THREE.MeshBasicMaterial({
          map: texturaFinal,
          side: THREE.DoubleSide
        });

      materialNovo.toneMapped =
        false;

      objeto.material =
        materialNovo;
    }
  );

  texturaFinal.needsUpdate =
    true;

  console.log(
    'Textura aplicada sem influência da iluminação.'
  );
}


// ============================================================
// 24. FINALIZAR CAPTURA
// ============================================================

async function finalizarCaptura() {
  if (
    capturaRealizada ||
    !targetEncontrado ||
    !modeloCarregado
  ) {
    return;
  }

  console.log(
    'Preparando captura...'
  );

  statusAR.textContent =
    'Capturando pintura...';

  const cantosTela =
    obterCantosTela();

  if (!cantosTela) {
    return;
  }

  atualizarHomografiaPreview(
    cantosTela
  );

  renderizarPreview();

  await new Promise(
    resolve => {
      requestAnimationFrame(
        () => {
          requestAnimationFrame(
            resolve
          );
        }
      );
    }
  );

  renderizarPreview();

  const capturou =
    capturarPinturaCorrigida();

  if (!capturou) {
    console.error(
      'Falha na captura.'
    );

    return;
  }

  texturaFinal.needsUpdate =
    true;

  aplicarTexturaNoModelo();

  capturaRealizada =
    true;

  framesBons =
    0;

  modeloAtivo.setAttribute(
    'visible',
    true
  );

  modeloAtivo.setAttribute(
    'animation-mixer',
    'timeScale',
    1
  );

  if (previewCanvas) {
    previewCanvas.style.display =
      'none';
  }

  limparContorno();

  setGuiaStatus(
    'lime',
    'Personagem pronto!'
  );

  statusAR.textContent =
    'Personagem pronto';

  console.log(
    'Modelo liberado com textura.'
  );
}


// ============================================================
// 25. MODELO CARREGADO
// ============================================================

modeloAtivo.addEventListener(
  'model-loaded',
  () => {
    modeloCarregado =
      true;

    console.log(
      'GLB carregado:',
      personagemAtual
        ? personagemAtual.nome
        : ''
    );
  }
);


modeloAtivo.addEventListener(
  'model-error',
  evento => {
    modeloCarregado =
      false;

    console.error(
      'Erro ao carregar GLB:',
      evento
    );
  }
);


// ============================================================
// 26. TARGETS DOS PERSONAGENS
// ============================================================

personagens.forEach(
  personagem => {

    const target =
      personagem.target;

    if (!target) {
      console.error(
        'Target não encontrado:',
        personagem.targetId
      );

      return;
    }


    // ========================================================
    // TARGET ENCONTRADO
    // ========================================================

    target.addEventListener(
      'targetFound',
      () => {

        console.log(
          'TARGET ENCONTRADO:',
          personagem.nome
        );

        personagemAtual =
          personagem;

        targetAtivo =
          target;

        targetEncontrado =
          true;

        capturaRealizada =
          false;

        framesBons =
          0;

        ultimoCentro =
          null;


        // ========================================================
        // COLOCA O MODELO NO TARGET SOMENTE SE NECESSÁRIO
        // ========================================================

        if (
          modeloAtivo.parentElement !==
          target
        ) {
          target.appendChild(
            modeloAtivo
          );
        }


        modeloAtivo.setAttribute(
          'visible',
          false
        );


        modeloAtivo.setAttribute(
          'animation-mixer',
          'timeScale',
          0
        );


        modeloAtivo.setAttribute(
          'scale',
          personagem.scale
        );


        modeloAtivo.setAttribute(
          'position',
          personagem.position
        );


        modeloAtivo.setAttribute(
          'rotation',
          personagem.rotation
        );


        // ========================================================
        // CARREGA O GLB SOMENTE SE MUDOU DE PERSONAGEM
        // ========================================================

        const glbAtual =
          modeloAtivo.getAttribute(
            'gltf-model'
          );

        if (
          glbAtual !==
          personagem.glb
        ) {

          modeloCarregado =
            false;

          console.log(
            'Carregando GLB:',
            personagem.glb
          );

          modeloAtivo.setAttribute(
            'gltf-model',
            personagem.glb
          );

        } else {

          // O mesmo personagem já está carregado.
          modeloCarregado =
            true;

          console.log(
            'GLB já carregado:',
            personagem.nome
          );
        }


        statusAR.textContent =
          'Ajuste a posição';


        setGuiaStatus(
          'yellow',
          'Segure firme'
        );


        if (previewCanvas) {
          previewCanvas.style.display =
            'block';
        }
      }
    );

    // ========================================================
    // TARGET PERDIDO
    // ========================================================

    target.addEventListener(
      'targetLost',
      () => {

        // ignora targetLost de outro personagem
        if (
          targetAtivo !==
          target
        ) {
          return;
        }

        console.log(
          'TARGET PERDIDO:',
          personagem.nome
        );

        targetEncontrado =
          false;

        capturaRealizada =
          false;

        framesBons =
          0;

        ultimoCentro =
          null;

        statusAR.textContent =
          'Procurando desenho...';

        setGuiaStatus(
          'red',
          'Procure o desenho'
        );

        esconderCantos();

        limparContorno();

        modeloAtivo.setAttribute(
          'visible',
          false
        );

        modeloAtivo.setAttribute(
          'animation-mixer',
          'timeScale',
          0
        );

        if (previewCanvas) {
          previewCanvas.style.display =
            'none';
        }

        personagemAtual =
          null;

        targetAtivo =
          null;
      }
    );
  }
);


// ============================================================
// 27. LOOP PRINCIPAL
// ============================================================

function loop() {
  requestAnimationFrame(
    loop
  );

  // atualiza vídeo
  if (
    cameraTexture &&
    cameraVideo &&
    cameraVideo.readyState >= 2
  ) {
    cameraTexture.needsUpdate =
      true;
  }

  if (!targetEncontrado) {
    return;
  }

  const cantosTela =
    obterCantosTela();

  if (!cantosTela) {
    return;
  }

  atualizarCantosDebug(
    cantosTela
  );

  atualizarHomografiaPreview(
    cantosTela
  );

  renderizarPreview();

  // se já capturou,
  // não captura novamente
  if (capturaRealizada) {
    return;
  }

  const estado =
    avaliarPosicao(
      cantosTela
    );

  if (
    estado === 'bom'
  ) {
    framesBons++;

    if (
      framesBons >=
      FRAMES_ESTAVEIS_PARA_CAPTURA
    ) {
      finalizarCaptura();
    }
  }

  else {
    framesBons =
      0;
  }
}


// ============================================================
// 28. INICIAR LOOP
// ============================================================

loop();


// ============================================================
// 29. RESIZE
// ============================================================

ajustarOverlayGuia();

window.addEventListener(
  'resize',
  () => {

    ajustarOverlayGuia();

    if (!targetEncontrado) {
      return;
    }

    const cantosTela =
      obterCantosTela();

    if (cantosTela) {
      atualizarCantosDebug(
        cantosTela
      );

      atualizarHomografiaPreview(
        cantosTela
      );
    }
  }
);