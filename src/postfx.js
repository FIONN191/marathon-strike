import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { G } from './state.js';

/* ---------------- Marathon CRT / 故障合成 shader ----------------
   工作在 tone-map 之后的显示空间：色差 + 扫描线 + 暗角 + 胶片颗粒 + 受击故障撕裂 */
const MarathonShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uGlitch: { value: 0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform float uGlitch;
    varying vec2 vUv;

    float rand(vec2 co){ return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }

    void main() {
      vec2 uv = vUv;
      float g = clamp(uGlitch, 0.0, 1.0);

      // 受击/故障：按行水平撕裂
      float line = floor(uv.y * 90.0);
      float shift = (rand(vec2(line, floor(uTime * 18.0))) - 0.5) * 0.05 * g;
      uv.x += shift;

      // 色差：随到中心距离增强，受击时放大
      vec2 c = uv - 0.5;
      float d = dot(c, c);
      float ca = 0.0014 + 0.0045 * d + 0.02 * g;
      float r = texture2D(tDiffuse, uv + c * ca).r;
      float gr = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - c * ca).b;
      vec3 col = vec3(r, gr, b);

      // CRT 扫描线
      float scan = 0.965 + 0.035 * sin(uv.y * uResolution.y * 1.35);
      col *= scan;

      // 暗角
      float vig = smoothstep(1.05, 0.2, d * 2.3);
      col *= mix(0.5, 1.0, vig);

      // 胶片颗粒
      float grain = (rand(uv * uResolution + fract(uTime)) - 0.5) * 0.045;
      col += grain;

      // 受击整体偏品红
      col = mix(col, col * vec3(1.25, 0.68, 0.9), g * 0.5);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

let composer = null, marathonPass = null;

export function initPostFX(renderer, scene, camera) {
  const w = window.innerWidth, h = window.innerHeight;

  composer = new EffectComposer(renderer);
  composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  composer.setSize(w, h);

  composer.addPass(new RenderPass(scene, camera));

  // 荧光辉光 —— 只让高亮/自发光（酸性绿、护目镜、发光条、熵核）泛光
  const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.5, 0.4, 0.88);
  composer.addPass(bloom);

  // tone mapping + sRGB 输出
  composer.addPass(new OutputPass());

  // CRT / 故障合成（最后一道，直接上屏）
  marathonPass = new ShaderPass(MarathonShader);
  marathonPass.uniforms.uResolution.value.set(w * composer._pixelRatio, h * composer._pixelRatio);
  composer.addPass(marathonPass);

  G.composer = composer;
  G.bloomPass = bloom;

  window.addEventListener('resize', () => {
    const nw = window.innerWidth, nh = window.innerHeight;
    composer.setSize(nw, nh);
    bloom.setSize(nw, nh);
    marathonPass.uniforms.uResolution.value.set(nw * composer._pixelRatio, nh * composer._pixelRatio);
  });

  return composer;
}

export function renderPostFX() {
  if (!composer) return;
  // uTime 独立于游戏时钟推进，暂停时故障效果也保持流动
  marathonPass.uniforms.uTime.value = performance.now() / 1000;
  // 受击/爆炸震动映射为故障强度
  marathonPass.uniforms.uGlitch.value = Math.min(1, (G.shake || 0) * 0.9 + (G.player && !G.player.alive ? 0.12 : 0));
  composer.render();
}
