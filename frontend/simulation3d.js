/**
 * Claudrix Agri TN - 3D Scenario Comparison Engine (Page 3 /simulation)
 * Built with Three.js (WebGL)
 *
 * Architecture:
 * - Two distinct agricultural zones:
 *   - ZONE A: Current Scenario (Model Prediction)
 *   - ZONE B: Historical 10-Year Baseline
 * - Central irrigation canal dividing the zones
 * - Dynamic crop geometry matching dashboard selection:
 *   - Rice (Paddy): Flooded paddy field with water reflection and lush tillers
 *   - Maize: Tall jointed stalks with arching drooping leaves & cobs
 *   - Groundnut: Low spreading legume canopy with dark loam soil
 *   - Pulses: Compact bushy legume shrubs with pod clusters
 * - Yield visual mapping:
 *   - Crop height, density, and lushness scale with predicted kg/ha vs baseline
 * - 1.2s smooth animated scenario transitions
 * - Multi-view camera navigation (Side-by-side, Current focus, Historical focus)
 */

class AgriSimulation3DScene {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clock = new THREE.Clock();
    this.animationId = null;

    // Groups & Meshes
    this.zoneAGroup = new THREE.Group();
    this.zoneBGroup = new THREE.Group();
    this.terrainGroup = new THREE.Group();
    this.waterMesh = null;
    this.rainParticles = null;
    this.dataParticles = null;

    // Dynamic State
    this.currentCrop = "Rice (Paddy)";
    this.currentYield = 4387.7;
    this.historicalYield = 3870.0;
    this.scenarioType = "current";

    // Animated Interpolation Targets
    this.scaleA = 1.0;
    this.targetScaleA = 1.13;
    this.scaleB = 1.0;
    this.targetScaleB = 1.0;
    this.stressFactorA = 0.0; // 0 = lush green, 1 = dry stress
    this.targetStressA = 0.0;
    this.rainIntensity = 0.0;
    this.targetRainIntensity = 0.0;

    // Camera Targets
    this.viewMode = "both"; // 'both', 'current', 'historical'
    this.targetCamX = 0;
    this.targetCamY = 2.4;
    this.targetCamZ = 11.5;
    this.targetLookX = 0;
    this.targetLookY = 1.2;
    this.targetLookZ = -3.5;

    // Interaction
    this.mouseX = 0;
    this.mouseY = 0;

    this.init();
  }

  init() {
    // 1. Scene & Atmosphere
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x08151c, 0.024);

    // 2. Camera Setup
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 150);
    this.camera.position.set(0, 2.4, 11.5);

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
      console.warn("WebGL not available for 3D simulator:", e);
      return;
    }

    // 4. Lights
    this.setupLights();

    // 5. Build Environment
    this.scene.add(this.terrainGroup);
    this.scene.add(this.zoneAGroup);
    this.scene.add(this.zoneBGroup);

    this.createAgriculturalBeds();
    this.createIrrigationDivider();
    this.createDistantHorizon();
    this.createWeatherParticles();
    this.rebuildCropZones();

    // 6. Listeners
    this.onWindowResize = this.onWindowResize.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    window.addEventListener("resize", this.onWindowResize);
    window.addEventListener("mousemove", this.onMouseMove);

    // 7. Loop
    this.animate = this.animate.bind(this);
    this.animate();
  }

  setupLights() {
    // Atmospheric ambient
    const ambient = new THREE.AmbientLight(0x192e27, 1.8);
    this.scene.add(ambient);

    // Warm Tamil Nadu sunlight
    const sun = new THREE.DirectionalLight(0xffbe68, 2.3);
    sun.position.set(16, 16, -20);
    this.scene.add(sun);

    // Zone A Cyan Accent Light
    const lightA = new THREE.PointLight(0x38bdf8, 1.8, 20);
    lightA.position.set(-4, 3, -2);
    this.scene.add(lightA);

    // Zone B Gold/Emerald Baseline Light
    const lightB = new THREE.PointLight(0x10b981, 1.8, 20);
    lightB.position.set(4, 3, -2);
    this.scene.add(lightB);
  }

  createAgriculturalBeds() {
    // Soil Bed for Zone A (Left) & Zone B (Right)
    const bedGeo = new THREE.PlaneGeometry(16, 36, 32, 40);

    // Zone A: Current Scenario Bed
    const matA = new THREE.MeshStandardMaterial({
      color: 0x271912,
      roughness: 0.92,
      metalness: 0.05
    });
    const soilA = new THREE.Mesh(bedGeo, matA);
    soilA.rotation.x = -Math.PI / 2;
    soilA.position.set(-8.8, -0.5, -4);
    this.terrainGroup.add(soilA);

    // Zone B: Historical Baseline Bed
    const matB = new THREE.MeshStandardMaterial({
      color: 0x24160f,
      roughness: 0.95,
      metalness: 0.05
    });
    const soilB = new THREE.Mesh(bedGeo, matB);
    soilB.rotation.x = -Math.PI / 2;
    soilB.position.set(8.8, -0.5, -4);
    this.terrainGroup.add(soilB);

    // Side Berms
    const bermGeo = new THREE.BoxGeometry(0.8, 0.4, 36);
    const bermMat = new THREE.MeshStandardMaterial({ color: 0x1d120c, roughness: 0.95 });

    const bermLeft = new THREE.Mesh(bermGeo, bermMat);
    bermLeft.position.set(-17.2, -0.3, -4);
    this.terrainGroup.add(bermLeft);

    const bermRight = new THREE.Mesh(bermGeo, bermMat);
    bermRight.position.set(17.2, -0.3, -4);
    this.terrainGroup.add(bermRight);
  }

  createIrrigationDivider() {
    // Central canal dividing Zone A and Zone B
    const canalWidth = 1.6;
    const canalLength = 38;

    // Canal trench floor
    const floorGeo = new THREE.PlaneGeometry(canalWidth, canalLength);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x15100c, roughness: 0.9 });
    const canalFloor = new THREE.Mesh(floorGeo, floorMat);
    canalFloor.rotation.x = -Math.PI / 2;
    canalFloor.position.set(0, -0.75, -4);
    this.terrainGroup.add(canalFloor);

    // Canal water layer
    const waterGeo = new THREE.PlaneGeometry(canalWidth * 0.95, canalLength);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x143c4a,
      roughness: 0.12,
      metalness: 0.5,
      transparent: true,
      opacity: 0.88
    });
    this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
    this.waterMesh.rotation.x = -Math.PI / 2;
    this.waterMesh.position.set(0, -0.6, -4);
    this.terrainGroup.add(this.waterMesh);
  }

  createDistantHorizon() {
    // Distant Tamil Nadu landscape: low Ghats foothills & sparse palm tree silhouettes
    const hillGeo = new THREE.PlaneGeometry(100, 8, 24, 2);
    const pos = hillGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > 0) {
        pos.setY(i, pos.getY(i) + Math.sin(pos.getX(i) * 0.1) * 1.8);
      }
    }
    hillGeo.computeVertexNormals();

    const hillMat = new THREE.MeshBasicMaterial({ color: 0x091b22, fog: true });
    const hills = new THREE.Mesh(hillGeo, hillMat);
    hills.position.set(0, 3, -42);
    this.scene.add(hills);

    // Distant palm silhouettes along horizon
    const trunkMat = new THREE.MeshBasicMaterial({ color: 0x14201d });
    const trunkGeo = new THREE.CylinderGeometry(0.08, 0.18, 5.5, 5);

    const palmCoords = [-24, -18, -12, 12, 18, 24];
    palmCoords.forEach(x => {
      const palm = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 2.75;
      palm.add(trunk);

      // Frond crown
      const frondGeo = new THREE.ConeGeometry(1.6, 0.8, 5);
      const frond = new THREE.Mesh(frondGeo, trunkMat);
      frond.position.y = 5.2;
      palm.add(frond);

      palm.position.set(x, -0.4, -36 + (Math.random() - 0.5) * 4);
      palm.rotation.z = (Math.random() - 0.5) * 0.15;
      this.scene.add(palm);
    });
  }

  createWeatherParticles() {
    // Rain Particles for High Rainfall scenario
    const dropCount = 900;
    const rainGeo = new THREE.BufferGeometry();
    const rainPos = new Float32Array(dropCount * 3);

    for (let i = 0; i < dropCount; i++) {
      rainPos[i * 3] = (Math.random() - 0.5) * 36;
      rainPos[i * 3 + 1] = Math.random() * 18 + 1;
      rainPos[i * 3 + 2] = (Math.random() - 0.5) * 36;
    }
    rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));

    const rainMat = new THREE.PointsMaterial({
      color: 0x93c5fd,
      size: 0.11,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending
    });
    this.rainParticles = new THREE.Points(rainGeo, rainMat);
    this.scene.add(this.rainParticles);
  }

  /**
   * Rebuilds Zone A and Zone B crops based on the active crop type.
   */
  rebuildCropZones() {
    // Clear previous crop meshes
    while (this.zoneAGroup.children.length > 0) {
      const obj = this.zoneAGroup.children[0];
      this.zoneAGroup.remove(obj);
    }
    while (this.zoneBGroup.children.length > 0) {
      const obj = this.zoneBGroup.children[0];
      this.zoneBGroup.remove(obj);
    }

    const crop = this.currentCrop;

    if (crop.includes("Rice")) {
      this.buildRicePaddyField();
    } else if (crop.includes("Maize")) {
      this.buildMaizeField();
    } else if (crop.includes("Groundnut")) {
      this.buildGroundnutField();
    } else {
      // Pulses (Black Gram / Green Gram)
      this.buildPulsesField();
    }
  }

  /**
   * 1. Rice (Paddy): Flooded alluvial field with lush dense tillers
   */
  buildRicePaddyField() {
    // Water layer over soil beds
    const waterSheetGeo = new THREE.PlaneGeometry(15, 34);
    const waterSheetMat = new THREE.MeshStandardMaterial({
      color: 0x16424e,
      roughness: 0.15,
      metalness: 0.35,
      transparent: true,
      opacity: 0.65
    });

    const waterSheetA = new THREE.Mesh(waterSheetGeo, waterSheetMat);
    waterSheetA.rotation.x = -Math.PI / 2;
    waterSheetA.position.set(-8.8, -0.47, -4);
    this.zoneAGroup.add(waterSheetA);

    const waterSheetB = new THREE.Mesh(waterSheetGeo, waterSheetMat);
    waterSheetB.rotation.x = -Math.PI / 2;
    waterSheetB.position.set(8.8, -0.47, -4);
    this.zoneBGroup.add(waterSheetB);

    // Rice Tiller Clump Geometry
    const tillerMatA = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.65, side: THREE.DoubleSide });
    const tillerMatB = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.7, side: THREE.DoubleSide });

    const rows = 6;
    const plantsPerRow = 18;

    for (let r = 0; r < rows; r++) {
      const relX = (r - (rows - 1) / 2) * 2.2;

      for (let p = 0; p < plantsPerRow; p++) {
        const z = -p * 1.8 + 8;

        // Zone A Clump
        const clumpA = this.createRiceClump(tillerMatA, 1.0);
        clumpA.position.set(-8.8 + relX + (Math.random() - 0.5) * 0.2, -0.45, z);
        this.zoneAGroup.add(clumpA);

        // Zone B Clump
        const clumpB = this.createRiceClump(tillerMatB, 0.95);
        clumpB.position.set(8.8 + relX + (Math.random() - 0.5) * 0.2, -0.45, z);
        this.zoneBGroup.add(clumpB);
      }
    }
  }

  createRiceClump(material, baseScale) {
    const group = new THREE.Group();
    // 5 radiating slender arched blades
    for (let i = 0; i < 5; i++) {
      const bladeGeo = new THREE.CylinderGeometry(0.01, 0.025, 0.95 * baseScale, 4);
      const blade = new THREE.Mesh(bladeGeo, material);
      blade.position.y = 0.45 * baseScale;
      blade.rotation.y = (i / 5) * Math.PI * 2;
      blade.rotation.x = 0.22 + (Math.random() - 0.5) * 0.08;
      group.add(blade);
    }
    return group;
  }

  /**
   * 2. Maize Field: Tall stalks, arching leaves, and cobs
   */
  buildMaizeField() {
    const stalkMatA = new THREE.MeshStandardMaterial({ color: 0x417024, roughness: 0.75 });
    const leafMatA = new THREE.MeshStandardMaterial({ color: 0x316e23, roughness: 0.6, side: THREE.DoubleSide });
    const stalkMatB = new THREE.MeshStandardMaterial({ color: 0x396320, roughness: 0.8 });
    const leafMatB = new THREE.MeshStandardMaterial({ color: 0x2b611e, roughness: 0.65, side: THREE.DoubleSide });

    const rows = 5;
    const plantsPerRow = 15;

    for (let r = 0; r < rows; r++) {
      const relX = (r - (rows - 1) / 2) * 2.6;

      for (let p = 0; p < plantsPerRow; p++) {
        const z = -p * 2.2 + 8;

        const maizeA = this.createMaizePlant(stalkMatA, leafMatA, 1.0);
        maizeA.position.set(-8.8 + relX, -0.5, z);
        this.zoneAGroup.add(maizeA);

        const maizeB = this.createMaizePlant(stalkMatB, leafMatB, 0.95);
        maizeB.position.set(8.8 + relX, -0.5, z);
        this.zoneBGroup.add(maizeB);
      }
    }
  }

  createMaizePlant(stalkMat, leafMat, baseScale) {
    const group = new THREE.Group();
    const height = 1.9 * baseScale;
    const stalkGeo = new THREE.CylinderGeometry(0.02, 0.035, height, 5);
    const stalk = new THREE.Mesh(stalkGeo, stalkMat);
    stalk.position.y = height / 2;
    group.add(stalk);

    // 6 arching leaves
    for (let l = 0; l < 6; l++) {
      const leafGeo = new THREE.CylinderGeometry(0.01, 0.06, 0.85, 4);
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.y = (0.3 + l * 0.1) * height;
      leaf.rotation.y = l * 2.3;
      leaf.rotation.x = 0.55;
      group.add(leaf);
    }
    return group;
  }

  /**
   * 3. Groundnut Field: Low spreading dense legume canopy
   */
  buildGroundnutField() {
    const leafMatA = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.7 });
    const leafMatB = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.75 });
    const flowerMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 }); // Tiny yellow flower specks

    const rows = 6;
    const plantsPerRow = 18;

    for (let r = 0; r < rows; r++) {
      const relX = (r - (rows - 1) / 2) * 2.2;

      for (let p = 0; p < plantsPerRow; p++) {
        const z = -p * 1.8 + 8;

        const plantA = this.createGroundnutPlant(leafMatA, flowerMat, 1.0);
        plantA.position.set(-8.8 + relX, -0.48, z);
        this.zoneAGroup.add(plantA);

        const plantB = this.createGroundnutPlant(leafMatB, flowerMat, 0.95);
        plantB.position.set(8.8 + relX, -0.48, z);
        this.zoneBGroup.add(plantB);
      }
    }
  }

  createGroundnutPlant(leafMat, flowerMat, baseScale) {
    const group = new THREE.Group();
    // Low spreading dome canopy
    const domeGeo = new THREE.SphereGeometry(0.42 * baseScale, 6, 5);
    const dome = new THREE.Mesh(domeGeo, leafMat);
    dome.scale.set(1.4, 0.65, 1.4);
    dome.position.y = 0.22 * baseScale;
    group.add(dome);

    // Yellow flower specks
    const flower = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 3), flowerMat);
    flower.position.set(0.12, 0.35 * baseScale, 0.1);
    group.add(flower);

    return group;
  }

  /**
   * 4. Pulses Field: Compact bushy legume shrubs with pod clusters
   */
  buildPulsesField() {
    const bushMatA = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.75 });
    const bushMatB = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.8 });

    const rows = 5;
    const plantsPerRow = 16;

    for (let r = 0; r < rows; r++) {
      const relX = (r - (rows - 1) / 2) * 2.4;

      for (let p = 0; p < plantsPerRow; p++) {
        const z = -p * 2.0 + 8;

        const bushA = this.createPulseBush(bushMatA, 1.0);
        bushA.position.set(-8.8 + relX, -0.48, z);
        this.zoneAGroup.add(bushA);

        const bushB = this.createPulseBush(bushMatB, 0.95);
        bushB.position.set(8.8 + relX, -0.48, z);
        this.zoneBGroup.add(bushB);
      }
    }
  }

  createPulseBush(material, baseScale) {
    const group = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.65 * baseScale, 4), material);
    stem.position.y = 0.3 * baseScale;
    group.add(stem);

    const bush = new THREE.Mesh(new THREE.SphereGeometry(0.38 * baseScale, 6, 5), material);
    bush.position.y = 0.55 * baseScale;
    bush.scale.set(1.1, 0.8, 1.1);
    group.add(bush);

    return group;
  }

  /**
   * Updates comparative yield metrics from real dashboard state & animates 3D difference
   */
  updateScenarioData(data) {
    if (!data) return;

    this.currentYield = data.currentYield || this.currentYield;
    this.historicalYield = data.historicalYield || this.historicalYield;
    if (data.crop && data.crop !== this.currentCrop) {
      this.currentCrop = data.crop;
      this.rebuildCropZones();
    }

    // Calculate visual scale ratio based on actual yield difference
    const ratio = this.currentYield / Math.max(this.historicalYield, 1);
    // Clamp visual scale between 0.65 (severe stress) and 1.35 (abundant bumper crop)
    this.targetScaleA = Math.max(0.65, Math.min(1.35, ratio));
    this.targetScaleB = 1.0;

    // Stress factor (0 = healthy green, 1 = dry yellow/brown tint)
    if (ratio < 0.85) {
      this.targetStressA = Math.min(1.0, (0.85 - ratio) * 2.5);
    } else {
      this.targetStressA = 0.0;
    }

    // Weather adjustments based on scenario
    if (data.scenario === "high-rain") {
      this.targetRainIntensity = 0.8;
    } else {
      this.targetRainIntensity = 0.0;
    }
  }

  /**
   * Sets the camera view mode:
   * - 'both': Side-by-side comparative perspective
   * - 'current': Zoom into Zone A (Current Scenario)
   * - 'historical': Zoom into Zone B (Historical Baseline)
   */
  setViewMode(mode) {
    this.viewMode = mode;

    if (mode === "current") {
      this.targetCamX = -8.8;
      this.targetCamY = 1.8;
      this.targetCamZ = 8.0;
      this.targetLookX = -8.8;
      this.targetLookY = 1.0;
      this.targetLookZ = -4.0;
    } else if (mode === "historical") {
      this.targetCamX = 8.8;
      this.targetCamY = 1.8;
      this.targetCamZ = 8.0;
      this.targetLookX = 8.8;
      this.targetLookY = 1.0;
      this.targetLookZ = -4.0;
    } else {
      // 'both'
      this.targetCamX = 0;
      this.targetCamY = 2.4;
      this.targetCamZ = 11.5;
      this.targetLookX = 0;
      this.targetLookY = 1.2;
      this.targetLookZ = -3.5;
    }
  }

  onMouseMove(e) {
    const halfX = window.innerWidth / 2;
    const halfY = window.innerHeight / 2;
    this.mouseX = (e.clientX - halfX) / halfX;
    this.mouseY = (e.clientY - halfY) / halfY;
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
    const elapsedTime = this.clock.getElapsedTime();

    // 1. Smooth Camera Navigation
    const camParallaxX = this.mouseX * 0.6;
    const camParallaxY = -this.mouseY * 0.25;

    this.camera.position.x += (this.targetCamX + camParallaxX - this.camera.position.x) * 0.05;
    this.camera.position.y += (this.targetCamY + camParallaxY - this.camera.position.y) * 0.05;
    this.camera.position.z += (this.targetCamZ - this.camera.position.z) * 0.05;
    this.camera.lookAt(this.targetLookX, this.targetLookY, this.targetLookZ);

    // 2. Smooth 3D Yield Scaling Transition (1.2s lerp)
    this.scaleA += (this.targetScaleA - this.scaleA) * 0.06;
    this.scaleB += (this.targetScaleB - this.scaleB) * 0.06;
    this.stressFactorA += (this.targetStressA - this.stressFactorA) * 0.06;
    this.rainIntensity += (this.targetRainIntensity - this.rainIntensity) * 0.06;

    // Apply scale to Zone A crops
    this.zoneAGroup.scale.set(1.0, this.scaleA, 1.0);
    this.zoneBGroup.scale.set(1.0, this.scaleB, 1.0);

    // 3. Canal Water Ripple
    if (this.waterMesh) {
      this.waterMesh.position.y = -0.6 + Math.sin(elapsedTime * 2.2) * 0.008;
    }

    // 4. Rain Particles
    if (this.rainParticles) {
      this.rainParticles.material.opacity = this.rainIntensity;
      if (this.rainIntensity > 0.05) {
        const pos = this.rainParticles.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          let y = pos.getY(i) - 0.65;
          if (y < -0.5) y = Math.random() * 15 + 10;
          pos.setY(i, y);
        }
        pos.needsUpdate = true;
      }
    }

    // 5. Render
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  dispose() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    window.removeEventListener("resize", this.onWindowResize);
    window.removeEventListener("mousemove", this.onMouseMove);
    if (this.renderer && this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}

window.AgriSimulation3DScene = AgriSimulation3DScene;
