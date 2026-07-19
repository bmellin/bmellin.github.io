// Rotating BCC (body-centered cubic) crystal lattice for the hero section.
// Built with Three.js r128. Purely decorative — fails silently if
// Three.js hasn't loaded or the container isn't present.

(function () {
  const container = document.getElementById('lattice-canvas');
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
  camera.position.set(0, 0, 10.5);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  // ---------- lighting ----------
  scene.add(new THREE.AmbientLight(0x93a0a6, 0.7));

  const keyLight = new THREE.PointLight(0x3e6e91, 1.8, 30);
  keyLight.position.set(6, 5, 8);
  scene.add(keyLight);

  const rimLight = new THREE.PointLight(0xd9853a, 1.0, 30);
  rimLight.position.set(-6, -4, -6);
  scene.add(rimLight);

  // ---------- BCC lattice geometry ----------
  const lattice = new THREE.Group();
  scene.add(lattice);

  const a = 1.4; // lattice parameter (unit cell edge length)
  const nCells = 2; // 2x2x2 block of unit cells
  const offset = (nCells / 2) * a; // centers the whole block at the origin

  // Corner sites: shared between adjacent cells, so this is a
  // (nCells+1)^3 grid of points spaced 'a' apart.
  const cornerPositions = [];
  for (let x = 0; x <= nCells; x++) {
    for (let y = 0; y <= nCells; y++) {
      for (let z = 0; z <= nCells; z++) {
        cornerPositions.push(
          new THREE.Vector3(x * a - offset, y * a - offset, z * a - offset)
        );
      }
    }
  }

  // Body-center sites: one per unit cell, at the cell's center.
  const bodyPositions = [];
  for (let x = 0; x < nCells; x++) {
    for (let y = 0; y < nCells; y++) {
      for (let z = 0; z < nCells; z++) {
        bodyPositions.push(
          new THREE.Vector3(
            (x + 0.5) * a - offset,
            (y + 0.5) * a - offset,
            (z + 0.5) * a - offset
          )
        );
      }
    }
  }

  // All atoms are the same species (BCC metals like iron or tungsten are
  // monoatomic), so corner and body-center sites share one material.
  const atomMaterial = new THREE.MeshStandardMaterial({
    color: 0x3e6e91,
    metalness: 0.7,
    roughness: 0.25,
  });
  const cornerGeo = new THREE.SphereGeometry(0.14, 18, 18);
  const bodyGeo = new THREE.SphereGeometry(0.17, 18, 18);

  cornerPositions.forEach((pos) => {
    const sphere = new THREE.Mesh(cornerGeo, atomMaterial);
    sphere.position.copy(pos);
    lattice.add(sphere);
  });

  bodyPositions.forEach((pos) => {
    const sphere = new THREE.Mesh(bodyGeo, atomMaterial);
    sphere.position.copy(pos);
    lattice.add(sphere);
  });

  // Nearest-neighbor bonds: each body-center atom bonds to the 8 corner
  // atoms of its own cell, at distance (sqrt(3)/2)*a — the real BCC
  // nearest-neighbor distance.
  const bondMaterial = new THREE.MeshStandardMaterial({
    color: 0xd9853a,
    metalness: 0.3,
    roughness: 0.5,
    transparent: true,
    opacity: 0.75,
  });
  const nnDist = (Math.sqrt(3) / 2) * a;

  function addBond(pa, pb, radius, material) {
    const dir = new THREE.Vector3().subVectors(pb, pa);
    const len = dir.length();
    const bondGeo = new THREE.CylinderGeometry(radius, radius, len, 6);
    const bond = new THREE.Mesh(bondGeo, material);
    bond.position.copy(new THREE.Vector3().addVectors(pa, pb).multiplyScalar(0.5));
    bond.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().normalize()
    );
    lattice.add(bond);
  }

  bodyPositions.forEach((body) => {
    cornerPositions.forEach((corner) => {
      const d = body.distanceTo(corner);
      if (Math.abs(d - nnDist) < 0.01) {
        addBond(body, corner, 0.03, bondMaterial);
      }
    });
  });

  // Faint unit-cell edges (corner-to-corner along one axis, distance 'a')
  // — a visual reference frame, not real atomic bonds, so these are drawn
  // as thin lines rather than metallic cylinders.
  const edgeGeo = new THREE.BufferGeometry();
  const edgeVertices = [];
  for (let i = 0; i < cornerPositions.length; i++) {
    for (let j = i + 1; j < cornerPositions.length; j++) {
      const d = cornerPositions[i].distanceTo(cornerPositions[j]);
      if (Math.abs(d - a) < 0.01) {
        edgeVertices.push(
          cornerPositions[i].x, cornerPositions[i].y, cornerPositions[i].z,
          cornerPositions[j].x, cornerPositions[j].y, cornerPositions[j].z
        );
      }
    }
  }
  edgeGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(edgeVertices, 3)
  );
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: 0x4a5860,
    transparent: true,
    opacity: 0.35,
  });
  lattice.add(new THREE.LineSegments(edgeGeo, edgeMaterial));

  // ---------- interaction + animation ----------
  let mouseX = 0;
  let mouseY = 0;

  function onPointerMove(e) {
    const rect = container.getBoundingClientRect();
    mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
  }
  window.addEventListener('pointermove', onPointerMove);

  let autoRotate = 0;
  let currentRotY = 0;
  let currentRotX = 0;
  let isVisible = true;

  function animate() {
    requestAnimationFrame(animate);
    if (!isVisible) return;

    if (!prefersReducedMotion) {
      autoRotate += 0.0022;
    }

    currentRotY += (autoRotate + mouseX * 0.4 - currentRotY) * 0.04;
    currentRotX += (mouseY * 0.25 - currentRotX) * 0.04;

    lattice.rotation.y = currentRotY;
    lattice.rotation.x = currentRotX;

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
