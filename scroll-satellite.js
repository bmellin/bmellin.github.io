// Scroll-linked satellite scene.
// Built with Three.js r128. A small satellite starts near the hero, migrates
// to the scrollbar-side edge of the screen, tracks scroll position down the
// page, then curves in toward an Earth that rises into view near the bottom
// of the page, burning up as it closes the final approach.
//
// The canvas is a fixed, full-viewport, pointer-events:none overlay — it
// doesn't scroll with the page. The "moves down the page while scrolling"
// effect comes from continuously re-targeting the satellite's on-screen
// position based on scroll progress, not from the canvas itself moving.

(function () {
  const container = document.getElementById('scene-overlay');
  if (!container || typeof THREE === 'undefined') return;
  if (window.matchMedia('(max-width: 640px)').matches) return;

  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  // ---------- math helpers ----------
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function clamp(v, min, max) {
    return Math.min(Math.max(v, min), max);
  }
  function smoothstep(edge0, edge1, x) {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  // ---------- scene setup ----------
  let width = window.innerWidth;
  let height = window.innerHeight;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
  camera.position.set(0, 0, 10);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0x93a0a6, 0.5));
  const keyLight = new THREE.PointLight(0x3e6e91, 1.4, 40);
  keyLight.position.set(6, 5, 8);
  scene.add(keyLight);
  const rimLight = new THREE.PointLight(0xf5ead0, 0.9, 40);
  rimLight.position.set(-5, -3, 6);
  scene.add(rimLight);

  // Converts a fractional screen position (0-1, 0-1) into a Three.js world
  // position on the z=0 plane, given the current camera.
  function fracToWorld(fracX, fracY, z) {
    z = z || 0;
    const distance = camera.position.z - z;
    const vFov = (camera.fov * Math.PI) / 180;
    const visibleHeight = 2 * Math.tan(vFov / 2) * distance;
    const visibleWidth = visibleHeight * camera.aspect;
    return new THREE.Vector3(
      (fracX - 0.5) * visibleWidth,
      (0.5 - fracY) * visibleHeight,
      z
    );
  }

  // ---------- satellite ----------
  const satellite = new THREE.Group();

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xedeee9,
    metalness: 0.6,
    roughness: 0.35,
  });
  const panelMaterial = new THREE.MeshStandardMaterial({
    color: 0x3e6e91,
    metalness: 0.4,
    roughness: 0.4,
    emissive: 0x1c3a4d,
    emissiveIntensity: 0.4,
  });
  const antennaMaterial = new THREE.MeshStandardMaterial({
    color: 0x93a0a6,
    metalness: 0.7,
    roughness: 0.3,
  });

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.22, 0.3),
    bodyMaterial
  );
  satellite.add(body);

  const panelGeo = new THREE.BoxGeometry(0.5, 0.18, 0.015);
  const panelLeft = new THREE.Mesh(panelGeo, panelMaterial);
  panelLeft.position.set(-0.46, 0, 0);
  satellite.add(panelLeft);
  const panelRight = new THREE.Mesh(panelGeo, panelMaterial);
  panelRight.position.set(0.46, 0, 0);
  satellite.add(panelRight);

  const antenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.008, 0.3, 6),
    antennaMaterial
  );
  antenna.rotation.z = Math.PI / 5;
  antenna.position.set(0.08, 0.22, 0);
  satellite.add(antenna);

  // Burn/flame effect, hidden until the final approach to Earth
  const flameMaterial = new THREE.MeshBasicMaterial({
    color: 0xd9853a,
    transparent: true,
    opacity: 0,
  });
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.5, 10),
    flameMaterial
  );
  flame.rotation.z = -Math.PI / 2;
  flame.position.set(-0.35, -0.1, 0);
  satellite.add(flame);

  scene.add(satellite);

  // ---------- earth ----------
  const earthGroup = new THREE.Group();
  const earthRadius = 1.6;

  const earthGeo = new THREE.IcosahedronGeometry(earthRadius, 3);
  function hash(n) {
    return (Math.sin(n * 12.9898) * 43758.5453) % 1;
  }
  const posAttr = earthGeo.attributes.position;
  const colors = [];
  const oceanColor = new THREE.Color(0x2c5f7c);
  const landColor = new THREE.Color(0x4f7a52);
  const v = new THREE.Vector3();
  for (let i = 0; i < posAttr.count; i++) {
    v.fromBufferAttribute(posAttr, i);
    const n = Math.abs(hash(i * 4.7 + v.x * 2 + v.y * 3 + v.z));
    const c = n > 0.62 ? landColor : oceanColor;
    colors.push(c.r, c.g, c.b);
  }
  earthGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  const earthMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0.05,
    flatShading: true,
  });
  const earth = new THREE.Mesh(earthGeo, earthMaterial);
  earthGroup.add(earth);

  // Soft atmosphere halo
  const atmosphereGeo = new THREE.SphereGeometry(earthRadius * 1.08, 32, 32);
  const atmosphereMaterial = new THREE.MeshBasicMaterial({
    color: 0x3e6e91,
    transparent: true,
    opacity: 0.18,
    side: THREE.BackSide,
  });
  earthGroup.add(new THREE.Mesh(atmosphereGeo, atmosphereMaterial));

  earthGroup.scale.setScalar(0.22); // always visible in the corner, even at scroll top
  scene.add(earthGroup);

  // ---------- scroll-driven targets ----------
  function getScrollProgress() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight =
      document.documentElement.scrollHeight - window.innerHeight;
    if (docHeight <= 0) return 0;
    return clamp(scrollTop / docHeight, 0, 1);
  }

  function satelliteTargetFrac(p) {
    const heroPos = { x: 0.56, y: 0.32 };
    const edgePos = { x: 0.965, y: 0.12 };
    const earthApproach = { x: 0.88, y: 0.86 };

    if (p < 0.08) {
      const t = smoothstep(0, 0.08, p);
      return {
        x: lerp(heroPos.x, edgePos.x, t),
        y: lerp(heroPos.y, edgePos.y, t),
      };
    }
    if (p < 0.85) {
      const t = smoothstep(0.08, 0.85, p);
      return { x: edgePos.x, y: lerp(edgePos.y, 0.82, t) };
    }
    const t = smoothstep(0.85, 1.0, p);
    return {
      x: lerp(edgePos.x, earthApproach.x, t),
      y: lerp(0.82, earthApproach.y, t),
    };
  }

  // Earth stays parked in the corner throughout — only its scale grows
  // with scroll progress, so it's always visible, not just near the end.
  const EARTH_CORNER = { x: 0.88, y: 0.87 };
  function earthTargetFrac() {
    return EARTH_CORNER;
  }

  // ---------- animation loop ----------
  const SAT_BASE_SCALE = 1.9;
  let scrollProgress = getScrollProgress();
  let satPos = fracToWorld(0.56, 0.32, 0);
  let clock = 0;
  let isVisible = true;

  function onScroll() {
    scrollProgress = getScrollProgress();
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  document.addEventListener('visibilitychange', () => {
    isVisible = !document.hidden;
  });

  function animate() {
    requestAnimationFrame(animate);
    if (!isVisible) return;

    clock += 0.02;

    const p = scrollProgress;
    const satFrac = satelliteTargetFrac(p);
    const earthFrac = earthTargetFrac();
    const burn = smoothstep(0.1, 1.0, p);

    const targetPos = fracToWorld(satFrac.x, satFrac.y, 0);
    satPos.lerp(targetPos, 0.08);
    satellite.position.copy(satPos);

    const earthTargetPos = fracToWorld(earthFrac.x, earthFrac.y, -2);
    earthGroup.position.lerp(earthTargetPos, 0.06);
    earthGroup.scale.setScalar(lerp(0.22, 1.4, smoothstep(0, 1.0, p)));

    if (!prefersReducedMotion) {
      satellite.rotation.y += 0.006;
      satellite.rotation.x = Math.sin(clock * 0.3) * 0.08;
      earthGroup.rotation.y += 0.0009;
    }

    // Burn-up: shrink, redden, and ignite the flame — starts early and
    // strengthens steadily as scroll progress increases.
    const scale = SAT_BASE_SCALE * lerp(1, 0.35, burn);
    satellite.scale.setScalar(scale);
    bodyMaterial.emissive = new THREE.Color(0xd9853a);
    bodyMaterial.emissiveIntensity = burn * 1.6;
    flameMaterial.opacity = burn * 0.9;
    flame.scale.set(0.4 + burn * 2.2, 0.4 + burn * 2.8, 1);

    renderer.render(scene, camera);
  }
  animate();

  // ---------- resize ----------
  function onResize() {
    width = window.innerWidth;
    height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
  window.addEventListener('resize', onResize);
})();
