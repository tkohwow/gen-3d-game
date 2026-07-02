import * as THREE from "three";
import "./styles.css";

const canvas = document.querySelector("#game");
const sparkCountEl = document.querySelector("#sparkCount");
const timeLeftEl = document.querySelector("#timeLeft");
const phaseNameEl = document.querySelector("#phaseName");
const coherenceBarEl = document.querySelector("#coherenceBar");
const milestoneItems = [...document.querySelectorAll("#milestoneList li")];
const modeButtons = [...document.querySelectorAll(".mode-button")];
const resetButton = document.querySelector("#resetButton");
const toast = document.querySelector("#toast");
const runPanel = document.querySelector("#runPanel");
const runKicker = document.querySelector("#runKicker");
const runTitle = document.querySelector("#runTitle");
const rankValue = document.querySelector("#rankValue");
const bestValue = document.querySelector("#bestValue");
const startButton = document.querySelector("#startButton");
const retryButton = document.querySelector("#retryButton");

const phaseNames = ["2D Seed", "3D Lift", "Reality Emitter", "Final Work"];
const milestones = [
  { threshold: 12, label: "パーティクル操作" },
  { threshold: 28, label: "2Dから3Dへ" },
  { threshold: 48, label: "リアリティキット感" },
  { threshold: 60, label: "最終作品" },
];
const RUN_SECONDS = 60;
const FINISH_SCORE = milestones[milestones.length - 1].threshold;
const BEST_STORAGE_KEY = "gen-particle-best-run-v2";
const rankWeight = { S: 5, A: 4, B: 3, C: 2, D: 1, E: 0 };

const state = {
  status: "ready",
  mode: "gather",
  score: 0,
  milestone: 0,
  timeLeft: RUN_SECONDS,
  rank: "-",
  best: readBestRun(),
  pointerActive: false,
  keyboardActive: false,
  fieldCharge: 0,
  finished: false,
  toastTimer: 0,
};

const pointer = new THREE.Vector2(0, 0);
const target = new THREE.Vector3(0, 0, 0);
const smoothTarget = new THREE.Vector3(0, 0, 0);
const raycaster = new THREE.Raycaster();
const interactionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const clock = new THREE.Clock();
const dummy = new THREE.Object3D();

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  canvas,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101115);
scene.fog = new THREE.Fog(0x101115, 8, 24);

const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 80);
camera.position.set(0, 3.2, 9.8);
camera.lookAt(0, 0.7, 0);

const world = new THREE.Group();
const sculpture = new THREE.Group();
const rings = [];
const beadMeshes = [];
const particles = [];
scene.add(world);
world.add(sculpture);

const palette = {
  cyan: new THREE.Color(0x49d8cb),
  coral: new THREE.Color(0xff6b5f),
  amber: new THREE.Color(0xffc857),
  violet: new THREE.Color(0xa889ff),
  green: new THREE.Color(0x7be495),
  text: new THREE.Color(0xf7f1e8),
};

setupLights();
setupStage();
setupBriefBoard();
setupSculpture();
const particleMesh = setupParticles();
const cursor = setupCursor();
syncHud();
syncRunPanel();
animate();

function setupLights() {
  const hemi = new THREE.HemisphereLight(0xf6eee0, 0x17191f, 1.9);
  scene.add(hemi);

  const key = new THREE.SpotLight(0xfff4dc, 72, 26, Math.PI * 0.22, 0.56, 1.4);
  key.position.set(-4.4, 7.8, 6.4);
  scene.add(key);

  const rim = new THREE.PointLight(0x49d8cb, 42, 12, 1.8);
  rim.position.set(4.8, 2.8, 2.6);
  scene.add(rim);

  const warm = new THREE.PointLight(0xff6b5f, 18, 9, 2);
  warm.position.set(-3.6, 1.2, 2.8);
  scene.add(warm);
}

function setupStage() {
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(6.4, 96),
    new THREE.MeshStandardMaterial({
      color: 0x17181c,
      roughness: 0.72,
      metalness: 0.08,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.45;
  world.add(floor);

  const grid = new THREE.GridHelper(12, 24, 0x49d8cb, 0x3e3630);
  grid.position.y = -1.42;
  grid.material.transparent = true;
  grid.material.opacity = 0.32;
  world.add(grid);

  const portalMaterial = new THREE.MeshStandardMaterial({
    color: 0x202126,
    emissive: 0x121418,
    roughness: 0.44,
    metalness: 0.32,
    transparent: true,
    opacity: 0.9,
  });

  const portal = new THREE.Mesh(new THREE.TorusGeometry(3.35, 0.035, 12, 160), portalMaterial);
  portal.position.set(0, 0.45, -0.06);
  portal.rotation.x = Math.PI / 2;
  world.add(portal);

  const meridian = new THREE.Mesh(
    new THREE.TorusGeometry(3.35, 0.016, 8, 160),
    new THREE.MeshBasicMaterial({
      color: 0xa889ff,
      transparent: true,
      opacity: 0.35,
    }),
  );
  meridian.position.copy(portal.position);
  meridian.rotation.y = Math.PI / 2;
  world.add(meridian);
}

function createBriefTexture() {
  const boardCanvas = document.createElement("canvas");
  boardCanvas.width = 1024;
  boardCanvas.height = 640;
  const ctx = boardCanvas.getContext("2d");

  ctx.fillStyle = "#f6f0e5";
  ctx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);

  ctx.strokeStyle = "rgba(18, 19, 24, 0.12)";
  ctx.lineWidth = 3;
  for (let x = 80; x < boardCanvas.width; x += 170) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 30, boardCanvas.height);
    ctx.stroke();
  }

  ctx.fillStyle = "#101115";
  ctx.font = "700 54px Inter, sans-serif";
  ctx.fillText("Gen 2gen #3", 70, 92);

  ctx.font = "700 34px Inter, sans-serif";
  ctx.fillText("Particle Milestone Lab", 70, 150);

  const bullets = [
    ["01", "Particle control"],
    ["02", "2D input -> 3D work"],
    ["03", "Reality emitter"],
    ["04", "60s final run"],
  ];

  bullets.forEach(([number, text], index) => {
    const y = 235 + index * 78;
    ctx.fillStyle = ["#49d8cb", "#ffc857", "#ff6b5f", "#a889ff"][index];
    ctx.beginPath();
    ctx.arc(82, y - 10, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#101115";
    ctx.font = "800 22px Inter, sans-serif";
    ctx.fillText(number, 116, y);
    ctx.font = "700 31px Inter, sans-serif";
    ctx.fillText(text, 175, y);
  });

  ctx.strokeStyle = "#ff6b5f";
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(600, 270);
  ctx.bezierCurveTo(760, 160, 900, 285, 820, 430);
  ctx.stroke();

  ctx.strokeStyle = "#49d8cb";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(710, 390, 92, 0.3, Math.PI * 1.82);
  ctx.stroke();

  ctx.fillStyle = "#101115";
  ctx.font = "800 38px Inter, sans-serif";
  ctx.fillText("Make it playable", 585, 525);

  const texture = new THREE.CanvasTexture(boardCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

function setupBriefBoard() {
  const boardGroup = new THREE.Group();
  boardGroup.position.set(-4.05, 1.6, -2.8);
  boardGroup.rotation.set(-0.05, 0.42, 0.02);
  world.add(boardGroup);

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(4.72, 3.14, 0.08),
    new THREE.MeshStandardMaterial({
      color: 0xd8d0c4,
      roughness: 0.48,
      metalness: 0.18,
    }),
  );
  boardGroup.add(frame);

  const texture = createBriefTexture();

  const image = new THREE.Mesh(
    new THREE.PlaneGeometry(4.46, 2.86),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: texture,
      roughness: 0.66,
      metalness: 0,
    }),
  );
  image.position.z = 0.052;
  boardGroup.add(image);

  const led = new THREE.Mesh(
    new THREE.BoxGeometry(4.88, 0.04, 0.06),
    new THREE.MeshBasicMaterial({ color: 0xff6b5f }),
  );
  led.position.set(0, 1.6, 0.08);
  boardGroup.add(led);
}

function setupSculpture() {
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.72, 3),
    new THREE.MeshStandardMaterial({
      color: 0x252832,
      emissive: 0x11131b,
      roughness: 0.36,
      metalness: 0.42,
    }),
  );
  core.name = "core";
  core.position.y = 0.15;
  sculpture.add(core);

  const inner = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.35, 2),
    new THREE.MeshStandardMaterial({
      color: 0x49d8cb,
      emissive: 0x0d544f,
      roughness: 0.2,
      metalness: 0.18,
    }),
  );
  inner.name = "inner";
  inner.position.y = 0.15;
  sculpture.add(inner);

  const ringData = [
    [1.25, 0xff6b5f, 0],
    [1.58, 0xffc857, Math.PI / 2.6],
    [1.92, 0x49d8cb, Math.PI / 2],
    [2.25, 0xa889ff, Math.PI / 3.4],
  ];

  for (const [radius, color, tilt] of ringData) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.018, 10, 160),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.0,
      }),
    );
    ring.rotation.set(tilt, tilt * 0.35, 0);
    ring.userData.targetOpacity = 0;
    rings.push(ring);
    sculpture.add(ring);
  }
}

function setupParticles() {
  const geometry = new THREE.SphereGeometry(0.045, 10, 10);
  const material = new THREE.MeshStandardMaterial({
    roughness: 0.28,
    metalness: 0.12,
    emissive: 0x111111,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, 140);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(140 * 3), 3);
  world.add(mesh);

  for (let i = 0; i < 140; i += 1) {
    particles.push(makeParticle(i));
  }

  return mesh;
}

function makeParticle(index) {
  const radius = 1.4 + Math.random() * 3.4;
  const angle = Math.random() * Math.PI * 2;
  const y = -0.85 + Math.random() * 3.2;
  const colorList = [palette.cyan, palette.coral, palette.amber, palette.violet, palette.green];
  const color = colorList[index % colorList.length].clone();

  return {
    color,
    phase: Math.random() * Math.PI * 2,
    orbit: 0.15 + Math.random() * 0.55,
    position: new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius * 0.75),
    velocity: new THREE.Vector3(
      (Math.random() - 0.5) * 0.16,
      (Math.random() - 0.5) * 0.16,
      (Math.random() - 0.5) * 0.16,
    ),
  };
}

function setupCursor() {
  const group = new THREE.Group();
  world.add(group);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.36, 0.015, 8, 80),
    new THREE.MeshBasicMaterial({ color: 0xffc857, transparent: true, opacity: 0.9 }),
  );
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xf7f1e8 }),
  );
  group.add(dot);

  const light = new THREE.PointLight(0xffc857, 2.5, 2.6, 2);
  group.add(light);

  return group;
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.033);
  const t = clock.elapsedTime;

  if (state.status === "playing") {
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    syncClock();

    if (state.timeLeft <= 0) {
      endRun(false);
    }
  }

  world.rotation.y = Math.sin(t * 0.12) * 0.035;
  state.fieldCharge = Math.max(0, state.fieldCharge - dt * 0.82);
  const fieldActive = isRunActive() && (state.pointerActive || state.keyboardActive || state.fieldCharge > 0);
  smoothTarget.lerp(target, 1 - Math.pow(0.0008, dt));
  cursor.position.copy(smoothTarget);
  cursor.scale.setScalar((fieldActive ? 1.18 : 0.86) + Math.sin(t * 8) * 0.025);
  cursor.rotation.z = t * 1.8;

  updateParticles(dt, t);
  updateSculpture(dt, t);
  renderer.render(scene, camera);
}

function updateParticles(dt, t) {
  const active = isRunActive() && (state.pointerActive || state.keyboardActive || state.fieldCharge > 0);
  const radius = state.mode === "sculpt" ? 2.35 : state.mode === "orbit" ? 1.95 : 2.1;
  const strength = state.mode === "sculpt" ? 9.2 : state.mode === "orbit" ? 7.8 : 10.5;

  particles.forEach((particle, index) => {
    const p = particle.position;
    const v = particle.velocity;

    v.x += Math.sin(t * particle.orbit + particle.phase) * dt * 0.08;
    v.y += Math.cos(t * 0.8 + particle.phase) * dt * 0.05;
    v.z += Math.cos(t * particle.orbit + particle.phase) * dt * 0.08;

    if (active) {
      const toTarget = new THREE.Vector3().subVectors(smoothTarget, p);
      const distance = Math.max(0.001, toTarget.length());

      if (distance < radius) {
        const falloff = 1 - distance / radius;
        const normal = toTarget.normalize();

        if (state.mode === "orbit") {
          const tangent = new THREE.Vector3(-normal.y, normal.x, 0.14).normalize();
          v.addScaledVector(tangent, strength * falloff * dt);
          v.addScaledVector(normal, strength * 0.42 * falloff * dt);
        } else if (state.mode === "sculpt") {
          const toCenter = new THREE.Vector3(-p.x, 0.15 - p.y, -p.z).normalize();
          v.addScaledVector(normal, strength * 0.35 * falloff * dt);
          v.addScaledVector(toCenter, strength * falloff * dt);
        } else {
          v.addScaledVector(normal, strength * falloff * dt);
        }

        const captureRadius = state.mode === "gather" ? radius * 0.52 : radius * 0.38;
        if (distance < captureRadius) {
          collectParticle(index);
        }
      }
    }

    v.multiplyScalar(0.986);
    p.addScaledVector(v, dt * 2.8);
    containParticle(p, v);

    dummy.position.copy(p);
    const scale = 0.85 + Math.sin(t * 3 + particle.phase) * 0.12;
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    particleMesh.setMatrixAt(index, dummy.matrix);
    particleMesh.setColorAt(index, particle.color);
  });

  particleMesh.instanceMatrix.needsUpdate = true;
  particleMesh.instanceColor.needsUpdate = true;
}

function containParticle(position, velocity) {
  const limit = 5.4;
  const floor = -1.2;
  const ceiling = 3.25;

  if (position.length() > limit) {
    position.setLength(limit);
    velocity.multiplyScalar(-0.38);
  }

  if (position.y < floor || position.y > ceiling) {
    position.y = THREE.MathUtils.clamp(position.y, floor, ceiling);
    velocity.y *= -0.55;
  }
}

function collectParticle(index) {
  if (!isRunActive()) {
    return;
  }

  const particle = particles[index];
  const gain = state.mode === "sculpt" ? 2 : 1;
  state.score += gain;

  if (state.score % 2 === 0 || state.mode === "sculpt") {
    addBead(particle.color);
  }

  const replacement = makeParticle(index);
  particle.position.copy(replacement.position);
  particle.velocity.copy(replacement.velocity);
  particle.phase = replacement.phase;
  particle.orbit = replacement.orbit;
  particle.color.copy(replacement.color);

  updateMilestone();
  syncHud();
}

function addBead(color) {
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color.clone().multiplyScalar(0.22),
    roughness: 0.22,
    metalness: 0.28,
  });
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 12), material);
  const index = beadMeshes.length;
  bead.userData = {
    radius: 0.62 + Math.min(1.8, index * 0.012),
    theta: index * 2.399,
    speed: 0.28 + (index % 6) * 0.012,
    y: -0.42 + (index % 28) * 0.034,
  };
  beadMeshes.push(bead);
  sculpture.add(bead);
}

function updateMilestone() {
  const next = milestones[state.milestone];
  if (!next || state.score < next.threshold) {
    return;
  }

  rings[state.milestone].userData.targetOpacity = 0.9;
  showToast(next.label);
  state.milestone += 1;

  if (state.milestone >= milestones.length) {
    endRun(true);
  }
}

function updateSculpture(dt, t) {
  sculpture.rotation.y += dt * (state.finished ? 0.42 : 0.22);
  sculpture.rotation.x = Math.sin(t * 0.18) * 0.08;

  const core = sculpture.getObjectByName("core");
  const inner = sculpture.getObjectByName("inner");
  const pulse = 1 + Math.sin(t * 2.7) * 0.025 + Math.min(0.36, state.score / 360);
  core.scale.lerp(new THREE.Vector3(pulse, pulse, pulse), 0.08);
  inner.scale.setScalar(0.88 + Math.sin(t * 4.2) * 0.06 + state.milestone * 0.08);

  rings.forEach((ring, index) => {
    ring.rotation.z += dt * (0.18 + index * 0.07);
    ring.material.opacity += (ring.userData.targetOpacity - ring.material.opacity) * 0.06;
  });

  beadMeshes.forEach((bead) => {
    const data = bead.userData;
    const theta = data.theta + t * data.speed;
    bead.position.set(
      Math.cos(theta) * data.radius,
      data.y + Math.sin(theta * 1.6) * 0.18 + 0.22,
      Math.sin(theta) * data.radius,
    );
  });
}

function isRunActive() {
  return state.status === "playing";
}

function startRun() {
  resetGame({ silent: true, status: "playing" });
  showToast("Run start");
}

function endRun(didWin) {
  if (!isRunActive()) {
    return;
  }

  state.status = didWin ? "won" : "lost";
  state.finished = didWin;
  state.keyboardActive = false;
  state.pointerActive = false;
  state.fieldCharge = 0;
  state.rank = calculateRank(didWin);

  if (didWin) {
    showToast("Gen final work complete");
  } else {
    showToast("Time up");
  }

  saveBestRun();
  syncHud();
  syncRunPanel();
}

function calculateRank(didWin) {
  if (didWin) {
    if (state.timeLeft >= 28) return "S";
    if (state.timeLeft >= 16) return "A";
    if (state.timeLeft >= 6) return "B";
    return "C";
  }

  if (state.score >= milestones[2].threshold) return "D";
  return "E";
}

function readBestRun() {
  try {
    return JSON.parse(localStorage.getItem(BEST_STORAGE_KEY));
  } catch {
    return null;
  }
}

function isBetterRun(candidate, best) {
  if (!best) {
    return true;
  }

  const rankDelta = rankWeight[candidate.rank] - rankWeight[best.rank];
  if (rankDelta !== 0) {
    return rankDelta > 0;
  }

  if (candidate.score !== best.score) {
    return candidate.score > best.score;
  }

  return candidate.timeLeft > best.timeLeft;
}

function saveBestRun() {
  const candidate = {
    rank: state.rank,
    score: state.score,
    timeLeft: Number(state.timeLeft.toFixed(1)),
  };

  if (!isBetterRun(candidate, state.best)) {
    return;
  }

  state.best = candidate;

  try {
    localStorage.setItem(BEST_STORAGE_KEY, JSON.stringify(candidate));
  } catch {
    // Local storage can be unavailable in restricted browser contexts.
  }
}

function syncClock() {
  timeLeftEl.textContent = state.timeLeft.toFixed(1);
}

function syncRunPanel() {
  const isPlaying = state.status === "playing";
  runPanel.classList.toggle("hidden", isPlaying);
  startButton.hidden = state.status !== "ready";
  retryButton.hidden = state.status !== "won" && state.status !== "lost";

  if (state.status === "ready") {
    runKicker.textContent = "60s Run";
    runTitle.textContent = "Ready";
    rankValue.textContent = "-";
  } else if (state.status === "won") {
    runKicker.textContent = `${state.timeLeft.toFixed(1)}s left`;
    runTitle.textContent = "Complete";
    rankValue.textContent = state.rank;
  } else if (state.status === "lost") {
    runKicker.textContent = `${state.score}/${FINISH_SCORE}`;
    runTitle.textContent = "Time Up";
    rankValue.textContent = state.rank;
  }

  bestValue.textContent = state.best ? `${state.best.rank} ${state.best.score}` : "-";
}

function syncHud() {
  sparkCountEl.textContent = state.score.toString();
  syncClock();
  const phaseIndex = Math.min(state.milestone, phaseNames.length - 1);
  phaseNameEl.textContent = phaseNames[phaseIndex];
  coherenceBarEl.style.width = `${Math.min(100, Math.round((state.score / FINISH_SCORE) * 100))}%`;

  milestoneItems.forEach((item, index) => {
    item.classList.toggle("done", index < state.milestone);
    item.classList.toggle("active", index === state.milestone && !state.finished);
  });

  modeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === state.mode);
  });

  syncRunPanel();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 1800);
}

function setMode(mode) {
  state.mode = mode;
  syncHud();
}

function resetGame(options = {}) {
  state.score = 0;
  state.milestone = 0;
  state.timeLeft = RUN_SECONDS;
  state.rank = "-";
  state.status = options.status ?? "ready";
  state.finished = false;
  state.pointerActive = false;
  state.keyboardActive = false;
  state.fieldCharge = 0;

  rings.forEach((ring) => {
    ring.userData.targetOpacity = 0;
  });

  beadMeshes.splice(0).forEach((bead) => {
    bead.geometry.dispose();
    bead.material.dispose();
    sculpture.remove(bead);
  });

  particles.forEach((particle, index) => {
    const fresh = makeParticle(index);
    particle.position.copy(fresh.position);
    particle.velocity.copy(fresh.velocity);
    particle.phase = fresh.phase;
    particle.orbit = fresh.orbit;
    particle.color.copy(fresh.color);
  });

  syncHud();

  if (!options.silent) {
    showToast("Ready");
  }
}

function updatePointer(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  raycaster.setFromCamera(pointer, camera);
  raycaster.ray.intersectPlane(interactionPlane, target);
  target.x = THREE.MathUtils.clamp(target.x, -4.2, 4.2);
  target.y = THREE.MathUtils.clamp(target.y, -1.05, 3.1);
  target.z = 0;
  state.fieldCharge = Math.min(1, state.fieldCharge + 0.32);
}

function beginPointer(event) {
  state.pointerActive = true;
  updatePointer(event);
}

function endPointer() {
  state.pointerActive = false;
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  camera.aspect = width / height;
  camera.position.z = width < 720 ? 11.4 : 9.8;
  camera.position.y = width < 720 ? 3.55 : 3.2;
  camera.updateProjectionMatrix();
}

canvas.addEventListener("pointermove", updatePointer);
canvas.addEventListener("pointerdown", (event) => {
  beginPointer(event);
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointerup", (event) => {
  endPointer();
  canvas.releasePointerCapture(event.pointerId);
});
canvas.addEventListener("pointercancel", () => {
  endPointer();
});
canvas.addEventListener("mousemove", updatePointer);
canvas.addEventListener("mousedown", beginPointer);
window.addEventListener("mouseup", endPointer);

window.addEventListener("keydown", (event) => {
  if ((event.code === "Enter" || event.code === "NumpadEnter") && state.status !== "playing") {
    startRun();
  }
  if (event.code === "Digit1") setMode("gather");
  if (event.code === "Digit2") setMode("orbit");
  if (event.code === "Digit3") setMode("sculpt");
  if (event.code === "Space") {
    event.preventDefault();
    state.keyboardActive = true;
  }
  if (event.code === "KeyR") {
    resetGame();
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code === "Space") {
    state.keyboardActive = false;
  }
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});
resetButton.addEventListener("click", () => resetGame());
startButton.addEventListener("click", startRun);
retryButton.addEventListener("click", startRun);
window.addEventListener("resize", resize);
