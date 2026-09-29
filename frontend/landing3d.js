/**
 * Claudrix Agri TN - Realistic Tamil Nadu Agricultural Maize Field & AI Farm Twin
 * Built with Three.js (WebGL)
 *
 * Visual Architecture:
 * - Authentic Tamil Nadu Maize (Corn) crop rows with slender stalks, arching drooping leaves,
 *   nestled corn cobs, and top flowering tassels.
 * - Rich dark loamy / red-brown agricultural soil with raised furrow ridges and depressed trenches.
 * - Reflective irrigation canal running between rows with shimmering water.
 * - Distant Palmyra / Coconut palm silhouettes and low Western/Eastern Ghats hills at the horizon.
 * - Warm golden Tamil Nadu sunlight, soft atmospheric haze, and ambient skylight.
 * - Central floating holographic AI Core with data streams.
 * - Interactive 7-stage "Simulate Farm" rain, soil wetting, wind, data particle intake, and prediction cycle.
 */

class AgriField3DScene {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clock = new THREE.Clock();
    this.animationId = null;

    // Environment & Objects
    this.terrainMesh = null;
    this.terrainMat = null;
    this.waterMesh = null;
    this.aiCoreGroup = null;
    this.innerCore = null;
    this.outerIcosahedron = null;
    this.orbitalRing1 = null;
    this.orbitalRing2 = null;
    this.crops = [];
    this.particles = null;
    this.dataStreamLines = [];

    // Weather & Simulation System
    this.rainParticles = null;
    this.cloudGroup = null;
    this.isSimulating = false;
    this.simProgress = 0;
    this.windStrength = 1.0;
    this.soilWetness = 0.0;
    this.corePulseIntensity = 1.0;

    // Lighting refs for dynamic animation
    this.sunLight = null;
    this.coreLight = null;
    this.ambientLight = null;

    // Interaction & Camera
    this.mouseX = 0;
    this.mouseY = 0;
    this.targetCameraX = 0;
    this.targetCameraY = 1.45;
    this.targetCameraZ = 8.5;
    this.isTransitioning = false;
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.init();
  }

  init() {
    // 1. Scene & Atmospheric Fog
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0a161d, 0.026);

    // 2. Camera Setup (Comfortable low agricultural perspective looking down the row corridor)
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 150);
    this.camera.position.set(0, 1.45, 8.5);

    // 3. WebGL Renderer
    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance"
      });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.2;
      this.container.appendChild(this.renderer.domElement);
    } catch (e) {
      console.warn("WebGL not available, fallback background active.", e);
      this.container.classList.add("webgl-fallback");
      return;
    }

    // 4. Lights (Warm Tamil Nadu Sunlight & Atmospheric Radiance)
    this.setupLights();

    // 5. Build Authentic Agricultural Environment
    this.createAgriculturalTerrain();
    this.createIrrigationChannel();
    this.createMaizeCropField();
    this.createDistantTamilNaduHorizon();
    this.createAICore();
    this.createBioDataParticles();
    this.createDataStreamLines();

    // 6. Event Listeners
    this.onWindowResize = this.onWindowResize.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    window.addEventListener("resize", this.onWindowResize);
    window.addEventListener("mousemove", this.onMouseMove);

    // 7. Animation Loop
    this.animate = this.animate.bind(this);
    this.animate();
  }

  setupLights() {
    // Soft atmospheric sky ambient
    this.ambientLight = new THREE.AmbientLight(0x192e27, 1.6);
    this.scene.add(this.ambientLight);

    // Golden warm morning sun casting long furrow shadows
    this.sunLight = new THREE.DirectionalLight(0xffbe68, 2.2);
    this.sunLight.position.set(18, 14, -25);
    this.scene.add(this.sunLight);

    // Subtle cool cyan sky fill
    const skyFill = new THREE.DirectionalLight(0x38bdf8, 0.7);
    skyFill.position.set(-18, 12, 10);
    this.scene.add(skyFill);

    // Emerald AI radiance centered at the AI Core
    this.coreLight = new THREE.PointLight(0x10b981, 2.6, 25);
    this.coreLight.position.set(0, 2.2, -5);
    this.scene.add(this.coreLight);
  }

  createAgriculturalTerrain() {
    // Rich furrowed agricultural soil bed (75m wide x 90m deep)
    const width = 75;
    const depth = 90;
    const segmentsX = 64;
    const segmentsZ = 72;

    const terrainGeo = new THREE.PlaneGeometry(width, depth, segmentsX, segmentsZ);
    const pos = terrainGeo.attributes.position;

    // Row furrow ridges: Crop rows spaced every ~2.4 units
    // Depressed trench along irrigation corridor at X between 0.6 and 1.8
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getY(i); // In plane geometry prior to rotation

      // Furrow undulation: raised planting ridges and lower drainage furrows
      const furrow = Math.sin(x * 1.3) * 0.14;

      // Irrigation channel trench between X = 0.6 and X = 1.8
      let channelDrop = 0;
      if (x > 0.6 && x < 1.8) {
        const canalT = (x - 1.2) / 0.6;
        channelDrop = -0.22 * Math.cos(canalT * (Math.PI / 2));
      }

      // Gentle natural field roll & boundary berms
      const fieldRoll = Math.sin(z * 0.05) * 0.25;
      const boundaryBerm = Math.abs(x) > 22 ? (Math.abs(x) - 22) * 0.08 : 0;

      pos.setZ(i, furrow + channelDrop + fieldRoll + boundaryBerm);
    }
    terrainGeo.computeVertexNormals();

    // Dark brown/earth-colored rich agricultural soil (Tamil Nadu loam)
    this.terrainMat = new THREE.MeshStandardMaterial({
      color: 0x271912, // Rich dark earth
      roughness: 0.94,
      metalness: 0.04,
      flatShading: true
    });

    this.terrainMesh = new THREE.Mesh(terrainGeo, this.terrainMat);
    this.terrainMesh.rotation.x = -Math.PI / 2;
    this.terrainMesh.position.set(0, -0.65, -12);
    this.scene.add(this.terrainMesh);
  }

  createIrrigationChannel() {
    // Visible agricultural water channel running between center-right crop rows
    const waterGeo = new THREE.PlaneGeometry(1.2, 75);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x143c4a,
      roughness: 0.12,
      metalness: 0.5,
      transparent: true,
      opacity: 0.86
    });

    this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
    this.waterMesh.rotation.x = -Math.PI / 2;
    this.waterMesh.position.set(1.2, -0.58, -12);
    this.scene.add(this.waterMesh);
  }

  /**
   * Helper: Builds an authentic, procedurally arched maize leaf blade.
   * Features a tapered blade, central midrib keel, and realistic gravity droop.
   */
  createMaizeLeafGeometry(length = 0.85, maxWidth = 0.08, archAmount = 0.35) {
    const segments = 5;
    const positions = [];
    const indices = [];

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const width = Math.sin(t * Math.PI) * maxWidth * (1.1 - t * 0.4);
      // Rises initially then droops downwards naturally
      const y = Math.sin(t * Math.PI * 0.85) * 0.15 - Math.pow(t, 2.2) * archAmount;
      const z = t * length;

      positions.push(-width * 0.5, y, z);
      positions.push(width * 0.5, y, z);
    }

    for (let i = 0; i < segments; i++) {
      const v0 = i * 2;
      const v1 = i * 2 + 1;
      const v2 = (i + 1) * 2;
      const v3 = (i + 1) * 2 + 1;

      indices.push(v0, v1, v2);
      indices.push(v1, v3, v2);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  createMaizeCropField() {
    // Shared Materials for optimal rendering performance
    const stalkMat = new THREE.MeshStandardMaterial({
      color: 0x417024, // Maize stalk green
      roughness: 0.75,
      metalness: 0.05
    });

    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x316e23, // Lush maize canopy green
      roughness: 0.6,
      metalness: 0.08,
      side: THREE.DoubleSide
    });

    const cobMat = new THREE.MeshStandardMaterial({
      color: 0x769b3f, // Pale husk green
      roughness: 0.7,
      metalness: 0.05
    });

    const silkMat = new THREE.MeshStandardMaterial({
      color: 0xd4a539, // Golden corn silk
      roughness: 0.5
    });

    const tasselMat = new THREE.MeshStandardMaterial({
      color: 0xb5a05b, // Pale golden tassel
      roughness: 0.8
    });

    // Shared Leaf Geometries (Long & Medium)
    const leafGeoLong = this.createMaizeLeafGeometry(0.95, 0.09, 0.38);
    const leafGeoMed = this.createMaizeLeafGeometry(0.78, 0.08, 0.3);
    const cobGeo = new THREE.CylinderGeometry(0.038, 0.046, 0.26, 6);
    const tasselGeo = new THREE.CylinderGeometry(0.006, 0.018, 0.28, 4);

    // Organized agricultural crop rows
    // Rows situated along X axes with a central viewing corridor
    const rowPositionsX = [-6.2, -3.8, -1.4, 2.7, 5.1, 7.5];
    const plantsPerRow = 22;

    for (let r = 0; r < rowPositionsX.length; r++) {
      const rowX = rowPositionsX[r];

      for (let p = 0; p < plantsPerRow; p++) {
        const plantZ = -p * 1.5 + 7;

        // Leave clearance around the central floating AI Core
        if (Math.abs(rowX) < 1.8 && Math.abs(plantZ - (-5)) < 2.8) continue;

        // Height variation (1.6m to 2.2m)
        const heightScale = 0.85 + Math.random() * 0.3;
        const plantGroup = new THREE.Group();

        // 1. Maize Stalk
        const stalkHeight = 1.9 * heightScale;
        const stalkGeo = new THREE.CylinderGeometry(0.02, 0.036, stalkHeight, 6);
        const stalk = new THREE.Mesh(stalkGeo, stalkMat);
        stalk.position.y = stalkHeight / 2;
        plantGroup.add(stalk);

        // 2. Alternating arching leaves (7-8 leaves along stalk)
        const numLeaves = 8;
        for (let l = 0; l < numLeaves; l++) {
          const attachY = (0.25 + (l / numLeaves) * 0.58) * stalkHeight;
          const leafGeo = l % 2 === 0 ? leafGeoLong : leafGeoMed;
          const leaf = new THREE.Mesh(leafGeo, leafMat);

          leaf.position.y = attachY;
          // Alternating leaf azimuth (~135-145 deg) with organic variation
          const leafAngle = l * 2.45 + (Math.random() - 0.5) * 0.3;
          leaf.rotation.y = leafAngle;
          leaf.rotation.x = 0.15 + (Math.random() - 0.5) * 0.1;
          plantGroup.add(leaf);
        }

        // 3. Small corn cob tucked in middle leaf axil
        const cob = new THREE.Mesh(cobGeo, cobMat);
        cob.position.set(0.045, stalkHeight * 0.48, 0.02);
        cob.rotation.z = -0.35; // Nestled naturally against stalk
        plantGroup.add(cob);

        const silk = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.08, 4), silkMat);
        silk.position.set(0.07, stalkHeight * 0.58, 0.02);
        silk.rotation.z = -0.35;
        plantGroup.add(silk);

        // 4. Top flowering tassel
        const tassel = new THREE.Mesh(tasselGeo, tasselMat);
        tassel.position.y = stalkHeight + 0.12;
        plantGroup.add(tassel);

        // Position in furrow with minor organic jitter
        const jitterX = (Math.random() - 0.5) * 0.18;
        const jitterZ = (Math.random() - 0.5) * 0.15;
        plantGroup.position.set(rowX + jitterX, -0.58, plantZ + jitterZ);
        plantGroup.rotation.y = Math.random() * Math.PI * 2;

        this.scene.add(plantGroup);

        this.crops.push({
          group: plantGroup,
          baseRotZ: plantGroup.rotation.z,
          offset: rowX * 0.6 + plantZ * 0.35,
          stalkHeight: stalkHeight
        });
      }
    }
  }

  createDistantTamilNaduHorizon() {
    // 1. Distant low hills silhouette (foothills of Eastern/Western Ghats)
    const hillGeo = new THREE.PlaneGeometry(120, 10, 32, 2);
    const hillPos = hillGeo.attributes.position;
    for (let i = 0; i < hillPos.count; i++) {
      const x = hillPos.getX(i);
      const y = hillPos.getY(i);
      if (y > 0) {
        // Gentle undulating horizon peaks
        const peak = Math.sin(x * 0.08) * 2.2 + Math.cos(x * 0.18) * 1.2;
        hillPos.setY(i, y + peak);
      }
    }
    hillGeo.computeVertexNormals();

    const hillMat = new THREE.MeshBasicMaterial({
      color: 0x08181f,
      fog: true
    });
    const hills = new THREE.Mesh(hillGeo, hillMat);
    hills.position.set(0, 3.5, -55);
    this.scene.add(hills);

    // 2. Distant Palmyra / Coconut Palm Trees (Placed ONLY at distant horizon)
    const palmTrunkMat = new THREE.MeshStandardMaterial({
      color: 0x36271c,
      roughness: 0.9
    });
    const palmFrondMat = new THREE.MeshStandardMaterial({
      color: 0x14351a,
      roughness: 0.7,
      side: THREE.DoubleSide
    });

    const palmTrunkGeo = new THREE.CylinderGeometry(0.1, 0.22, 6.5, 5);
    const palmFrondGeo = this.createMaizeLeafGeometry(1.6, 0.28, 0.65);

    // 14 distant palm trees arranged in small natural village bund clusters
    const palmClusters = [
      { x: -28, z: -46 }, { x: -26, z: -48 }, { x: -24, z: -45 },
      { x: -14, z: -50 }, { x: -12, z: -52 },
      { x: 15, z: -48 }, { x: 17, z: -46 },
      { x: 26, z: -44 }, { x: 28, z: -46 }, { x: 31, z: -45 }
    ];

    palmClusters.forEach((coord) => {
      const palm = new THREE.Group();

      // Slender curved trunk leaning naturally
      const trunk = new THREE.Mesh(palmTrunkGeo, palmTrunkMat);
      trunk.position.y = 3.25;
      palm.add(trunk);

      // Crown of radiating curved palm fronds
      for (let f = 0; f < 7; f++) {
        const frond = new THREE.Mesh(palmFrondGeo, palmFrondMat);
        frond.position.y = 6.4;
        frond.rotation.y = (f / 7) * Math.PI * 2;
        frond.rotation.x = 0.35 + (Math.random() - 0.5) * 0.15;
        palm.add(frond);
      }

      palm.position.set(coord.x, -0.6, coord.z);
      // Gentle natural lean
      palm.rotation.z = (Math.random() - 0.5) * 0.2;
      palm.rotation.y = Math.random() * Math.PI * 2;
      this.scene.add(palm);
    });
  }

  createAICore() {
    this.aiCoreGroup = new THREE.Group();
    this.aiCoreGroup.position.set(0, 2.2, -5);

    // 1. Central crystalline octahedron inner core
    const innerGeo = new THREE.OctahedronGeometry(0.72, 1);
    const innerMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      roughness: 0.1,
      metalness: 0.9,
      emissive: 0x059669,
      emissiveIntensity: 0.9
    });
    this.innerCore = new THREE.Mesh(innerGeo, innerMat);
    this.aiCoreGroup.add(this.innerCore);

    // 2. Holographic outer wireframe icosahedron
    const outerGeo = new THREE.IcosahedronGeometry(1.25, 1);
    const outerMat = new THREE.MeshStandardMaterial({
      color: 0x34d399,
      wireframe: true,
      transparent: true,
      opacity: 0.55
    });
    this.outerIcosahedron = new THREE.Mesh(outerGeo, outerMat);
    this.aiCoreGroup.add(this.outerIcosahedron);

    // 3. Orbital Data Rings
    const ringGeo1 = new THREE.TorusGeometry(1.7, 0.02, 8, 48);
    const ringMat1 = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.65
    });
    this.orbitalRing1 = new THREE.Mesh(ringGeo1, ringMat1);
    this.orbitalRing1.rotation.x = Math.PI / 3;
    this.aiCoreGroup.add(this.orbitalRing1);

    const ringGeo2 = new THREE.TorusGeometry(2.1, 0.02, 8, 48);
    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.5
    });
    this.orbitalRing2 = new THREE.Mesh(ringGeo2, ringMat2);
    this.orbitalRing2.rotation.y = Math.PI / 4;
    this.aiCoreGroup.add(this.orbitalRing2);

    this.scene.add(this.aiCoreGroup);
  }

  createBioDataParticles() {
    // Agricultural bio-luminescence & NPK data particles floating from soil
    const particleCount = 420;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const colorEmerald = new THREE.Color(0x10b981);
    const colorGold = new THREE.Color(0xf59e0b);
    const colorCyan = new THREE.Color(0x38bdf8);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 32;
      positions[i * 3 + 1] = Math.random() * 6 - 0.2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 36;

      const rand = Math.random();
      const c = rand < 0.65 ? colorEmerald : (rand < 0.85 ? colorGold : colorCyan);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.08,
      vertexColors: true,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending
    });

    this.particles = new THREE.Points(geometry, material);
    this.scene.add(this.particles);
  }

  createDataStreamLines() {
    // Flow lines carrying sensor signals along furrow corridors into the AI Core
    const rows = [-6.2, -3.8, -1.4, 2.7, 5.1, 7.5];
    rows.forEach((xPos, idx) => {
      const curve = new THREE.LineCurve3(
        new THREE.Vector3(xPos, -0.45, 9),
        new THREE.Vector3(xPos * 0.18, 2.1, -4.8)
      );

      const points = curve.getPoints(24);
      const geo = new THREE.BufferGeometry().setFromPoints(points);

      const mat = new THREE.LineBasicMaterial({
        color: idx % 2 === 0 ? 0x10b981 : 0x06b6d4,
        transparent: true,
        opacity: 0.32,
        linewidth: 1
      });

      const line = new THREE.Line(geo, mat);
      this.scene.add(line);
      this.dataStreamLines.push(line);
    });
  }

  onMouseMove(e) {
    if (this.reducedMotion) return;
    const windowHalfX = window.innerWidth / 2;
    const windowHalfY = window.innerHeight / 2;
    this.mouseX = (e.clientX - windowHalfX) / windowHalfX;
    this.mouseY = (e.clientY - windowHalfY) / windowHalfY;
  }

  onWindowResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    this.animationId = requestAnimationFrame(this.animate);

    const delta = this.clock.getDelta();
    const elapsedTime = this.clock.getElapsedTime();

    // 1. Camera Parallax & Subtle Agricultural Drift
    if (!this.isTransitioning) {
      // Gentle forward agricultural drift
      const baseTargetX = this.targetCameraX + this.mouseX * 0.9;
      const baseTargetY = this.targetCameraY - this.mouseY * 0.35;

      this.camera.position.x += (baseTargetX - this.camera.position.x) * 0.04;
      this.camera.position.y += (baseTargetY - this.camera.position.y) * 0.04;
      this.camera.position.z += (this.targetCameraZ - this.camera.position.z) * 0.04;

      // Look toward the center maize row corridor and AI core
      this.camera.lookAt(0, 1.8, -5);
    } else {
      // Cinematic Zoom into AI core during CTA click
      this.camera.position.z += (this.targetCameraZ - this.camera.position.z) * 0.08;
      this.camera.position.y += (this.targetCameraY - this.camera.position.y) * 0.08;
      this.camera.position.x += (0 - this.camera.position.x) * 0.08;
      this.camera.lookAt(0, 2.2, -5);
    }

    // 2. AI Core Rotation & Floating
    if (this.aiCoreGroup) {
      if (this.innerCore) {
        this.innerCore.rotation.y += 0.012 * this.corePulseIntensity;
        this.innerCore.rotation.x += 0.008 * this.corePulseIntensity;
        const scale = 1.0 + Math.sin(elapsedTime * 2.5) * 0.07;
        this.innerCore.scale.set(scale, scale, scale);
      }
      if (this.outerIcosahedron) {
        this.outerIcosahedron.rotation.y -= 0.008 * this.corePulseIntensity;
        this.outerIcosahedron.rotation.z += 0.006 * this.corePulseIntensity;
      }
      if (this.orbitalRing1) {
        this.orbitalRing1.rotation.z += 0.016 * this.corePulseIntensity;
      }
      if (this.orbitalRing2) {
        this.orbitalRing2.rotation.x -= 0.018 * this.corePulseIntensity;
      }
      // Floating elevation bob
      this.aiCoreGroup.position.y = 2.2 + Math.sin(elapsedTime * 1.5) * 0.12;
    }

    // 3. Maize Plants Wind Swaying (Organic wind wave traveling across rows)
    if (!this.reducedMotion && this.crops.length > 0) {
      const windSpeed = 2.1 * this.windStrength;
      const swayAmplitude = 0.05 * this.windStrength;

      for (let i = 0; i < this.crops.length; i++) {
        const c = this.crops[i];
        const sway = Math.sin(elapsedTime * windSpeed + c.offset) * swayAmplitude;
        c.group.rotation.z = c.baseRotZ + sway;
      }
    }

    // 4. Water Canal Shimmer
    if (this.waterMesh) {
      this.waterMesh.position.y = -0.58 + Math.sin(elapsedTime * 2.0) * 0.008;
    }

    // 5. Bio/Data Luminescence Particles Upward Drift
    if (this.particles) {
      const pos = this.particles.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) + 0.014 * this.windStrength;
        if (y > 7.0) y = -0.2;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }

    // 7. Render Scene
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  zoomIntoCore(onComplete) {
    this.isTransitioning = true;
    this.targetCameraZ = -4.2;
    this.targetCameraY = 2.2;

    setTimeout(() => {
      if (onComplete) onComplete();
    }, 650);
  }

  dispose() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    window.removeEventListener("resize", this.onWindowResize);
    window.removeEventListener("mousemove", this.onMouseMove);

    if (this.renderer && this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}

window.AgriField3DScene = AgriField3DScene;
