import * as THREE from "three";

/**
 * A small synthetic laboratory rendered into a PMREM (ported from the prototype's look.js, plan
 * §6.2, §12): a daylight window, ceiling troffers, a softbox and rim strips, with dark cabinets and
 * a worktop. It lights the scene and gives glass and steel their window streaks and dark edges.
 * The bright sources sit near bench height, because vertical glass reflects what lies near its
 * own height. Units are metres; the bench top is y = 0.
 */
export const labEnvironment = (renderer: THREE.WebGLRenderer): THREE.Texture => {
  const env = new THREE.Scene();
  const flat = (r: number, g = r, b = r) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), side: THREE.BackSide });
  const room = new THREE.Mesh(new THREE.BoxGeometry(7, 3.2, 6), [
    flat(0.66, 0.67, 0.68), flat(0.58, 0.59, 0.6), flat(0.82, 0.82, 0.8), flat(0.08), flat(0.5, 0.51, 0.52), flat(0.7, 0.7, 0.7),
  ]);
  room.position.set(0, 0.7, 0);
  env.add(room);
  const panel = (w: number, h: number, color: THREE.Color, pos: [number, number, number], rotY = 0, rotX = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.rotation.set(rotX, rotY, 0);
    env.add(m);
  };
  const box = (sx: number, sy: number, sz: number, c: number, pos: [number, number, number]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), new THREE.MeshBasicMaterial({ color: new THREE.Color(c, c, c) }));
    m.position.set(...pos);
    env.add(m);
  };
  const day = new THREE.Color(15, 16, 17.5);
  for (const z of [-1.35, -0.2, 0.95]) panel(1.05, 1.9, day, [-3.48, 0.95, z], Math.PI / 2);
  for (const z of [-1.6, 0, 1.6]) panel(1.3, 0.3, new THREE.Color(22, 22, 21), [0, 2.28, z], 0, Math.PI / 2);
  panel(0.9, 1.7, new THREE.Color(11, 10.8, 10.2), [2.1, 0.45, 2.2], -Math.PI * 0.72);
  panel(0.3, 1.6, new THREE.Color(9, 9.2, 9.8), [1.7, 0.45, -2.9], -Math.PI * 0.1);
  panel(0.3, 1.6, new THREE.Color(7, 7.2, 7.6), [-1.9, 0.45, -2.9], Math.PI * 0.1);
  box(5.5, 0.8, 0.6, 0.05, [0, -0.5, -2.6]);
  box(2.6, 0.04, 1.2, 0.045, [0, -0.02, 0.05]);
  box(2.6, 0.9, 0.05, 0.03, [0, -0.47, 0.66]);
  box(1.4, 0.55, 0.35, 0.08, [-1.9, 1.7, -2.75]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(env, 0.02).texture;
  pmrem.dispose();
  env.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry.dispose();
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => m.dispose());
    }
  });
  return texture;
};
