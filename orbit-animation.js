// Rocket orbiting a moon — hero section visual.
// Built with Three.js r128. Purely decorative — fails silently if
// Three.js hasn't loaded or the container isn't present.

(function () {
  const container = document.getElementById('hero-canvas');
  if (!container || typeof THREE === 'undefined') return;

  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  let width = container.clientWidth;
  let height = container.clientHeight;
  if (width === 0 || height === 0) return;

  // ---------- scene setup ----------
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 0.6, 6.2);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  const root = new THREE.Group();
  scene.add(root);

  // ---------- lighting ----------
  scene.add(new THREE.AmbientLight(0x93a0a6, 0.35));

  // "Sun" — warm-white, off to one side, creates a terminator line on the moon
  const sunLight = new THREE.DirectionalLight(0xf5ead0, 1.3);
  sunLight.position.set(6, 3, 6);
  scene.add(sunLight);

  // Cool fill light on the opposite side
  const fillLight = new THREE.PointLight(0x3e6e91, 0.7, 30);
  fillLight.position.set(-6, -3, -4);
  scene.add(fillLight);

  // ---------- moon ----------
  const moonRadius = 1.15;
  const moonGeo = new THREE.IcosahedronGeometry(moonRadius, 3);

  // Deterministic pseudo-random displacement per vertex for a rocky,
  // faceted look rather than a perfect sphere.
  function hash(n) {
    return (Math.sin(n * 12.9898) * 43758.5453) % 1;
  }
  const posAttr = moonGeo.attributes.position;
  const vertex = new THREE.Vector3();
  for (let i = 0; i < posAttr.count; i++) {
    vertex.fromBufferAttribute(posAttr, i);
    const n = Math.abs(hash(i * 3.1 + vertex.x + vertex.y * 2 + vertex.z * 3));
    const displacement = 1 + (n - 0.5) * 0.07;
    vertex.multiplyScalar(displacement);
    posAttr.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }
  moonGeo.computeVertexNormals();

  const moonMaterial = new THREE.MeshStandardMaterial({
    color: 0x8b9598,
    roughness: 0.95,
    metalness: 0.05,
    flatShading: true,
  });
  const moon = new THREE.Mesh(moonGeo, moonMaterial);
  root.add(moon);

  // ---------- orbit path (visual reference only, not a real object) ----------
  const orbitRadius = moonRadius * 2.5;
  const orbitGroup = new THREE.Group();
  orbitGroup.rotation.x = -0.4;
  orbitGroup.rotation.z = 0.15;
  root.add(orbitGroup);

  const ringSegments = 96;
  const ringPositions = [];
  for (let i = 0; i <= ringSegments; i++) {
    const t = (i / ringSegments) * Math.PI * 2;
    ringPositions.push(
      Math.cos(t) * orbitRadius, 0, Math.sin(t) * orbitRadius
    );
  }
  const ringGeo = new THREE.BufferGeometry();
  ringGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(ringPositions, 3)
  );
  const ringMaterial = new THREE.LineBasicMaterial({
    color: 0x4a5860,
    transparent: true,
    opacity: 0.35,
  });
  orbitGroup.add(new THREE.LineLoop(ringGeo, ringMaterial));

  // ---------- rocket ----------
  const rocket = new THREE.Group();

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xedeee9,
    metalness: 0.6,
    roughness: 0.35,
  });
  const stripeMaterial = new THREE.MeshStandardMaterial({
    color: 0x3e6e91,
    metalness: 0.6,
    roughness: 0.3,
  });
  const finMaterial = new THREE.MeshStandardMaterial({
    color: 0x5c6a70,
    metalness: 0.5,
    roughness: 0.45,
  });
  const engineMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a1a10,
    emissive: 0xd9853a,
    emissiveIntensity: 1.1,
    metalness: 0.2,
    roughness: 0.6,
  });
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: 0x3e6e91,
    emissive: 0x3e6e91,
    emissiveIntensity: 0.6,
    metalness: 0.4,
    roughness: 0.3,
  });

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 0.5, 14),
    bodyMaterial
  );
  body.position.y = 0.25;
  rocket.add(body);

  const noseCone = new THREE.Mesh(
    new THREE.ConeGeometry(0.09, 0.22, 14),
    stripeMaterial
  );
  noseCone.position.y = 0.61;
  rocket.add(noseCone);

  const windowDetail = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 10, 10),
    windowMaterial
  );
  windowDetail.position.set(0, 0.32, 0.085);
  rocket.add(windowDetail);

  const finGeo = new THREE.ConeGeometry(0.07, 0.16, 4);
  for (let i = 0; i < 3; i++) {
    const fin = new THREE.Mesh(finGeo, finMaterial);
    const angle = (i / 3) * Math.PI * 2;
    fin.position.set(Math.cos(angle) * 0.12, 0.05, Math.sin(angle) * 0.12);
    fin.rotation.x = Math.PI / 2.6;
    fin.rotation.y = -angle;
    rocket.add(fin);
  }

  const engine = new THREE.Mesh(
    new THREE.ConeGeometry(0.06, 0.12, 10),
    engineMaterial
  );
  engine.rotation.x = Math.PI;
  engine.position.y = -0.08;
  rocket.add(engine);

  orbitGroup.add(rocket);

  // ---------- interaction + animation ----------
  let mouseX = 0;
  let mouseY = 0;

  function onPointerMove(e) {
    const rect = container.getBoundingClientRect();
    mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
  }
  window.addEventListener('pointermove', onPointerMove);

  let theta = 0;
  let currentRotY = 0;
  let currentRotX = 0;
  let isVisible = true;
  let clock = 0;

  function animate() {
    requestAnimationFrame(animate);
    if (!isVisible) return;

    if (!prefersReducedMotion) {
      theta += 0.008;
      moon.rotation.y += 0.0015;
      clock += 0.08;
    }

    // Position the rocket on the (untilted, local) orbit circle —
    // the orbitGroup's own rotation supplies the 3D tilt.
    const x = Math.cos(theta) * orbitRadius;
    const z = Math.sin(theta) * orbitRadius;
    rocket.position.set(x, 0, z);

    // Face the direction of travel (tangent to the circle)
    const tangent = new THREE.Vector3(-Math.sin(theta), 0, Math.cos(theta));
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      tangent
    );
    rocket.quaternion.copy(quat);

    // Subtle thruster pulse
    engineMaterial.emissiveIntensity = 0.9 + Math.sin(clock) * 0.3;

    // Gentle mouse parallax on the whole scene
    currentRotY += (mouseX * 0.35 - currentRotY) * 0.04;
    currentRotX += (mouseY * 0.2 - currentRotX) * 0.04;
    root.rotation.y = currentRotY;
    root.rotation.x = currentRotX;

    renderer.render(scene, camera);
  }
  animate();

  // Pause rendering when the hero scrolls out of view
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isVisible = entry.isIntersecting;
        });
      },
      { threshold: 0.05 }
    );
    io.observe(container);
  }

  // Handle resize (including the visual being hidden below 900px)
  function onResize() {
    width = container.clientWidth;
    height = container.clientHeight;
    if (width === 0 || height === 0) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
  window.addEventListener('resize', onResize);
})();
