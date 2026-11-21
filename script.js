import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const defaults = {
  paint: 'Volt Lime',
  wheels: 'Aero 5-Spoke',
  aero: 'Street',
  lights: 'LED / White',
  interior: 'Graphite',
  underglow: false,
  headlights: true
};

const options = {
  paint: [
    { name: 'Volt Lime', hex: '#b7e63d', price: 0 },
    { name: 'Arctic White', hex: '#e8ece7', price: 18000 },
    { name: 'Obsidian', hex: '#171d21', price: 22000 },
    { name: 'Crimson', hex: '#bd263a', price: 25000 },
    { name: 'Electric Blue', hex: '#1d64bd', price: 28000 },
    { name: 'Sunset Orange', hex: '#f07832', price: 22000 },
    { name: 'Titanium', hex: '#818b8c', price: 32000 },
    { name: 'Violet Storm', hex: '#7653a7', price: 30000 }
  ],
  wheels: [
    { name: 'Aero 5-Spoke', detail: 'Lightweight flow-formed', price: 0, icon: '✥' },
    { name: 'Track 10-Spoke', detail: 'Motorsport inspired', price: 42000, icon: '✳' },
    { name: 'Turbine Disc', detail: 'Closed-face aero design', price: 56000, icon: '◉' }
  ],
  aero: [
    { name: 'Street', detail: 'Clean factory silhouette', price: 0, icon: '⌁' },
    { name: 'Sport', detail: 'Front splitter + side skirts', price: 68000, icon: '⌁' },
    { name: 'Track', detail: 'Splitter + rear wing package', price: 125000, icon: '⌁' }
  ],
  lights: [
    { name: 'LED / White', detail: 'Ice-white signature lighting', price: 0, icon: '✧' },
    { name: 'Laser / Ice Blue', detail: 'Cool blue accent lighting', price: 32000, icon: '✧' },
    { name: 'Matrix / Amber', detail: 'Warm motorsport signature', price: 24000, icon: '✧' }
  ],
  interior: [
    { name: 'Graphite', detail: 'Dark technical fabric', price: 0, icon: '▣' },
    { name: 'Oxblood', detail: 'Deep red performance trim', price: 45000, icon: '▣' },
    { name: 'Sandstone', detail: 'Warm premium leather', price: 52000, icon: '▣' }
  ]
};

const basePrice = 1850000;
let state = { ...defaults };
let currentTab = 'paint';
let toastTimer;
let scene, camera, renderer, car, bodyMaterial, wheelGroups = [], headlightMaterials = [], underglowLight, underglowMesh;
let driving = false;
let driveStart = 0;
let dragging = false;
let previousPointerX = 0;
let desiredCamera = { x: 6.3, y: 3.45, z: 6.9 };
let cameraTween = null;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function money(value) {
  return new Intl.NumberFormat('en-IN').format(value);
}

function getExtraPrice() {
  const selected = Object.entries(state).reduce((sum, [key, value]) => {
    if (!options[key]) return sum;
    return sum + (options[key].find(item => item.name === value)?.price || 0);
  }, 0);
  return selected + (state.underglow ? 18000 : 0);
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2300);
}

function renderControls(tab) {
  currentTab = tab;
  $$('.category-tab').forEach(button => {
    const active = button.dataset.tab === tab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  const step = ['paint', 'wheels', 'aero', 'lighting', 'interior'].indexOf(tab) + 1;
  $('.step-count').innerHTML = `${String(step).padStart(2, '0')} <b>/</b> 05`;
  const content = $('#control-content');

  if (tab === 'paint') {
    content.innerHTML = `
      <div class="control-title-row"><h3>Exterior paint</h3><span>01 / COLOUR</span></div>
      <p class="control-description">Choose a finish that makes the first impression.</p>
      <div class="swatch-grid">
        ${options.paint.map(item => `<button class="swatch-option ${state.paint === item.name ? 'selected' : ''}" data-value="${item.name}" type="button" aria-label="${item.name}" aria-pressed="${state.paint === item.name}"><span class="swatch-color" style="background:${item.hex}"></span><small>${item.name}</small></button>`).join('')}
      </div>
      <div style="margin-top:20px" class="toggle-row"><div class="toggle-copy"><strong>Neon underglow</strong><small>Subtle lime light beneath the car</small></div><label class="switch"><input id="underglow-toggle" type="checkbox" ${state.underglow ? 'checked' : ''}><span class="switch-track"></span></label></div>`;
    $$('[data-value]', content).forEach(button => button.addEventListener('click', () => setChoice('paint', button.dataset.value)));
    $('#underglow-toggle').addEventListener('change', event => { state.underglow = event.target.checked; updateCar(); updateSummary(); });
  } else {
    const titleMap = { wheels: ['Wheel design', '02 / ROLLING STOCK'], aero: ['Aerodynamic package', '03 / BODYWORK'], lighting: ['Light signature', '04 / ILLUMINATION'], interior: ['Cabin finish', '05 / INTERIOR'] };
    const [title, label] = titleMap[tab];
    content.innerHTML = `
      <div class="control-title-row"><h3>${title}</h3><span>${label}</span></div>
      <p class="control-description">${tab === 'wheels' ? 'Set the stance with a wheel design that fits your build.' : tab === 'aero' ? 'Choose the right balance of presence and performance.' : tab === 'lighting' ? 'Give your machine a signature after dark.' : 'Pick the atmosphere waiting inside the cockpit.'}</p>
      <div class="option-list">
        ${options[tab].map(item => `<button class="option-card ${state[tab] === item.name ? 'selected' : ''}" data-value="${item.name}" type="button" aria-pressed="${state[tab] === item.name}"><span class="option-art">${item.icon}</span><span class="option-copy"><strong>${item.name}</strong><small>${item.detail}</small></span><span class="option-price">${item.price ? `+₹${money(item.price)}` : 'INCLUDED'}</span></button>`).join('')}
      </div>
      ${tab === 'lighting' ? `<div class="toggle-row" style="margin-top:16px"><div class="toggle-copy"><strong>Headlights</strong><small>Switch the front lights on or off</small></div><label class="switch"><input id="headlights-toggle" type="checkbox" ${state.headlights ? 'checked' : ''}><span class="switch-track"></span></label></div>` : ''}`;
    $$('[data-value]', content).forEach(button => button.addEventListener('click', () => setChoice(tab, button.dataset.value)));
    if (tab === 'lighting') $('#headlights-toggle').addEventListener('change', event => { state.headlights = event.target.checked; updateCar(); });
  }

  if (window.gsap && !reducedMotion) gsap.fromTo(content.children, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: .35, stagger: .045, ease: 'power2.out', clearProps: 'all' });
}

function setChoice(category, value) {
  state[category] = value;
  updateCar();
  updateSummary();
  renderControls(category);
}

function updateSummary() {
  $('#summary-paint').textContent = state.paint;
  $('#summary-wheels').textContent = state.wheels.replace('Track ', 'Track ').replace('Aero ', 'Aero ');
  $('#summary-aero').textContent = state.aero;
  $('#summary-lights').textContent = state.lights;
  $('#summary-interior').textContent = state.interior;
  $('#total-price').textContent = money(basePrice + getExtraPrice());
}

function makeMaterial(color, roughness = .35, metalness = .35) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function addBox(parent, geometry, material, position, rotation) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addPolygon(parent, points, material) {
  const vertices = [];
  for (let i = 1; i < points.length - 1; i++) {
    vertices.push(...points[0], ...points[i], ...points[i + 1]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.material.side = THREE.DoubleSide;
  parent.add(mesh);
  return mesh;
}

function makeWheel(style) {
  const group = new THREE.Group();
  const tireMat = makeMaterial('#111517', .86, .08);
  const rimMat = makeMaterial('#a9b1aa', .26, .82);
  const darkMat = makeMaterial('#303a3b', .38, .75);
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(.48, .48, .27, 40, 1), tireMat);
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = true;
  group.add(tire);

  const rim = new THREE.Mesh(new THREE.CylinderGeometry(.335, .335, .285, 40, 1), darkMat);
  rim.rotation.z = Math.PI / 2;
  group.add(rim);
  const torus = new THREE.Mesh(new THREE.TorusGeometry(.31, .027, 10, 48), rimMat);
  torus.rotation.y = Math.PI / 2;
  group.add(torus);

  const spokeCount = style === 'Track 10-Spoke' ? 10 : style === 'Turbine Disc' ? 7 : 5;
  if (style === 'Turbine Disc') {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(.285, .285, .07, 40), rimMat);
    disc.rotation.z = Math.PI / 2;
    disc.position.x = .012;
    group.add(disc);
    for (let i = 0; i < spokeCount; i++) {
      const angle = (Math.PI * 2 * i) / spokeCount;
      const cut = new THREE.Mesh(new THREE.BoxGeometry(.012, .115, .06), darkMat);
      cut.position.set(.053, Math.cos(angle) * .19, Math.sin(angle) * .19);
      cut.rotation.x = -angle;
      group.add(cut);
    }
  } else {
    for (let i = 0; i < spokeCount; i++) {
      const angle = (Math.PI * 2 * i) / spokeCount;
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(.065, style === 'Track 10-Spoke' ? .31 : .34, .055), rimMat);
      spoke.position.set(0, Math.cos(angle) * .16, Math.sin(angle) * .16);
      spoke.rotation.x = -angle;
      group.add(spoke);
    }
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .31, 24), makeMaterial('#d0d6cc', .2, .9));
  hub.rotation.z = Math.PI / 2;
  group.add(hub);
  return group;
}

function createCar() {
  car = new THREE.Group();
  scene.add(car);

  bodyMaterial = new THREE.MeshPhysicalMaterial({ color: options.paint[0].hex, metalness: .68, roughness: .24, clearcoat: 1, clearcoatRoughness: .12 });
  const darkBody = makeMaterial('#171e20', .42, .65);
  const glass = new THREE.MeshPhysicalMaterial({ color: '#101f25', metalness: .35, roughness: .12, transmission: .05, transparent: true, opacity: .88, side: THREE.DoubleSide });
  const trim = makeMaterial('#090d0f', .58, .25);
  const seatMat = makeMaterial('#343d39', .85, .05);
  const underbody = addBox(car, new RoundedBoxGeometry(2.02, .58, 4.35, 5, .18), bodyMaterial, [0, .83, 0]);
  underbody.scale.set(1, 1, 1);

  // Bonnet, boot and lower front/rear bumpers create the concept-car silhouette.
  addBox(car, new RoundedBoxGeometry(1.91, .22, 1.15, 4, .12), bodyMaterial, [0, 1.10, -1.52]);
  addBox(car, new RoundedBoxGeometry(1.88, .20, .84, 4, .10), bodyMaterial, [0, 1.08, 1.67]);
  addBox(car, new RoundedBoxGeometry(1.98, .23, .25, 4, .08), darkBody, [0, .67, -2.18]);
  addBox(car, new RoundedBoxGeometry(1.98, .22, .25, 4, .08), darkBody, [0, .67, 2.18]);
  addBox(car, new RoundedBoxGeometry(1.83, .10, 3.7, 4, .045), trim, [0, .48, 0]);

  // Cabin prism, extruded across the vehicle width.
  const cabinShape = new THREE.Shape();
  cabinShape.moveTo(1.10, 1.10);
  cabinShape.lineTo(-1.03, 1.10);
  cabinShape.lineTo(-.55, 1.78);
  cabinShape.lineTo(.47, 1.78);
  cabinShape.closePath();
  const cabinGeo = new THREE.ExtrudeGeometry(cabinShape, { depth: 1.34, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: .035, bevelThickness: .035 });
  cabinGeo.rotateY(Math.PI / 2);
  const cabin = new THREE.Mesh(cabinGeo, bodyMaterial);
  cabin.position.x = -.67;
  cabin.castShadow = true;
  cabin.receiveShadow = true;
  car.add(cabin);

  // Side windows.
  for (const side of [-1, 1]) {
    const x = side * .681;
    addPolygon(car, [
      [x, 1.23, -.91], [x, 1.23, .82], [x, 1.69, .43], [x, 1.69, -.48]
    ], glass);
    // Subtle centre pillar and lower window trim.
    addBox(car, new THREE.BoxGeometry(.025, .48, .045), darkBody, [side * .696, 1.45, -.02]);
    addBox(car, new THREE.BoxGeometry(.035, .035, 1.72), trim, [side * .70, 1.19, -.03]);
  }
  // Front and rear windscreens.
  addPolygon(car, [[-.59,1.22,-.94],[.59,1.22,-.94],[.48,1.68,-.53],[-.48,1.68,-.53]], glass);
  addPolygon(car, [[-.58,1.22,.88],[.58,1.22,.88],[.46,1.68,.48],[-.46,1.68,.48]], glass);

  // Seats and dashboard can be seen through the tinted glass.
  const driverSeat = addBox(car, new RoundedBoxGeometry(.48, .48, .28, 3, .06), seatMat, [-.36, 1.05, -.03]);
  const passengerSeat = addBox(car, new RoundedBoxGeometry(.48, .48, .28, 3, .06), seatMat, [.36, 1.05, -.03]);
  driverSeat.userData.interiorPart = true;
  passengerSeat.userData.interiorPart = true;
  addBox(car, new RoundedBoxGeometry(1.22, .13, .30, 3, .05), darkBody, [0, 1.13, -.72]);

  // Door handles and side skirts.
  for (const side of [-1, 1]) {
    addBox(car, new THREE.BoxGeometry(.025, .045, .19), makeMaterial('#c3ccc4', .25, .75), [side * 1.012, 1.02, .30]);
    addBox(car, new RoundedBoxGeometry(.08, .13, 2.25, 3, .025), darkBody, [side * .98, .53, 0]);
  }

  // Wheels and wheel arches.
  wheelGroups = [];
  for (const side of [-1, 1]) {
    for (const z of [-1.38, 1.38]) {
      const wheel = makeWheel(state.wheels);
      wheel.position.set(side * 1.02, .51, z);
      car.add(wheel);
      wheelGroups.push(wheel);
      const arch = new THREE.Mesh(new THREE.TorusGeometry(.53, .055, 8, 40, Math.PI), darkBody);
      arch.rotation.y = Math.PI / 2;
      arch.position.set(side * 1.0, .51, z);
      car.add(arch);
    }
  }

  // Front grille and vents.
  addBox(car, new RoundedBoxGeometry(.82, .18, .045, 3, .025), trim, [0, .76, -2.31]);
  for (let i = 0; i < 5; i++) addBox(car, new THREE.BoxGeometry(.025, .10, .018), makeMaterial('#49534e', .6, .35), [-.29 + i * .145, .76, -2.337]);

  headlightMaterials = [];
  const headlightMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 2.2, metalness: .2, roughness: .22 });
  for (const side of [-1, 1]) {
    const lamp = addBox(car, new RoundedBoxGeometry(.43, .09, .07, 3, .025), headlightMaterial, [side * .62, 1.04, -2.24], [0, side * -.05, 0]);
    headlightMaterials.push(headlightMaterial);
  }
  const tailMat = new THREE.MeshStandardMaterial({ color: '#8d1f2a', emissive: '#ff1029', emissiveIntensity: .9 });
  for (const side of [-1, 1]) addBox(car, new RoundedBoxGeometry(.48, .07, .05, 3, .02), tailMat, [side * .63, 1.02, 2.19]);

  // Mirrors.
  for (const side of [-1, 1]) {
    addBox(car, new THREE.BoxGeometry(.18, .12, .18), darkBody, [side * 1.02, 1.36, -.72], [0, 0, side * -.15]);
    addBox(car, new RoundedBoxGeometry(.09, .07, .13, 3, .02), bodyMaterial, [side * 1.12, 1.36, -.72]);
  }

  // Aero pieces are grouped so they can be toggled/changed as a package.
  car.userData.aeroGroup = new THREE.Group();
  car.add(car.userData.aeroGroup);
  buildAero();

  // Underglow is a soft emissive strip and a point light below the chassis.
  underglowMesh = addBox(car, new THREE.BoxGeometry(1.7, .018, 2.8), new THREE.MeshBasicMaterial({ color: '#b7e63d', transparent: true, opacity: .55 }), [0, .28, 0]);
  underglowMesh.visible = false;
  underglowLight = new THREE.PointLight('#b7e63d', 0, 4.8);
  underglowLight.position.set(0, .25, 0);
  car.add(underglowLight);
}

function buildAero() {
  const group = car.userData.aeroGroup;
  group.clear();
  const carbon = makeMaterial('#111719', .32, .65);
  if (state.aero === 'Sport' || state.aero === 'Track') {
    addBox(group, new RoundedBoxGeometry(1.9, .08, .31, 3, .035), carbon, [0, .57, -2.23]);
    for (const side of [-1, 1]) addBox(group, new RoundedBoxGeometry(.09, .10, 2.15, 3, .025), carbon, [side * .98, .51, 0]);
  }
  if (state.aero === 'Track') {
    for (const side of [-1, 1]) addBox(group, new THREE.BoxGeometry(.055, .43, .08), carbon, [side * .65, 1.39, 1.92], [0, 0, side * -.08]);
    addBox(group, new RoundedBoxGeometry(1.72, .09, .32, 4, .035), carbon, [0, 1.61, 1.92]);
  }
}

function initScene() {
  const canvas = $('#car-canvas');
  const wrap = $('#canvas-wrap');
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#11191b');
  scene.fog = new THREE.Fog('#11191b', 10, 24);

  camera = new THREE.PerspectiveCamera(34, 1, .1, 100);
  camera.position.set(desiredCamera.x, desiredCamera.y, desiredCamera.z);
  camera.lookAt(0, .78, 0);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene.add(new THREE.HemisphereLight('#dce9e2', '#27312f', 2.05));
  const key = new THREE.DirectionalLight('#fff5df', 3.1);
  key.position.set(4, 8, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -7; key.shadow.camera.right = 7; key.shadow.camera.top = 7; key.shadow.camera.bottom = -7;
  scene.add(key);
  const rimLight = new THREE.DirectionalLight('#b7d6cc', 2.1);
  rimLight.position.set(-5, 4, -5);
  scene.add(rimLight);
  const greenLight = new THREE.PointLight('#b7e63d', .65, 9);
  greenLight.position.set(2, 2.5, -2);
  scene.add(greenLight);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: '#101719', roughness: .76, metalness: .18 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = .035;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(60, 60, '#31403a', '#23302b');
  grid.position.y = .042;
  grid.material.transparent = true;
  grid.material.opacity = .26;
  scene.add(grid);

  createCar();
  resizeRenderer();
  window.addEventListener('resize', resizeRenderer);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    const zoom = THREE.MathUtils.clamp(camera.position.length() + event.deltaY * .004, 5.5, 11);
    const direction = camera.position.clone().normalize();
    camera.position.copy(direction.multiplyScalar(zoom));
  }, { passive: false });

  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();
    if (!dragging && !driving) car.rotation.y += .0008;
    car.position.y = Math.sin(elapsed * 1.2) * .012;
    if (driving) {
      const driveTime = (performance.now() - driveStart) / 1000;
      car.rotation.y += .018;
      wheelGroups.forEach(wheel => { wheel.rotation.x += .12; });
      if (driveTime > 5.5) stopDriveMode();
    }
    if (underglowLight) underglowLight.intensity += ((state.underglow ? 2.2 : 0) - underglowLight.intensity) * .08;
    renderer.render(scene, camera);
  }
  animate();
  setTimeout(() => $('#canvas-loader').classList.add('hidden'), 450);
}

function resizeRenderer() {
  if (!renderer || !camera) return;
  const wrap = $('#canvas-wrap');
  const width = Math.max(1, wrap.clientWidth);
  const height = Math.max(1, wrap.clientHeight);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function onPointerDown(event) {
  dragging = true;
  previousPointerX = event.clientX;
  $('#car-canvas').setPointerCapture?.(event.pointerId);
}
function onPointerMove(event) {
  if (!dragging || !car) return;
  const delta = event.clientX - previousPointerX;
  car.rotation.y += delta * .008;
  previousPointerX = event.clientX;
}
function onPointerUp() { dragging = false; }

function updateCar() {
  if (!car) return;
  const paint = options.paint.find(item => item.name === state.paint);
  if (paint) {
    bodyMaterial.color.set(paint.hex);
    bodyMaterial.needsUpdate = true;
  }
  // Rebuild the wheel objects to match the selected wheel style.
  wheelGroups.forEach(wheel => car.remove(wheel));
  wheelGroups = [];
  for (const side of [-1, 1]) {
    for (const z of [-1.38, 1.38]) {
      const wheel = makeWheel(state.wheels);
      wheel.position.set(side * 1.02, .51, z);
      car.add(wheel);
      wheelGroups.push(wheel);
    }
  }
  buildAero();
  const lightColor = state.lights.includes('Blue') ? '#9dd8ff' : state.lights.includes('Amber') ? '#ffb34d' : '#ffffff';
  headlightMaterials.forEach(material => { material.color.set(lightColor); material.emissive.set(lightColor); });
  headlightMaterials.forEach(material => { material.emissiveIntensity = state.headlights ? 2.2 : 0; });
  if (underglowMesh) underglowMesh.visible = state.underglow;
  if (underglowLight) underglowLight.intensity = state.underglow ? 2.2 : 0;
  const interiorColors = { Graphite: '#343d39', Oxblood: '#6c202c', Sandstone: '#b4a080' };
  car.traverse(object => {
    if (object.isMesh && object.material && object.material.color && object.material.userData.isInterior) object.material.color.set(interiorColors[state.interior]);
  });
  // Cabin seats use a shared material created inside the model; update meshes by their marker.
  car.traverse(object => {
    if (object.isMesh && object.userData.interiorPart) object.material.color.set(interiorColors[state.interior]);
  });
}

function setCamera(view) {
  const positions = {
    front: new THREE.Vector3(6.3, 3.45, 6.9),
    side: new THREE.Vector3(8.9, 2.6, .35),
    rear: new THREE.Vector3(-6.2, 3.3, -6.3)
  };
  const target = positions[view];
  desiredCamera = { x: target.x, y: target.y, z: target.z };
  if (window.gsap && !reducedMotion) {
    if (cameraTween) cameraTween.kill();
    cameraTween = gsap.to(camera.position, { x: target.x, y: target.y, z: target.z, duration: 1.1, ease: 'power3.inOut', onUpdate: () => camera.lookAt(0, .78, 0) });
  } else {
    camera.position.copy(target);
    camera.lookAt(0, .78, 0);
  }
  $$('.view-button').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  $('#view-label').textContent = view === 'front' ? 'FRONT THREE-QUARTER' : view === 'side' ? 'SIDE PROFILE' : 'REAR THREE-QUARTER';
}

function stopDriveMode() {
  driving = false;
  $('#drive-button').classList.remove('active');
  $('#drive-button').innerHTML = '<span>▶</span> <b>DRIVE MODE</b>';
  if (!reducedMotion && window.gsap) gsap.to(car.rotation, { y: car.rotation.y + .25, duration: .4, ease: 'power2.out' });
}

function saveBuild() {
  try {
    localStorage.setItem('autoforge-build', JSON.stringify(state));
    showToast('BUILD SAVED TO THIS BROWSER');
  } catch (error) {
    showToast('COULD NOT SAVE — CHECK BROWSER STORAGE');
  }
}

function loadBuild() {
  try {
    const saved = JSON.parse(localStorage.getItem('autoforge-build') || 'null');
    if (saved && typeof saved === 'object') state = { ...defaults, ...saved };
  } catch (error) {
    console.warn('Saved AutoForge build could not be loaded.', error);
  }
}

function buildDetails() {
  return [
    'AUTOFORGE — AF R-SPEC',
    `Paint: ${state.paint}`,
    `Wheels: ${state.wheels}`,
    `Aero: ${state.aero}`,
    `Lighting: ${state.lights}${state.headlights ? ' (on)' : ' (off)'}`,
    `Interior: ${state.interior}`,
    `Neon underglow: ${state.underglow ? 'Yes' : 'No'}`,
    `Illustrative build value: ₹${money(basePrice + getExtraPrice())}`
  ].join('\n');
}

async function copyBuild() {
  try {
    await navigator.clipboard.writeText(buildDetails());
    showToast('BUILD DETAILS COPIED');
  } catch (error) {
    const area = document.createElement('textarea');
    area.value = buildDetails();
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
    showToast('BUILD DETAILS COPIED');
  }
}

function resetBuild() {
  state = { ...defaults };
  updateCar();
  updateSummary();
  renderControls(currentTab);
  localStorage.removeItem('autoforge-build');
  showToast('CONFIGURATION RESET');
}

function setupEvents() {
  $$('.category-tab').forEach(button => button.addEventListener('click', () => renderControls(button.dataset.tab)));
  $$('.view-button').forEach(button => button.addEventListener('click', () => setCamera(button.dataset.view)));
  $('#save-build').addEventListener('click', saveBuild);
  $('#save-build-top').addEventListener('click', saveBuild);
  $('#share-build').addEventListener('click', copyBuild);
  $('#reset-build').addEventListener('click', resetBuild);
  $('#drive-button').addEventListener('click', () => {
    if (driving) { stopDriveMode(); return; }
    driving = true;
    driveStart = performance.now();
    $('#drive-button').classList.add('active');
    $('#drive-button').innerHTML = '<span>■</span> <b>STOP DRIVE</b>';
    showToast('DRIVE MODE — WATCH IT ROLL');
  });
  $('#fullscreen-button').addEventListener('click', async () => {
    const target = $('#canvas-wrap');
    try {
      if (!document.fullscreenElement) await target.requestFullscreen();
      else await document.exitFullscreen();
    } catch (error) { showToast('FULLSCREEN IS NOT AVAILABLE'); }
  });
  $('#menu-button').addEventListener('click', () => {
    const nav = $('.main-nav');
    const open = nav.classList.toggle('open');
    $('#menu-button').setAttribute('aria-expanded', String(open));
  });
  $$('.main-nav a').forEach(link => link.addEventListener('click', () => {
    $('.main-nav').classList.remove('open');
    $('#menu-button').setAttribute('aria-expanded', 'false');
  }));
}

function runIntroAnimations() {
  if (!window.gsap || reducedMotion) return;
  gsap.from('.topbar', { y: -18, opacity: 0, duration: .65, ease: 'power3.out' });
  gsap.from('.intro-copy > *', { y: 25, opacity: 0, duration: .75, stagger: .12, delay: .15, ease: 'power3.out' });
  gsap.from('.intro-meta > div', { y: 15, opacity: 0, duration: .55, stagger: .1, delay: .5, ease: 'power2.out' });
  gsap.from('.studio-layout > *', { y: 25, opacity: 0, duration: .7, stagger: .12, delay: .45, ease: 'power3.out' });
}

loadBuild();
setupEvents();
renderControls('paint');
updateSummary();
try {
  initScene();
  updateCar();
} catch (error) {
  console.error('AutoForge 3D scene failed to initialize:', error);
  $('#canvas-loader').innerHTML = '<small>3D PREVIEW COULD NOT LOAD. CHECK YOUR INTERNET CONNECTION OR WEBGL SUPPORT.</small>';
}
runIntroAnimations();
