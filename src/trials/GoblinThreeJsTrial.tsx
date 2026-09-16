import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Pause, Play, RotateCcw } from "lucide-react";
import {
  BoxGeometry,
  ClampToEdgeWrapping,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  GridHelper,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
  type Material,
} from "three";
import "./GoblinThreeJsTrial.css";

const publicAssetPath = (path: string): string => `${import.meta.env.BASE_URL}${path}`;
const THREE = {
  BoxGeometry,
  ClampToEdgeWrapping,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  GridHelper,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
};
type ThreeNamespace = typeof THREE;

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const smoothstep = (edge0: number, edge1: number, value: number): number => {
  const x = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
};

const pulse = (start: number, end: number, value: number): number =>
  smoothstep(start, start + 0.08, value) * (1 - smoothstep(end - 0.08, end, value));

const setCylinderBetween = (THREE: ThreeNamespace, mesh: Mesh, start: Vector3, end: Vector3) => {
  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  const direction = end.clone().sub(start);
  const length = Math.max(direction.length(), 0.001);
  mesh.position.copy(midpoint);
  mesh.scale.set(1, length, 1);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
};

const makeArmSegment = (THREE: ThreeNamespace, material: Material): Mesh =>
  new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.052, 1, 18), material);

export const GoblinThreeJsTrial = () => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const playingRef = useRef(true);
  const replayRef = useRef(0);
  const [playing, setPlaying] = useState(true);
  const [replayToken, setReplayToken] = useState(0);
  const [rendererError, setRendererError] = useState<string>();

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    replayRef.current += 1;
  }, [replayToken]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let frameHandle = 0;
    let latestReplay = replayRef.current;
    let elapsed = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f7f4);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
    camera.position.set(0, 2.35, 6.6);
    camera.lookAt(0.18, 1.15, 0);
    let cameraY = 2.35;
    let cameraZ = 6.6;

    let renderer: InstanceType<typeof THREE.WebGLRenderer>;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      setRendererError("This browser could not start the Three.js WebGL renderer.");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-label", "Three.js goblin pour animation");
    renderer.domElement.setAttribute("role", "img");
    mount.appendChild(renderer.domElement);

    const root = new THREE.Group();
    scene.add(root);

    const ambient = new THREE.HemisphereLight(0xffffff, 0x8a6b45, 1.95);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(-2.6, 5.4, 3.6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x7fc7d0, 0.85);
    rim.position.set(3.2, 2.6, -2.8);
    scene.add(rim);

    const bench = new THREE.Mesh(
      new THREE.BoxGeometry(8.8, 0.28, 4.2),
      new THREE.MeshStandardMaterial({ color: 0x9b6a36, roughness: 0.74, metalness: 0.05 }),
    );
    bench.position.set(0, -0.12, 0);
    root.add(bench);

    const backPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(8.8, 3.2),
      new THREE.MeshBasicMaterial({ color: 0xe9f2ee, transparent: true, opacity: 0.88 }),
    );
    backPanel.position.set(0, 1.72, -1.72);
    root.add(backPanel);

    const wallGrid = new THREE.GridHelper(8.8, 22, 0xb9cbc5, 0xd5e2de);
    wallGrid.rotation.x = Math.PI / 2;
    wallGrid.position.set(0, 1.72, -1.7);
    root.add(wallGrid);

    const standMaterial = new THREE.MeshStandardMaterial({ color: 0x3d4748, roughness: 0.34, metalness: 0.62 });
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xdff7fb,
      opacity: 0.35,
      roughness: 0.08,
      metalness: 0,
      transmission: 0.35,
      transparent: true,
    });
    const waterMaterial = new THREE.MeshBasicMaterial({ color: 0x68d7ee, opacity: 0.78, transparent: true });

    const stand = new THREE.Group();
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 2.08, 18), standMaterial);
    rod.position.set(0, 1.08, 0);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.1, 0.44), standMaterial);
    base.position.set(0, 0.1, 0);
    const clampRing = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.014, 12, 42), standMaterial);
    clampRing.rotation.x = Math.PI / 2;
    clampRing.position.set(-0.16, 1.38, 0.02);
    const funnel = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.42, 40, 1, true), glassMaterial);
    funnel.rotation.x = Math.PI;
    funnel.position.set(-0.18, 1.7, 0.02);
    stand.add(rod, base, clampRing, funnel);
    stand.position.set(0.88, 0, -0.02);
    root.add(stand);

    const receivingBeaker = new THREE.Group();
    const beakerWall = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.28, 0.82, 48, 1, true), glassMaterial);
    beakerWall.position.set(0, 0.47, 0);
    const beakerRim = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.012, 10, 48), glassMaterial);
    beakerRim.rotation.x = Math.PI / 2;
    beakerRim.position.set(0, 0.89, 0);
    const beakerLiquid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.27, 0.25, 0.08, 48),
      new THREE.MeshBasicMaterial({ color: 0xb7e9ef, opacity: 0.34, transparent: true }),
    );
    beakerLiquid.position.set(0, 0.2, 0);
    receivingBeaker.add(beakerWall, beakerRim, beakerLiquid);
    receivingBeaker.position.set(2.1, 0.02, 0.05);
    root.add(receivingBeaker);

    const goblinGroup = new THREE.Group();
    goblinGroup.position.set(-1.35, 0.2, 0.22);
    root.add(goblinGroup);

    const sleeveMaterial = new THREE.MeshStandardMaterial({ color: 0xf4f1e7, roughness: 0.62 });
    const skinMaterial = new THREE.MeshStandardMaterial({ color: 0x70a82e, roughness: 0.5 });
    const skinDarkMaterial = new THREE.MeshStandardMaterial({ color: 0x4c8422, roughness: 0.58 });
    const earInnerMaterial = new THREE.MeshStandardMaterial({ color: 0xd48b49, roughness: 0.6 });
    const coatShadowMaterial = new THREE.MeshStandardMaterial({ color: 0xd8ddcf, roughness: 0.76 });
    const trouserMaterial = new THREE.MeshStandardMaterial({ color: 0x314036, roughness: 0.7 });
    const propGlassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xd9f5fa,
      opacity: 0.44,
      roughness: 0.05,
      transmission: 0.45,
      transparent: true,
    });

    const goblinFaceTexture = new THREE.TextureLoader().load(publicAssetPath("assets/goblin-mode/apparatus-helper.png"));
    goblinFaceTexture.colorSpace = THREE.SRGBColorSpace;
    goblinFaceTexture.wrapS = THREE.ClampToEdgeWrapping;
    goblinFaceTexture.wrapT = THREE.ClampToEdgeWrapping;
    goblinFaceTexture.repeat.set(276 / 512, 220 / 512);
    goblinFaceTexture.offset.set(118 / 512, 1 - (40 + 220) / 512);

    const bodyGroup = new THREE.Group();
    const torsoGroup = new THREE.Group();
    const headPivot = new THREE.Group();
    const leftEar = new THREE.Group();
    const rightEar = new THREE.Group();
    const leftLeg = makeArmSegment(THREE, trouserMaterial);
    const rightLeg = makeArmSegment(THREE, trouserMaterial);
    const bodyCore = new THREE.Mesh(new THREE.SphereGeometry(0.36, 32, 20), skinDarkMaterial);
    bodyCore.scale.set(0.86, 1.18, 0.58);
    bodyCore.position.set(0, 0.72, 0);

    const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.43, 0.86, 28), sleeveMaterial);
    coat.scale.z = 0.62;
    coat.position.set(0, 0.65, 0.02);
    const coatLeftPanel = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.74, 0.035), coatShadowMaterial);
    coatLeftPanel.position.set(-0.12, 0.58, 0.27);
    coatLeftPanel.rotation.z = 0.05;
    const coatRightPanel = coatLeftPanel.clone();
    coatRightPanel.position.x = 0.12;
    coatRightPanel.rotation.z = -0.05;
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.026, 8, 36, Math.PI), coatShadowMaterial);
    collar.position.set(0, 1.07, 0.22);
    collar.rotation.set(Math.PI * 0.5, 0, Math.PI);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 12), skinDarkMaterial);
    belly.scale.set(0.9, 1.06, 0.34);
    belly.position.set(0, 0.54, 0.3);
    torsoGroup.add(bodyCore, coat, coatLeftPanel, coatRightPanel, collar, belly);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 40, 24), skinMaterial);
    head.scale.set(1.08, 0.95, 0.92);
    head.position.set(0, 0, 0);
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(0.96, 0.76),
      new THREE.MeshBasicMaterial({
        alphaTest: 0.04,
        map: goblinFaceTexture,
        side: THREE.DoubleSide,
        transparent: true,
      }),
    );
    face.position.set(0, -0.02, 0.36);

    const hairMaterial = new THREE.MeshStandardMaterial({ color: 0x5d8e1f, roughness: 0.64 });
    const hairTuft = new THREE.Group();
    for (let index = 0; index < 4; index += 1) {
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.34 - index * 0.035, 12), hairMaterial);
      tuft.position.set((index - 1.5) * 0.07, 0.35 + index * 0.012, -0.02);
      tuft.rotation.z = (index - 1.5) * -0.22;
      tuft.rotation.x = -0.12;
      hairTuft.add(tuft);
    }

    const makeEar = (side: -1 | 1, earGroup: InstanceType<typeof THREE.Group>) => {
      const outer = new THREE.Mesh(new THREE.SphereGeometry(0.2, 26, 14), skinMaterial);
      outer.scale.set(1.65, 0.62, 0.22);
      outer.rotation.z = side * -0.28;
      outer.position.set(side * 0.42, 0.01, -0.01);
      const inner = new THREE.Mesh(new THREE.SphereGeometry(0.14, 22, 10), earInnerMaterial);
      inner.scale.set(1.5, 0.48, 0.12);
      inner.position.set(side * 0.43, -0.005, 0.03);
      inner.rotation.z = outer.rotation.z;
      earGroup.add(outer, inner);
    };
    makeEar(-1, leftEar);
    makeEar(1, rightEar);
    headPivot.position.set(0, 1.28, 0.08);
    headPivot.add(leftEar, rightEar, head, hairTuft, face);

    const leftUpper = makeArmSegment(THREE, sleeveMaterial);
    const leftLower = makeArmSegment(THREE, sleeveMaterial);
    const rightUpper = makeArmSegment(THREE, sleeveMaterial);
    const rightLower = makeArmSegment(THREE, sleeveMaterial);
    const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.072, 20, 12), skinMaterial);
    const rightHand = new THREE.Mesh(new THREE.SphereGeometry(0.072, 20, 12), skinMaterial);
    const leftFoot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 18, 10), skinMaterial);
    leftFoot.scale.set(1.85, 0.42, 0.78);
    const rightFoot = leftFoot.clone();
    const handBeaker = new THREE.Group();
    const handBeakerWall = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.105, 0.34, 32, 1, true), propGlassMaterial);
    const handBeakerRim = new THREE.Mesh(new THREE.TorusGeometry(0.132, 0.007, 8, 32), propGlassMaterial);
    handBeakerRim.rotation.x = Math.PI / 2;
    handBeakerRim.position.y = 0.17;
    handBeaker.add(handBeakerWall, handBeakerRim);

    bodyGroup.add(torsoGroup, headPivot, leftLeg, rightLeg, leftFoot, rightFoot);
    goblinGroup.add(bodyGroup, leftUpper, leftLower, rightUpper, rightLower, leftHand, rightHand, handBeaker);

    const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1, 12), waterMaterial);
    stream.visible = false;
    root.add(stream);

    const scratchStart = new THREE.Vector3();
    const scratchEnd = new THREE.Vector3();
    const localPourStart = new THREE.Vector3(-0.13, 0.17, 0.02);
    const worldPourEnd = new THREE.Vector3(0.72, 1.62, 0.08);

    let dragStartX = 0;
    let dragStartRotation = 0;
    let dragging = false;
    let userRotation = 0;

    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      dragStartX = event.clientX;
      dragStartRotation = userRotation;
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      userRotation = clamp(dragStartRotation + (event.clientX - dragStartX) * 0.006, -0.34, 0.34);
    };
    const onPointerUp = (event: PointerEvent) => {
      dragging = false;
      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerUp);

    const resize = () => {
      const { clientWidth, clientHeight } = mount;
      const width = Math.max(clientWidth, 1);
      const height = Math.max(clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      if (camera.aspect < 0.72) {
        cameraY = 2.42;
        cameraZ = 10.2;
      } else if (camera.aspect < 1.05) {
        cameraY = 2.38;
        cameraZ = 8.2;
      } else {
        cameraY = 2.35;
        cameraZ = 6.6;
      }
      camera.position.set(0.12, cameraY, cameraZ);
      camera.updateProjectionMatrix();
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);

    const renderPose = (phase: number) => {
      const prepare = smoothstep(0.12, 0.34, phase);
      const reach = smoothstep(0.28, 0.56, phase) * (1 - smoothstep(0.78, 0.98, phase));
      const pour = pulse(0.52, 0.76, phase);
      const recover = smoothstep(0.76, 0.98, phase);
      const liveReach = Math.max(reach, pour * 0.92);
      const bodyLift = -prepare * 0.06 + liveReach * 0.03;

      root.rotation.y += (userRotation - root.rotation.y) * 0.08;
      goblinGroup.position.x = -1.35 + liveReach * 0.22 - recover * 0.06;
      goblinGroup.position.y = 0.2 + liveReach * 0.02;
      goblinGroup.rotation.z = -0.02 * prepare - 0.08 * pour + recover * 0.03;
      bodyGroup.position.y = bodyLift + Math.sin(phase * Math.PI * 2) * 0.008 * (1 - liveReach);
      bodyGroup.rotation.z = -0.05 * prepare - 0.16 * pour + recover * 0.05;
      bodyGroup.rotation.y = 0.08 + liveReach * 0.2;
      torsoGroup.scale.y = 1 - prepare * 0.05 + pour * 0.03;
      headPivot.position.y = 1.28 - prepare * 0.03 + pour * 0.04;
      headPivot.rotation.z = 0.08 * prepare - 0.1 * pour + recover * 0.03;
      headPivot.rotation.y = liveReach * 0.16;

      leftFoot.position.set(-0.29 - prepare * 0.03, -0.65, 0.16);
      rightFoot.position.set(0.29 + liveReach * 0.04, -0.65, 0.16);
      setCylinderBetween(
        THREE,
        leftLeg,
        new THREE.Vector3(-0.14, 0.18, 0.08),
        new THREE.Vector3(leftFoot.position.x, -0.55, 0.15),
      );
      setCylinderBetween(
        THREE,
        rightLeg,
        new THREE.Vector3(0.14, 0.18, 0.08),
        new THREE.Vector3(rightFoot.position.x, -0.55, 0.15),
      );

      const leftShoulder = new THREE.Vector3(-0.31, 0.87 + bodyLift, 0.22);
      const rightShoulder = new THREE.Vector3(0.31, 0.87 + bodyLift, 0.22);
      const leftElbow = new THREE.Vector3(-0.23 + liveReach * 0.44, 0.64 + liveReach * 0.48, 0.3);
      const rightElbow = new THREE.Vector3(0.23 + liveReach * 0.46, 0.64 + liveReach * 0.5, 0.31);
      const leftHandPos = new THREE.Vector3(-0.13 + liveReach * 0.62, 0.49 + liveReach * 0.92, 0.38);
      const rightHandPos = new THREE.Vector3(0.16 + liveReach * 0.66, 0.5 + liveReach * 0.92, 0.38);

      setCylinderBetween(THREE, leftUpper, leftShoulder, leftElbow);
      setCylinderBetween(THREE, leftLower, leftElbow, leftHandPos);
      setCylinderBetween(THREE, rightUpper, rightShoulder, rightElbow);
      setCylinderBetween(THREE, rightLower, rightElbow, rightHandPos);
      leftHand.position.copy(leftHandPos);
      rightHand.position.copy(rightHandPos);

      const handCenter = scratchStart.copy(leftHandPos).add(rightHandPos).multiplyScalar(0.5);
      handBeaker.position.copy(handCenter);
      handBeaker.rotation.z = -0.12 - liveReach * 0.42 - pour * 0.86;
      handBeaker.rotation.y = -0.2 + liveReach * 0.18;

      const pourStart = localPourStart.clone();
      handBeaker.localToWorld(pourStart);
      scratchEnd.copy(worldPourEnd);
      setCylinderBetween(THREE, stream, pourStart, scratchEnd);
      stream.visible = pour > 0.08;
      waterMaterial.opacity = 0.18 + pour * 0.72;

      camera.position.set(0.12 + liveReach * 0.12, cameraY, cameraZ);
      camera.lookAt(0.2, 1.18, 0);
      renderer.render(scene, camera);
    };

    const animate = () => {
      if (disposed) return;
      if (latestReplay !== replayRef.current) {
        latestReplay = replayRef.current;
        elapsed = 0;
      }

      if (playingRef.current && !reducedMotion) {
        elapsed += 1 / 60;
      }

      const phase = reducedMotion ? 0.62 : (elapsed % 2.8) / 2.8;
      renderPose(phase);
      frameHandle = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameHandle);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerUp);
      goblinFaceTexture.dispose();
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const material = object.material;
        if (Array.isArray(material)) {
          material.forEach((item) => item.dispose());
        } else {
          material.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <main className="goblin-three-trial" aria-labelledby="goblin-three-title">
      <header className="goblin-three-trial__header">
        <div>
          <a className="goblin-three-trial__back" href="#/trial/goblin-animation">
            <ArrowLeft size={16} aria-hidden="true" /> Sprite trial
          </a>
          <h1 id="goblin-three-title">Goblin Three.js Pour Trial</h1>
          <p>Standalone 3D staging test using a modeled body and the apparatus helper face.</p>
        </div>
        <p className="goblin-three-trial__status">
          Hidden prototype route. The goblin has a modeled head, ears, coat, limbs, prop, and stream while
          preserving the original character face as a texture decal.
        </p>
      </header>
      <section className="goblin-three-trial__stage" aria-label="Three.js goblin pour demo">
        <div className="goblin-three-trial__viewport" ref={mountRef} data-testid="goblin-three-viewport">
          {rendererError ? <p className="goblin-three-trial__error">{rendererError}</p> : null}
        </div>
        <div className="goblin-three-trial__controls" aria-label="Three.js animation controls">
          <button aria-pressed={playing} onClick={() => setPlaying((current) => !current)} type="button">
            {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
            {playing ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPlaying(true);
              setReplayToken((token) => token + 1);
            }}
          >
            <RotateCcw size={16} aria-hidden="true" />
            Replay
          </button>
        </div>
        <p className="goblin-three-trial__caption">
          <strong>Drag the scene to inspect the stage.</strong>
          <span>The original face stays recognizable while Three.js controls the body lean, reach, vessel tilt, foot stance, and stream timing.</span>
        </p>
      </section>
    </main>
  );
};
