import * as THREE from "three";

const segment = (value: number, start: number, end: number) =>
  Math.min(1, Math.max(0, (value - start) / (end - start)));
const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;

function glowTexture(inner: string, outer: string) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.35, outer);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

function posterTexture(glyph: string, from: string, to: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 168;
  const context = canvas.getContext("2d")!;
  const gradient = context.createLinearGradient(0, 0, 128, 168);
  gradient.addColorStop(0, from);
  gradient.addColorStop(1, to);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 168);
  context.strokeStyle = "rgba(242,183,5,0.9)";
  context.lineWidth = 4;
  context.strokeRect(6, 6, 116, 156);
  context.fillStyle = "rgba(255,243,220,0.92)";
  context.font = '64px "Baloo Tamma 2", "Noto Sans Kannada", sans-serif';
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(glyph, 64, 80);
  context.fillStyle = "rgba(242,183,5,0.8)";
  context.fillRect(30, 128, 68, 5);
  context.fillRect(42, 140, 44, 4);
  return new THREE.CanvasTexture(canvas);
}

type SceneOptions = { density?: number; drift?: boolean };

export function createVedikeScene(container: HTMLElement, options: SceneOptions = {}) {
  const mobile = window.innerWidth < 700;
  const density = (options.density ?? 1) * (mobile ? 0.55 : 1);
  const drift = options.drift !== false;
  const renderer = new THREE.WebGLRenderer({ antialias: !mobile, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const background = new THREE.Color("#070408");
  scene.background = background;
  scene.fog = new THREE.Fog(background.clone(), 8, 90);
  const camera = new THREE.PerspectiveCamera(
    58,
    container.clientWidth / container.clientHeight,
    0.1,
    400,
  );
  camera.position.set(0, 4, 18);

  const warmGlow = glowTexture("rgba(255,240,200,1)", "rgba(255,150,40,0.55)");
  const redGlow = glowTexture("rgba(255,220,210,1)", "rgba(230,57,70,0.5)");
  const gold = new THREE.Color("#F2B705");
  const darkPillar = new THREE.Color("#241016");

  const particleCount = Math.floor(700 * density);
  const particleGeometry = new THREE.BufferGeometry();
  const particlePositions = new Float32Array(particleCount * 3);
  const particleColors = new Float32Array(particleCount * 3);
  const palette = ["#F2B705", "#FF8A00", "#E63946", "#FFF3DC"].map((color) => new THREE.Color(color));
  for (let index = 0; index < particleCount; index += 1) {
    particlePositions[index * 3] = (Math.random() - 0.5) * 90;
    particlePositions[index * 3 + 1] = Math.random() * 22;
    particlePositions[index * 3 + 2] = 15 - Math.random() * 210;
    const color = palette[(Math.random() * palette.length) | 0];
    particleColors[index * 3] = color.r;
    particleColors[index * 3 + 1] = color.g;
    particleColors[index * 3 + 2] = color.b;
  }
  particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
  particleGeometry.setAttribute("color", new THREE.BufferAttribute(particleColors, 3));
  const particleMaterial = new THREE.PointsMaterial({
    size: 0.45,
    map: warmGlow,
    vertexColors: true,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  scene.add(new THREE.Points(particleGeometry, particleMaterial));

  // Chapter one — the city wakes up.
  const city = new THREE.Group();
  const buildingMaterial = new THREE.MeshBasicMaterial({ color: "#150a0e" });
  for (let index = 0; index < 46; index += 1) {
    const width = 1.5 + Math.random() * 3.5;
    const height = 2 + Math.random() * 11;
    const depth = 1.5 + Math.random() * 3;
    const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), buildingMaterial);
    const side = Math.random() > 0.5 ? 1 : -1;
    building.position.set(side * (7 + Math.random() * 30), height / 2, -18 - Math.random() * 55);
    city.add(building);
  }
  const treeMaterial = new THREE.MeshBasicMaterial({ color: "#0d1409" });
  for (let index = 0; index < 18; index += 1) {
    const tree = new THREE.Mesh(
      new THREE.SphereGeometry(1 + Math.random() * 1.6, 8, 6),
      treeMaterial,
    );
    const side = Math.random() > 0.5 ? 1 : -1;
    tree.position.set(side * (4.5 + Math.random() * 10), 1.4 + Math.random(), -12 - Math.random() * 50);
    tree.scale.y = 0.7;
    city.add(tree);
  }
  const lampSprites: THREE.Sprite[] = [];
  for (let index = 0; index < 14; index += 1) {
    const lamp = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: warmGlow,
        color: "#FFB84D",
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    lamp.position.set((index % 2 ? 1 : -1) * 5.5, 3.2, -8 - index * 4.5);
    lamp.scale.set(3, 3, 1);
    city.add(lamp);
    lampSprites.push(lamp);
  }
  const dawn = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: warmGlow,
      color: "#FF8A00",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  dawn.position.set(0, 6, -85);
  dawn.scale.set(150, 55, 1);
  scene.add(dawn);
  const metroCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-34, 7, -14),
    new THREE.Vector3(-12, 8.5, -26),
    new THREE.Vector3(8, 7.5, -38),
    new THREE.Vector3(26, 9, -52),
    new THREE.Vector3(40, 8, -66),
  ]);
  const metroGeometry = new THREE.TubeGeometry(metroCurve, 160, 0.14, 6, false);
  const metro = new THREE.Mesh(
    metroGeometry,
    new THREE.MeshBasicMaterial({ color: "#F2B705", transparent: true, opacity: 0.95 }),
  );
  const metroIndexCount = metroGeometry.index!.count;
  metroGeometry.setDrawRange(0, 0);
  city.add(metro);
  const rangoli = new THREE.Group();
  for (let ring = 0; ring < 5; ring += 1) {
    const points: THREE.Vector3[] = [];
    const radius = 6 * ((ring + 1) / 5);
    const petals = ring % 2 ? 12 : 1;
    for (let point = 0; point <= 96; point += 1) {
      const angle = (point / 96) * Math.PI * 2;
      const wobble = petals > 1 ? 1 + 0.14 * Math.sin(angle * petals) : 1;
      points.push(new THREE.Vector3(Math.cos(angle) * radius * wobble, 0, Math.sin(angle) * radius * wobble));
    }
    rangoli.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({
          color: ring % 2 ? "#E63946" : "#F2B705",
          transparent: true,
          opacity: 0.85,
        }),
      ),
    );
  }
  rangoli.position.set(0, 0.02, -16);
  rangoli.scale.setScalar(0.001);
  city.add(rangoli);
  scene.add(city);

  // Chapter two — Vidhana Soudha.
  const soudha = new THREE.Group();
  const bodyMaterial = new THREE.MeshBasicMaterial({ color: "#180b10" });
  const edgeMaterials: THREE.LineBasicMaterial[] = [];
  const block = (width: number, height: number, depth: number, x: number, y: number, z = 0) => {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const body = new THREE.Mesh(geometry, bodyMaterial);
    body.position.set(x, y, z);
    soudha.add(body);
    const material = new THREE.LineBasicMaterial({ color: gold, transparent: true, opacity: 0 });
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), material);
    edges.position.copy(body.position);
    soudha.add(edges);
    edgeMaterials.push(material);
  };
  block(26, 2.2, 10, 0, 1.1);
  block(20, 3.4, 8, 0, 3.9);
  block(6, 4.2, 6, 0, 7.7);
  block(3.4, 2.2, 3.4, -9.4, 6.7);
  block(3.4, 2.2, 3.4, 9.4, 6.7);
  const dome = (radius: number, x: number, y: number) => {
    const geometry = new THREE.SphereGeometry(radius, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const body = new THREE.Mesh(geometry, bodyMaterial);
    body.position.set(x, y, 0);
    soudha.add(body);
    const material = new THREE.LineBasicMaterial({ color: gold, transparent: true, opacity: 0 });
    const wire = new THREE.LineSegments(new THREE.WireframeGeometry(geometry), material);
    wire.position.copy(body.position);
    soudha.add(wire);
    edgeMaterials.push(material);
  };
  dome(2.4, 0, 9.8);
  dome(1.1, -9.4, 7.8);
  dome(1.1, 9.4, 7.8);
  const pillarMaterials: THREE.MeshBasicMaterial[] = [];
  for (let index = 0; index < 10; index += 1) {
    const material = new THREE.MeshBasicMaterial({ color: darkPillar.clone() });
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 3.2, 8), material);
    pillar.position.set(-8.1 + index * 1.8, 3.9, 4.15);
    soudha.add(pillar);
    pillarMaterials.push(material);
  }
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 60),
    new THREE.MeshBasicMaterial({ color: "#050305" }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.02;
  soudha.add(floor);
  const underGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: warmGlow, color: "#F2B705", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  underGlow.position.set(0, 2.5, 6);
  underGlow.scale.set(42, 12, 1);
  soudha.add(underGlow);
  const sweep = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: warmGlow, color: "#FFF3DC", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  sweep.position.set(-14, 6, 5);
  sweep.scale.set(10, 16, 1);
  soudha.add(sweep);
  const fragmentGold = new THREE.MeshBasicMaterial({ color: "#F2B705", wireframe: true, transparent: true, opacity: 0 });
  const fragmentRed = new THREE.MeshBasicMaterial({ color: "#E63946", wireframe: true, transparent: true, opacity: 0 });
  const fragments: Array<{ mesh: THREE.Mesh; angle: number; radius: number; height: number }> = [];
  for (let index = 0; index < 14; index += 1) {
    const geometry = index % 3 === 0
      ? new THREE.TorusGeometry(0.55, 0.16, 6, 14)
      : index % 3 === 1
        ? new THREE.OctahedronGeometry(0.5)
        : new THREE.TorusKnotGeometry(0.32, 0.1, 32, 6);
    const mesh = new THREE.Mesh(geometry, index % 2 ? fragmentGold : fragmentRed);
    fragments.push({ mesh, angle: (index / 14) * Math.PI * 2, radius: 15 + Math.random() * 4, height: 3 + Math.random() * 7 });
    soudha.add(mesh);
  }
  soudha.position.set(0, 0, -96);
  scene.add(soudha);

  // Chapter three — neon Bengaluru.
  const neon = new THREE.Group();
  const roadCurves: THREE.CatmullRomCurve3[] = [];
  const roadMaterials: THREE.MeshBasicMaterial[] = [];
  ["#FF2D3F", "#FFCF3F", "#9A4DFF"].forEach((color, index) => {
    const offset = (index - 1) * 5;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(offset - 6, 0.15, -95),
      new THREE.Vector3(offset + 7, 0.15, -110),
      new THREE.Vector3(offset - 8, 0.15, -125),
      new THREE.Vector3(offset + 6, 0.15, -140),
      new THREE.Vector3(offset - 4, 0.15, -155),
    ]);
    roadCurves.push(curve);
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    roadMaterials.push(material);
    neon.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 140, 0.16, 5, false), material));
  });
  const streaks: Array<{ mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>; curve: THREE.CatmullRomCurve3; offset: number; speed: number }> = [];
  const streakCount = Math.floor(22 * density) + 6;
  for (let index = 0; index < streakCount; index += 1) {
    const material = new THREE.MeshBasicMaterial({ color: index % 2 ? "#FFCF3F" : "#FF4D5A", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 2.6), material);
    streaks.push({ mesh, curve: roadCurves[index % roadCurves.length]!, offset: Math.random(), speed: 0.05 + Math.random() * 0.09 });
    neon.add(mesh);
  }
  const greenGeometry = new THREE.BufferGeometry();
  const greenPositions = new Float32Array(Math.floor(160 * density) * 3);
  for (let index = 0; index < greenPositions.length / 3; index += 1) {
    greenPositions[index * 3] = (Math.random() - 0.5) * 46;
    greenPositions[index * 3 + 1] = Math.random() * 9;
    greenPositions[index * 3 + 2] = -100 - Math.random() * 55;
  }
  greenGeometry.setAttribute("position", new THREE.BufferAttribute(greenPositions, 3));
  const greenMaterial = new THREE.PointsMaterial({ size: 0.5, map: warmGlow, color: "#59C265", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  neon.add(new THREE.Points(greenGeometry, greenMaterial));
  const grid = new THREE.GridHelper(90, 44, "#4A1E5C", "#241030");
  grid.position.set(0, 0.01, -125);
  const gridMaterial = grid.material as THREE.LineBasicMaterial;
  gridMaterial.transparent = true;
  gridMaterial.opacity = 0;
  neon.add(grid);
  const buntingMaterials = [
    new THREE.MeshBasicMaterial({ color: "#E63946", side: THREE.DoubleSide, transparent: true, opacity: 0 }),
    new THREE.MeshBasicMaterial({ color: "#F2B705", side: THREE.DoubleSide, transparent: true, opacity: 0 }),
  ];
  const buntings: Array<{ mesh: THREE.Mesh; index: number }> = [];
  for (let row = 0; row < 2; row += 1) {
    for (let index = 0; index < 18; index += 1) {
      const position = index / 17;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.8), buntingMaterials[index % 2]);
      mesh.position.set(lerp(-14, 14, position), 7.5 - Math.sin(position * Math.PI) * 1.8, -108 - row * 22);
      mesh.rotation.x = Math.PI * 0.06;
      buntings.push({ mesh, index: index + row * 5 });
      neon.add(mesh);
    }
  }
  scene.add(neon);

  // Chapter four — Utsava orbit.
  const orbit = new THREE.Group();
  const ringMaterials: THREE.MeshBasicMaterial[] = [];
  ([[5.5, "#F2B705", 0.25], [7.5, "#E63946", -0.18], [9.5, "#FF8A00", 0.12]] as const).forEach(([radius, color, tilt], index) => {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.06, 6, 90), material);
    ring.rotation.x = -Math.PI / 2 + tilt;
    ring.position.y = 4;
    ring.userData.speed = (index % 2 ? -1 : 1) * (0.1 + index * 0.05);
    ringMaterials.push(material);
    orbit.add(ring);
  });
  const posterColors = [["#3B0A12", "#160408"], ["#2A0E2E", "#12050f"], ["#33150a", "#140704"]] as const;
  const posters: Array<{ mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>; angle: number; radius: number }> = [];
  ["ಕ", "ನ", "ಡ", "ವ", "ಉ", "ಹ", "ಸ", "ಬ"].forEach((glyph, index) => {
    const colors = posterColors[index % posterColors.length];
    const material = new THREE.MeshBasicMaterial({ map: posterTexture(glyph, colors[0], colors[1]), transparent: true, opacity: 0, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.75), material);
    posters.push({ mesh, angle: (index / 8) * Math.PI * 2, radius: 7.5 });
    orbit.add(mesh);
  });
  const coinMaterial = new THREE.MeshBasicMaterial({ color: "#F2B705", transparent: true, opacity: 0 });
  const coins: Array<{ mesh: THREE.Mesh; angle: number }> = [];
  for (let index = 0; index < 12; index += 1) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 16), coinMaterial);
    mesh.rotation.z = Math.PI / 2;
    coins.push({ mesh, angle: (index / 12) * Math.PI * 2 });
    orbit.add(mesh);
  }
  const orbitLamps: Array<{ sprite: THREE.Sprite; angle: number }> = [];
  for (let index = 0; index < 8; index += 1) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: index % 2 ? warmGlow : redGlow, color: "#FFB040", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    sprite.scale.set(4, 4, 1);
    orbitLamps.push({ sprite, angle: (index / 8) * Math.PI * 2 + 0.4 });
    orbit.add(sprite);
  }
  const petalCount = Math.floor(180 * density);
  const petalGeometry = new THREE.BufferGeometry();
  const petalPositions = new Float32Array(petalCount * 3);
  for (let index = 0; index < petalCount; index += 1) {
    petalPositions[index * 3] = (Math.random() - 0.5) * 26;
    petalPositions[index * 3 + 1] = Math.random() * 16;
    petalPositions[index * 3 + 2] = (Math.random() - 0.5) * 26;
  }
  petalGeometry.setAttribute("position", new THREE.BufferAttribute(petalPositions, 3));
  const petalMaterial = new THREE.PointsMaterial({ size: 0.35, map: redGlow, color: "#FF7A6E", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  orbit.add(new THREE.Points(petalGeometry, petalMaterial));
  const beamMaterials: THREE.MeshBasicMaterial[] = [];
  for (let index = 0; index < 3; index += 1) {
    const material = new THREE.MeshBasicMaterial({ color: "#FFCF6E", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const beam = new THREE.Mesh(new THREE.ConeGeometry(2.6, 13, 4, 1, true), material);
    beam.position.set((index - 1) * 8, 6.5, -6);
    beamMaterials.push(material);
    orbit.add(beam);
  }
  orbit.position.set(0, 0, -158);
  scene.add(orbit);

  const stops = [
    [0, "#070408"], [0.1, "#1d0a0e"], [0.18, "#2a1008"], [0.26, "#170a0c"],
    [0.42, "#100609"], [0.52, "#130620"], [0.64, "#180818"], [0.78, "#150610"],
    [0.9, "#0b0409"], [1, "#070408"],
  ].map(([at, color]) => [at as number, new THREE.Color(color as string)] as const);
  const backgroundAt = (progress: number) => {
    for (let index = 0; index < stops.length - 1; index += 1) {
      const [start, startColor] = stops[index];
      const [end, endColor] = stops[index + 1];
      if (progress <= end) return background.copy(startColor).lerp(endColor, segment(progress, start, end));
    }
    return background.copy(stops[stops.length - 1][1]);
  };

  let target = 0;
  let progress = 0;
  let animationFrame = 0;
  let disposed = false;
  const startedAt = performance.now();
  const tick = (now: number) => {
    if (disposed) return;
    animationFrame = requestAnimationFrame(tick);
    const time = (now - startedAt) / 1000;
    progress += (target - progress) * 0.07;
    const cameraZ = 18 - progress * 206;
    const wobble = drift ? Math.sin(time * 0.4) * 0.35 : 0;
    camera.position.set(wobble + Math.sin(progress * 9) * 1.2, 4 + segment(progress, 0.24, 0.4) * 1.6 - segment(progress, 0.44, 0.6) * 1.4, cameraZ);
    camera.lookAt(wobble * 0.4, 3 + segment(progress, 0.24, 0.4) * 4 - segment(progress, 0.44, 0.56) * 4 + segment(progress, 0.68, 0.82) * 1.5, cameraZ - 26);
    backgroundAt(progress);
    scene.fog!.color.copy(background);
    (scene.fog as THREE.Fog).far = 90 - segment(progress, 0.86, 1) * 50;

    const dawnProgress = segment(progress, 0, 0.16);
    (dawn.material as THREE.SpriteMaterial).opacity = 0.5 * dawnProgress * (1 - segment(progress, 0.24, 0.4));
    metroGeometry.setDrawRange(0, Math.floor(metroIndexCount * segment(progress, 0.015, 0.17)));
    const rangoliProgress = segment(progress, 0.04, 0.2);
    rangoli.scale.setScalar(Math.max(0.001, rangoliProgress * (mobile ? 4 : 5.2)));
    rangoli.rotation.y = time * 0.12;
    rangoli.children.forEach((line) => { ((line as THREE.Line).material as THREE.LineBasicMaterial).opacity = 0.85 * rangoliProgress * (1 - segment(progress, 0.3, 0.42)); });
    lampSprites.forEach((lamp, index) => { (lamp.material as THREE.SpriteMaterial).opacity = 0.55 * segment(progress, 0.02 + index * 0.008, 0.08 + index * 0.008) * (1 + 0.25 * Math.sin(time * 3 + index)); });
    city.visible = progress < 0.4;

    const soudhaProgress = segment(progress, 0.2, 0.34);
    edgeMaterials.forEach((material, index) => { material.opacity = 0.9 * segment(progress, 0.21 + index * 0.012, 0.28 + index * 0.012) * (1 - segment(progress, 0.46, 0.54)); });
    pillarMaterials.forEach((material, index) => material.color.copy(darkPillar).lerp(gold, segment(progress, 0.24 + index * 0.012, 0.29 + index * 0.012) * (1 - segment(progress, 0.46, 0.54))));
    (underGlow.material as THREE.SpriteMaterial).opacity = 0.35 * soudhaProgress * (1 - segment(progress, 0.46, 0.54));
    const sweepProgress = segment(progress, 0.3, 0.42);
    sweep.position.x = lerp(-16, 16, sweepProgress);
    (sweep.material as THREE.SpriteMaterial).opacity = Math.sin(sweepProgress * Math.PI) * 0.5;
    fragments.forEach(({ mesh, angle, radius, height }, index) => {
      const orbitAngle = angle + time * 0.12;
      mesh.position.set(Math.cos(orbitAngle) * radius, height + Math.sin(time * 0.8 + index) * 0.6, Math.sin(orbitAngle) * radius * 0.6);
      mesh.rotation.set(time * 0.5 + index, time * 0.3, 0);
    });
    fragmentGold.opacity = fragmentRed.opacity = 0.65 * soudhaProgress * (1 - segment(progress, 0.46, 0.54));
    soudha.visible = progress > 0.12 && progress < 0.62;

    const neonProgress = segment(progress, 0.42, 0.54) * (1 - segment(progress, 0.72, 0.82));
    roadMaterials.forEach((material, index) => { material.opacity = (0.75 - index * 0.12) * neonProgress; });
    greenMaterial.opacity = 0.6 * neonProgress;
    gridMaterial.opacity = 0.5 * neonProgress;
    streaks.forEach(({ mesh, curve, offset, speed }) => {
      const at = (offset + time * speed) % 1;
      const position = curve.getPointAt(at);
      const tangent = curve.getTangentAt(at);
      mesh.position.copy(position).y += 0.3;
      mesh.lookAt(position.clone().add(tangent));
      mesh.material.opacity = 0.85 * neonProgress;
    });
    buntings.forEach(({ mesh, index }) => { mesh.rotation.z = Math.sin(time * 2.4 + index) * 0.16; });
    buntingMaterials.forEach((material) => { material.opacity = 0.85 * neonProgress; });
    neon.visible = progress > 0.34 && progress < 0.86;

    const orbitProgress = segment(progress, 0.62, 0.74);
    const collapse = segment(progress, 0.88, 1);
    orbit.scale.setScalar(Math.max(0.001, (0.4 + orbitProgress * 0.6) * (1 - collapse * 0.85)));
    orbit.rotation.y = time * 0.06;
    ringMaterials.forEach((material, index) => { material.opacity = (0.8 - index * 0.15) * orbitProgress * (1 - collapse); });
    orbit.children.forEach((child) => { if (typeof child.userData.speed === "number") child.rotation.z = time * child.userData.speed; });
    posters.forEach(({ mesh, angle, radius }, index) => {
      const posterAngle = angle + time * 0.1;
      mesh.position.set(Math.cos(posterAngle) * radius, 3.6 + Math.sin(time * 0.7 + index) * 0.5, Math.sin(posterAngle) * radius);
      mesh.lookAt(0, 3.6, 20);
      mesh.material.opacity = segment(progress, 0.63 + index * 0.014, 0.7 + index * 0.014) * (1 - collapse);
    });
    coins.forEach(({ mesh, angle }, index) => {
      const coinAngle = angle - time * 0.22;
      mesh.position.set(Math.cos(coinAngle) * 4.4, 2.4 + Math.sin(time * 1.3 + index) * 0.7, Math.sin(coinAngle) * 4.4);
      mesh.rotation.y = time * 2 + index;
    });
    coinMaterial.opacity = 0.9 * segment(progress, 0.7, 0.78) * (1 - collapse);
    orbitLamps.forEach(({ sprite, angle }, index) => {
      const lampAngle = angle + time * 0.08;
      sprite.position.set(Math.cos(lampAngle) * 10.5, 5 + Math.sin(time + index) * 0.8, Math.sin(lampAngle) * 10.5);
      (sprite.material as THREE.SpriteMaterial).opacity = 0.5 * orbitProgress * (1 - collapse) * (1 + 0.2 * Math.sin(time * 2.5 + index));
    });
    petalMaterial.opacity = 0.7 * orbitProgress * (1 - collapse);
    const petals = petalGeometry.attributes.position as THREE.BufferAttribute;
    for (let index = 0; index < petalCount; index += 1) {
      let y = petals.getY(index) - 0.008;
      if (y < 0) y = 16;
      petals.setY(index, y);
    }
    petals.needsUpdate = true;
    beamMaterials.forEach((material, index) => { material.opacity = 0.06 * orbitProgress * (1 - collapse) * (1 + 0.5 * Math.sin(time * 1.6 + index * 2)); });
    orbit.visible = progress > 0.56;
    particleMaterial.opacity = 0.75 * (1 - collapse * 0.7);
    scene.rotation.z = drift ? Math.sin(time * 0.2) * 0.008 : 0;
    renderer.render(scene, camera);
  };
  animationFrame = requestAnimationFrame(tick);

  const resize = () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };
  window.addEventListener("resize", resize);
  return {
    setProgress(value: number) { target = Math.min(1, Math.max(0, value)); },
    dispose() {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      renderer.dispose();
      warmGlow.dispose();
      redGlow.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    },
  };
}
