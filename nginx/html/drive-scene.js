import * as THREE from './vendor/three.module.js';

const canvas = document.querySelector('#scene');
document.documentElement.dataset.scene = 'loading';
const statusPanel = document.querySelector('#portal-status');
const statusTitle = document.querySelector('#portal-title');
const routeLinks = Array.from(document.querySelectorAll('.route'));

const routes = [
  {
    key: 'truss',
    title: 'Truss Engine',
    subtitle: '桁架组合平台',
    path: '/truss-engine/',
    href: '/truss-engine/',
    previewHref: 'https://almoststable.com/truss-engine/',
    color: 0xf4c95d,
    position: new THREE.Vector3(-12, 0, -9.5),
    angle: Math.PI * 0.18,
  },
  {
    key: 'tools',
    title: 'Web Tools',
    subtitle: '个人工具集合',
    path: '/web-tools/',
    href: '/web-tools/',
    previewHref: 'https://almoststable.com/web-tools/',
    color: 0x8cebd6,
    position: new THREE.Vector3(-4, 0, -14),
    angle: Math.PI * 0.06,
    enterRadius: 2.45,
  },
  {
    key: 'scripts',
    title: 'Userscripts',
    subtitle: '油猴脚本库',
    path: '/userscripts/',
    href: '/userscripts/',
    previewHref: 'https://almoststable.com/userscripts/',
    color: 0xa6e86d,
    position: new THREE.Vector3(4, 0, -14),
    angle: -Math.PI * 0.06,
  },
  {
    key: 'blog',
    title: 'Blog',
    subtitle: '个人博客',
    path: '/blog/',
    href: '/blog/',
    previewHref: 'https://qianxunslimg.space/',
    color: 0xf2a3b3,
    position: new THREE.Vector3(12, 0, -9.5),
    angle: -Math.PI * 0.18,
  },
];

const keys = {
  forward: false,
  back: false,
  left: false,
  right: false,
};

let activeRoute = null;
let pendingRoute = null;
let pendingEnterTimer = null;
let speed = 0;
let heading = Math.PI;

const DEFAULT_ACTIVE_RADIUS = 3.85;
const DEFAULT_ENTER_RADIUS = 3.35;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080b10);
scene.fog = new THREE.Fog(0x080b10, 34, 76);

const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 160);
camera.position.set(0, 7, 18);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const interactiveObjects = [];
const portalMeshes = [];
const wheelMeshes = [];
const collisionObstacles = [];
const dynamicCones = [];

const CAR_COLLISION_RADIUS = 0.92;
const WORLD_LIMITS = {
  minX: -19.25,
  maxX: 19.25,
  minZ: -15.45,
  maxZ: 15.45,
};

const materials = {
  ground: new THREE.MeshStandardMaterial({
    color: 0x101925,
    roughness: 0.86,
    metalness: 0.04,
  }),
  road: new THREE.MeshStandardMaterial({
    color: 0x1a2735,
    roughness: 0.78,
    metalness: 0.05,
  }),
  line: new THREE.MeshStandardMaterial({
    color: 0x5f7895,
    roughness: 0.55,
    metalness: 0.1,
    emissive: 0x122334,
  }),
  carBody: new THREE.MeshStandardMaterial({
    color: 0xf3efe6,
    roughness: 0.38,
    metalness: 0.25,
  }),
  carCabin: new THREE.MeshStandardMaterial({
    color: 0x182334,
    roughness: 0.3,
    metalness: 0.32,
    transparent: true,
    opacity: 0.88,
  }),
  tire: new THREE.MeshStandardMaterial({
    color: 0x08090c,
    roughness: 0.84,
    metalness: 0.05,
  }),
  rim: new THREE.MeshStandardMaterial({
    color: 0x95a6ba,
    roughness: 0.34,
    metalness: 0.62,
  }),
  barrier: new THREE.MeshStandardMaterial({
    color: 0x1e2b3b,
    roughness: 0.65,
    metalness: 0.12,
  }),
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function createBox(width, height, depth, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function addEdgeGlow(mesh, color, opacity = 0.62) {
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry),
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
    })
  );
  mesh.add(edges);
  return edges;
}

function createGlowStrip(width, depth, x, z, color, opacity = 0.78) {
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.045, depth),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
    })
  );
  strip.position.set(x, 0.09, z);
  scene.add(strip);
  return strip;
}

function createNeonTower(x, z, width, height, depth, color, accentColor) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.48,
    metalness: 0.28,
    emissive: color,
    emissiveIntensity: 0.08,
  });
  const tower = createBox(width, height, depth, material, x, height / 2 - 0.02, z);
  addEdgeGlow(tower, accentColor, 0.5);

  const windowMaterial = new THREE.MeshBasicMaterial({
    color: accentColor,
    transparent: true,
    opacity: 0.58,
  });
  const rows = Math.max(2, Math.floor(height / 1.15));
  for (let row = 0; row < rows; row += 1) {
    const y = 0.75 + row * 0.88;
    const front = new THREE.Mesh(new THREE.BoxGeometry(width * 0.58, 0.055, 0.035), windowMaterial);
    front.position.set(0, y - height / 2, -depth / 2 - 0.025);
    tower.add(front);

    if (row % 2 === 0) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.055, depth * 0.48), windowMaterial);
      side.position.set(width / 2 + 0.025, y - height / 2, 0);
      tower.add(side);
    }
  }

  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.92, 0.08, depth * 0.92),
    new THREE.MeshBasicMaterial({
      color: accentColor,
      transparent: true,
      opacity: 0.42,
    })
  );
  cap.position.set(0, height / 2 + 0.055, 0);
  tower.add(cap);

  const glow = new THREE.PointLight(accentColor, 0.55, 8.5, 2.5);
  glow.position.set(x, height + 0.7, z);
  scene.add(glow);

  return tower;
}

function registerBoxCollider(x, z, width, depth, padding = 0.18) {
  collisionObstacles.push({
    type: 'box',
    x,
    z,
    halfX: width / 2 + padding,
    halfZ: depth / 2 + padding,
  });
}

function hitsObstacle(position) {
  if (
    position.x < WORLD_LIMITS.minX ||
    position.x > WORLD_LIMITS.maxX ||
    position.z < WORLD_LIMITS.minZ ||
    position.z > WORLD_LIMITS.maxZ
  ) {
    return true;
  }

  return collisionObstacles.some((obstacle) => {
    if (obstacle.type === 'circle') {
      const dx = position.x - obstacle.x;
      const dz = position.z - obstacle.z;
      const radius = CAR_COLLISION_RADIUS + obstacle.radius;
      return dx * dx + dz * dz < radius * radius;
    }

    const closestX = clamp(position.x, obstacle.x - obstacle.halfX, obstacle.x + obstacle.halfX);
    const closestZ = clamp(position.z, obstacle.z - obstacle.halfZ, obstacle.z + obstacle.halfZ);
    const dx = position.x - closestX;
    const dz = position.z - closestZ;
    return dx * dx + dz * dz < CAR_COLLISION_RADIUS * CAR_COLLISION_RADIUS;
  });
}

function moveWithCollision(car, movement) {
  const nextPosition = car.position.clone().add(movement);
  if (!hitsObstacle(nextPosition)) {
    car.position.copy(nextPosition);
    return false;
  }

  const slideX = car.position.clone();
  slideX.x += movement.x;
  const slideZ = car.position.clone();
  slideZ.z += movement.z;

  let moved = false;
  if (!hitsObstacle(slideX)) {
    car.position.x = slideX.x;
    moved = true;
  }
  if (!hitsObstacle(slideZ)) {
    car.position.z = slideZ.z;
    moved = true;
  }

  speed *= moved ? 0.42 : -0.22;
  return true;
}

function updateDynamicCones(car, forward, dt) {
  dynamicCones.forEach((cone) => {
    const dx = cone.mesh.position.x - car.position.x;
    const dz = cone.mesh.position.z - car.position.z;
    const distance = Math.hypot(dx, dz);
    const minDistance = CAR_COLLISION_RADIUS + cone.radius;

    if (distance < minDistance) {
      const pushDirection = distance > 0.001
        ? new THREE.Vector3(dx / distance, 0, dz / distance)
        : forward.clone();
      const overlap = minDistance - distance;
      cone.mesh.position.addScaledVector(pushDirection, overlap + 0.035);
      cone.velocity.addScaledVector(pushDirection, Math.max(2.4, Math.abs(speed) * 0.9));
      cone.spin += Math.sign(pushDirection.x || 1) * 2.1;
      speed *= 0.88;
    }

    const frameVelocity = cone.velocity.clone().multiplyScalar(dt);
    const nextPosition = cone.mesh.position.clone().add(frameVelocity);
    const bouncedX = nextPosition.x < WORLD_LIMITS.minX || nextPosition.x > WORLD_LIMITS.maxX;
    const bouncedZ = nextPosition.z < WORLD_LIMITS.minZ || nextPosition.z > WORLD_LIMITS.maxZ;

    cone.mesh.position.x = clamp(nextPosition.x, WORLD_LIMITS.minX, WORLD_LIMITS.maxX);
    cone.mesh.position.z = clamp(nextPosition.z, WORLD_LIMITS.minZ, WORLD_LIMITS.maxZ);

    if (bouncedX) cone.velocity.x *= -0.35;
    if (bouncedZ) cone.velocity.z *= -0.35;

    if (hitsObstacle(cone.mesh.position)) {
      cone.mesh.position.copy(cone.home);
      cone.velocity.set(0, 0, 0);
    }

    cone.velocity.multiplyScalar(Math.pow(0.88, dt * 60));
    if (cone.velocity.lengthSq() < 0.01) {
      cone.velocity.set(0, 0, 0);
    }

    const coneSpeed = clamp(cone.velocity.length() / 9, 0, 1);
    cone.mesh.rotation.x = THREE.MathUtils.lerp(cone.mesh.rotation.x, cone.velocity.z * 0.045, 0.22);
    cone.mesh.rotation.z = THREE.MathUtils.lerp(cone.mesh.rotation.z, -cone.velocity.x * 0.045, 0.22);
    cone.mesh.rotation.y += cone.spin * dt * coneSpeed;
    cone.spin *= Math.pow(0.86, dt * 60);
  });
}

function createRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function createSignTexture(route) {
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = 1024;
  textureCanvas.height = 512;
  const ctx = textureCanvas.getContext('2d');
  const accent = `#${route.color.toString(16).padStart(6, '0')}`;

  const gradient = ctx.createLinearGradient(0, 0, 1024, 512);
  gradient.addColorStop(0, '#101822');
  gradient.addColorStop(1, '#080b10');

  ctx.fillStyle = gradient;
  createRoundedRect(ctx, 28, 30, 968, 452, 42);
  ctx.fill();

  ctx.strokeStyle = accent;
  ctx.lineWidth = 7;
  createRoundedRect(ctx, 28, 30, 968, 452, 42);
  ctx.stroke();

  ctx.fillStyle = accent;
  ctx.font = '700 44px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillText(route.path, 72, 112);

  ctx.fillStyle = '#f3efe6';
  ctx.font = '800 96px Inter, system-ui, sans-serif';
  ctx.fillText(route.title, 72, 250);

  ctx.fillStyle = '#b8c7d8';
  ctx.font = '600 42px Inter, system-ui, sans-serif';
  ctx.fillText(route.subtitle, 76, 330);

  ctx.fillStyle = accent;
  ctx.font = '800 42px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillText('PARK TO ENTER', 76, 412);

  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function createPortal(route) {
  const group = new THREE.Group();
  group.position.copy(route.position);
  group.rotation.y = route.angle;
  scene.add(group);

  const accent = new THREE.Color(route.color);

  const padMaterial = new THREE.MeshBasicMaterial({
    color: route.color,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const pad = new THREE.Mesh(new THREE.CircleGeometry(2.7, 64), padMaterial);
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.045;
  pad.userData.route = route;
  group.add(pad);
  portalMeshes.push(pad);
  interactiveObjects.push(pad);

  const ringMaterial = new THREE.MeshStandardMaterial({
    color: route.color,
    emissive: route.color,
    emissiveIntensity: 1.2,
    roughness: 0.35,
    metalness: 0.32,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.045, 12, 96), ringMaterial);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.08;
  ring.userData.route = route;
  group.add(ring);
  portalMeshes.push(ring);
  interactiveObjects.push(ring);

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 2.55, 7.5, 48, 1, true),
    new THREE.MeshBasicMaterial({
      color: route.color,
      transparent: true,
      opacity: 0.055,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  beam.position.y = 3.78;
  beam.userData.route = route;
  beam.userData.isBeam = true;
  group.add(beam);
  portalMeshes.push(beam);

  const signTexture = createSignTexture(route);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(4.5, 2.25),
    new THREE.MeshBasicMaterial({
      map: signTexture,
      transparent: true,
    })
  );
  sign.position.set(0, 2.15, -2.25);
  sign.userData.route = route;
  group.add(sign);
  interactiveObjects.push(sign);

  const poleMaterial = new THREE.MeshStandardMaterial({
    color: 0x718196,
    roughness: 0.4,
    metalness: 0.55,
  });
  const poleA = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 2.25, 12), poleMaterial);
  poleA.position.set(-2.12, 1.06, -2.58);
  poleA.castShadow = true;
  group.add(poleA);
  const poleB = poleA.clone();
  poleB.position.x = 2.12;
  group.add(poleB);

  const light = new THREE.PointLight(accent, 1.4, 9, 2.2);
  light.position.set(0, 1.1, -0.2);
  group.add(light);

  return { group, route, pad, ring, sign };
}

function createGround() {
  const grid = new THREE.GridHelper(42, 42, 0x2e4b63, 0x162637);
  grid.position.y = 0.062;
  scene.add(grid);

  const base = new THREE.Mesh(new THREE.BoxGeometry(42, 0.5, 34), materials.ground);
  base.position.y = -0.28;
  base.receiveShadow = true;
  scene.add(base);

  const roadA = new THREE.Mesh(new THREE.BoxGeometry(35, 0.05, 5.2), materials.road);
  roadA.position.set(0, 0.015, 2);
  roadA.receiveShadow = true;
  scene.add(roadA);

  const roadB = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.052, 27), materials.road);
  roadB.position.set(0, 0.02, -3);
  roadB.receiveShadow = true;
  scene.add(roadB);

  for (let i = -15; i <= 15; i += 3) {
    const mark = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.065, 0.06), materials.line);
    mark.position.set(i, 0.07, 2);
    scene.add(mark);
  }

  for (let z = -14; z <= 9; z += 3) {
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.065, 1.3), materials.line);
    mark.position.set(0, 0.075, z);
    scene.add(mark);
  }

  const edgeMaterial = new THREE.MeshStandardMaterial({
    color: 0x111a24,
    roughness: 0.58,
    metalness: 0.18,
  });
  createBox(42.8, 0.55, 0.42, edgeMaterial, 0, 0.13, -17.2);
  createBox(42.8, 0.55, 0.42, edgeMaterial, 0, 0.13, 17.2);
  createBox(0.42, 0.55, 34.2, edgeMaterial, -21.2, 0.13, 0);
  createBox(0.42, 0.55, 34.2, edgeMaterial, 21.2, 0.13, 0);
  registerBoxCollider(0, -17.2, 42.8, 0.42, 0.35);
  registerBoxCollider(0, 17.2, 42.8, 0.42, 0.35);
  registerBoxCollider(-21.2, 0, 0.42, 34.2, 0.35);
  registerBoxCollider(21.2, 0, 0.42, 34.2, 0.35);
}

function createCityPieces() {
  const buildings = [
    [-17.2, -12.4, 1.9, 5.6, 1.9, 0x142335, 0x8cebd6],
    [-16.2, -6.2, 2.2, 3.4, 1.65, 0x192132, 0xf4c95d],
    [-17.2, 9.0, 1.7, 4.2, 2.0, 0x142335, 0xf2a3b3],
    [16.8, -12.2, 2.1, 4.9, 1.8, 0x142335, 0x8cebd6],
    [16.4, -4.2, 1.95, 3.2, 2.0, 0x1a2434, 0xf2a3b3],
    [17.1, 8.8, 1.8, 5.3, 1.75, 0x142335, 0xf4c95d],
  ];

  buildings.forEach(([x, z, w, h, d, color, accent]) => {
    createNeonTower(x, z, w, h, d, color, accent);
    registerBoxCollider(x, z, w, d, 0.35);
  });

  createGlowStrip(6.4, 0.09, -7.2, -1.6, 0x8cebd6, 0.58);
  createGlowStrip(0.09, 2.4, -4.0, -1.6, 0x8cebd6, 0.45);
  createGlowStrip(5.4, 0.08, 7.4, -1.6, 0xf2a3b3, 0.45);
  createGlowStrip(0.08, 2.2, 10.1, -1.6, 0xf2a3b3, 0.38);

  const coneMaterial = new THREE.MeshStandardMaterial({
    color: 0xf4c95d,
    roughness: 0.52,
    metalness: 0.05,
    emissive: 0x241707,
  });

  [
    [-5.2, 6.8],
    [-3.5, 6.8],
    [3.8, 6.8],
    [5.5, 6.8],
    [-13.5, 1.4],
    [13.5, 1.4],
  ].forEach(([x, z]) => {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 18), coneMaterial);
    cone.position.set(x, 0.45, z);
    cone.castShadow = true;
    scene.add(cone);
    dynamicCones.push({
      mesh: cone,
      radius: 0.42,
      velocity: new THREE.Vector3(),
      home: cone.position.clone(),
      spin: 0,
    });
  });
}

function createCar() {
  const car = new THREE.Group();
  car.position.set(0, 0.38, 10.5);
  car.rotation.y = heading;
  scene.add(car);

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.48, 2.6), materials.carBody);
  body.position.y = 0.48;
  body.castShadow = true;
  car.add(body);

  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.18, 0.86), materials.carBody);
  hood.position.set(0, 0.72, -0.78);
  hood.castShadow = true;
  car.add(hood);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.58, 1.06), materials.carCabin);
  cabin.position.set(0, 0.96, 0.2);
  cabin.castShadow = true;
  car.add(cabin);

  const bumper = new THREE.Mesh(
    new THREE.BoxGeometry(1.38, 0.12, 0.12),
    new THREE.MeshStandardMaterial({
      color: 0xf4c95d,
      roughness: 0.4,
      metalness: 0.4,
      emissive: 0x281d07,
    })
  );
  bumper.position.set(0, 0.55, -1.38);
  bumper.castShadow = true;
  car.add(bumper);

  const wheelGeometry = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 24);
  const wheelPositions = [
    [-0.88, 0.34, -0.82],
    [0.88, 0.34, -0.82],
    [-0.88, 0.34, 0.82],
    [0.88, 0.34, 0.82],
  ];
  wheelPositions.forEach(([x, y, z]) => {
    const wheel = new THREE.Mesh(wheelGeometry, materials.tire);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, y, z);
    wheel.castShadow = true;
    car.add(wheel);
    wheelMeshes.push(wheel);

    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.255, 18), materials.rim);
    rim.rotation.z = Math.PI / 2;
    rim.position.copy(wheel.position);
    car.add(rim);
  });

  const leftLamp = new THREE.PointLight(0xf4c95d, 0.55, 9, 2.5);
  leftLamp.position.set(-0.45, 0.58, -1.54);
  car.add(leftLamp);
  const rightLamp = leftLamp.clone();
  rightLamp.position.x = 0.45;
  car.add(rightLamp);

  return car;
}

function createLighting() {
  const hemisphere = new THREE.HemisphereLight(0xd4e6ff, 0x07101a, 1.45);
  scene.add(hemisphere);

  const moon = new THREE.DirectionalLight(0xd6e8ff, 2);
  moon.position.set(-10, 18, 12);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -25;
  moon.shadow.camera.right = 25;
  moon.shadow.camera.top = 25;
  moon.shadow.camera.bottom = -25;
  scene.add(moon);

  const centralGlow = new THREE.PointLight(0x8cebd6, 2.2, 30, 2.2);
  centralGlow.position.set(0, 4.6, 1);
  scene.add(centralGlow);

  const warmParkingLight = new THREE.PointLight(0xf4c95d, 1.15, 24, 2.3);
  warmParkingLight.position.set(0, 3.2, 10);
  scene.add(warmParkingLight);
}

function createStars() {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  for (let i = 0; i < 170; i += 1) {
    const radius = 42 + Math.random() * 34;
    const angle = Math.random() * Math.PI * 2;
    positions.push(Math.sin(angle) * radius, 15 + Math.random() * 26, Math.cos(angle) * radius);
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0x9fb4ce,
    size: 0.06,
    transparent: true,
    opacity: 0.72,
  });
  scene.add(new THREE.Points(geometry, material));
}

function setActiveRoute(route) {
  if (activeRoute?.key === route?.key) return;
  activeRoute = route || null;

  routeLinks.forEach((link) => {
    link.classList.toggle('is-active', link.dataset.route === activeRoute?.key);
  });

  if (activeRoute) {
    statusTitle.textContent = `${activeRoute.title} · ${activeRoute.subtitle}`;
    statusPanel.classList.add('is-active');
  } else {
    statusPanel.classList.remove('is-active');
  }
}

function resolveHref(route) {
  const localHostnames = new Set(['localhost', '127.0.0.1', '0.0.0.0']);
  return localHostnames.has(window.location.hostname) ? route.previewHref : route.href;
}

function openRoute(route) {
  if (!route) return;
  window.location.href = resolveHref(route);
}

function scheduleRouteEnter(route) {
  if (!route || pendingRoute?.key === route.key) return;
  clearTimeout(pendingEnterTimer);
  pendingRoute = route;
  statusTitle.textContent = `${route.title} · ${route.subtitle}`;
  statusPanel.classList.add('is-active');
  pendingEnterTimer = window.setTimeout(() => {
    openRoute(route);
  }, 30);
}

function cancelRouteEnter() {
  if (!pendingRoute) return;
  clearTimeout(pendingEnterTimer);
  pendingRoute = null;
}

function updatePortalState(car) {
  let next = null;
  let nearestDistance = Infinity;

  routes.forEach((route) => {
    const distance = car.position.distanceTo(route.position);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      next = route;
    }
  });

  const active = nearestDistance < DEFAULT_ACTIVE_RADIUS ? next : null;
  setActiveRoute(active);

  if (active && nearestDistance < (active.enterRadius ?? DEFAULT_ENTER_RADIUS)) {
    scheduleRouteEnter(active);
  } else {
    cancelRouteEnter();
  }
}

function handleKey(key, isDown) {
  if (key === 'w' || key === 'arrowup') keys.forward = isDown;
  if (key === 's' || key === 'arrowdown') keys.back = isDown;
  if (key === 'a' || key === 'arrowleft') keys.left = isDown;
  if (key === 'd' || key === 'arrowright') keys.right = isDown;
}

function bindControls() {
  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      event.preventDefault();
      handleKey(key, true);
    }
  });

  window.addEventListener('keyup', (event) => {
    handleKey(event.key.toLowerCase(), false);
  });

  document.querySelectorAll('[data-control]').forEach((button) => {
    const control = button.dataset.control;
    const setControl = (value) => {
      keys[control] = value;
    };
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      setControl(true);
    });
    button.addEventListener('pointerup', () => setControl(false));
    button.addEventListener('pointercancel', () => setControl(false));
    button.addEventListener('pointerleave', () => setControl(false));
  });

  routeLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const route = routes.find((item) => item.key === link.dataset.route);
      openRoute(route);
    });
  });

  canvas.addEventListener('pointerdown', (event) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(interactiveObjects, true)[0];
    if (hit?.object?.userData?.route) {
      openRoute(hit.object.userData.route);
    }
  });
}

function updateCar(car, dt) {
  const throttle = (keys.forward ? 1 : 0) - (keys.back ? 1 : 0);
  const steer = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
  const acceleration = throttle * (throttle > 0 ? 12.5 : 8.2);

  speed += acceleration * dt;
  if (throttle === 0) {
    speed *= Math.pow(0.965, dt * 60);
    if (Math.abs(speed) < 0.03) speed = 0;
  } else {
    speed *= Math.pow(0.992, dt * 60);
  }
  speed = clamp(speed, -5.3, 10.8);

  const speedFactor = clamp(Math.abs(speed) / 8, 0, 1);
  const steeringPower = (1.25 + speedFactor * 1.1) * (speed >= 0 ? 1 : -1);
  heading += steer * steeringPower * dt;

  const forward = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
  const movement = forward.clone().multiplyScalar(speed * dt);
  const collided = moveWithCollision(car, movement);
  updateDynamicCones(car, forward, dt);

  car.rotation.y = heading;

  const tilt = clamp(steer * speedFactor * 0.08, -0.08, 0.08);
  const bump = collided ? Math.sign(speed || throttle || 1) * -0.045 : 0;
  car.rotation.x = THREE.MathUtils.lerp(car.rotation.x, bump, 0.18);
  car.rotation.z = THREE.MathUtils.lerp(car.rotation.z, tilt, 0.12);

  wheelMeshes.forEach((wheel) => {
    wheel.rotation.x += speed * dt * 2.9;
  });
}

function updateCamera(car) {
  const forward = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
  const desiredPosition = car.position.clone()
    .addScaledVector(forward, -9.8)
    .add(new THREE.Vector3(0, 6.4, 0));
  const lookAt = car.position.clone()
    .addScaledVector(forward, 7)
    .add(new THREE.Vector3(0, 1.2, 0));

  camera.position.lerp(desiredPosition, 0.075);
  camera.lookAt(lookAt);
}

function animatePortals(elapsed) {
  portalMeshes.forEach((mesh, index) => {
    const route = mesh.userData.route;
    if (!route) return;
    const active = route.key === activeRoute?.key;
    const material = mesh.material;
    if ('opacity' in material) {
      const targetOpacity = mesh.userData.isBeam
        ? (active ? 0.12 : 0.045)
        : (active ? 0.32 : 0.17);
      material.opacity = THREE.MathUtils.lerp(material.opacity, targetOpacity, 0.12);
    }
    if (mesh.geometry.type === 'TorusGeometry') {
      mesh.rotation.z = elapsed * 0.45 + index;
      mesh.scale.setScalar(1 + Math.sin(elapsed * 2.4 + index) * (active ? 0.035 : 0.015));
      material.emissiveIntensity = THREE.MathUtils.lerp(material.emissiveIntensity, active ? 2.15 : 1.1, 0.1);
    }
  });
}

createLighting();
createGround();
createCityPieces();
createStars();
routes.forEach(createPortal);
const car = createCar();
bindControls();
document.documentElement.dataset.scene = 'ready';

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.034);
  const elapsed = clock.elapsedTime;

  updateCar(car, dt);
  updatePortalState(car);
  updateCamera(car);
  animatePortals(elapsed);

  const intro = easeOutCubic(clamp(elapsed / 1.5, 0, 1));
  scene.fog.near = 18 + intro * 8;

  renderer.render(scene, camera);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
});
