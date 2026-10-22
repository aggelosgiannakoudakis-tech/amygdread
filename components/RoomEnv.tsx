      <mesh rotation={[-Math.PI / 2, 0, 0]} position={coarse ? [0, -0.47, -0.3] : [0, -0.47, 1.6]} material={o.floor}><planeGeometry args={coarse ? [3.4, 3.6] : [6.4, 10]} /></mesh>
      {coarse && (
        <group>
          <mesh userData={{ noClip: true }} position={[0, -0.55, -0.3]} material={legMat}><boxGeometry args={[3.2, 0.06, 1.0]} /></mesh>
          {[-1.4, -0.8, -0.2, 0.2, 0.8, 1.4].map((x, i) => (
            <mesh key={`leg${i}`} userData={{ noClip: true }} position={[x, -0.95, -0.3]} material={legMat}><cylinderGeometry args={[0.05, 0.05, 0.8, 10]} /></mesh>
          ))}
          <mesh userData={{ noClip: true }} position={[0, -1.35, -0.3]} material={legMat}><boxGeometry args={[3.0, 0.06, 0.9]} /></mesh>
        </group>
      )}
      {!coarse && (
        <>
          {[[-2.2, -0.8, 0.17], [1.8, -1.4, 0.22], [-0.6, 1.6, 0.14], [2.6, 1, 0.18], [-3.1, 0.9, 0.2], [-1.4, 3.4, 0.16], [1.9, 4.4, 0.2], [-2.4, 5.2, 0.18], [0.6, 6, 0.15]].map(([x, z, r], i) => (<group key={`p${i}`}><mesh position={[x, -3.7, z]} material={o.rust}><cylinderGeometry args={[r, r, 6.4, 14]} /></mesh><mesh position={[x, -1.3, z]} material={o.steel}><cylinderGeometry args={[r * 1.6, r * 1.6, 0.12, 14]} /></mesh><mesh position={[x, -2.9, z]} material={o.steel}><cylinderGeometry args={[r * 1.5, r * 1.5, 0.1, 14]} /></mesh></group>))}
          <mesh position={[0, -2.4, -1]} rotation={[0, 0, Math.PI / 2]} material={o.rust}><cylinderGeometry args={[0.12, 0.12, 6, 12]} /></mesh><mesh position={[1.2, -3.6, 1.5]} rotation={[Math.PI / 2, 0, 0]} material={o.rust}><cylinderGeometry args={[0.12, 0.12, 12, 12]} /></mesh>
          {[-1.8, 1.8].map((x) => <mesh key={x} position={[x, -1.2, 1.5]} material={o.steel}><boxGeometry args={[0.18, 0.5, 12]} /></mesh>)}{[-3, -1, 1, 3, 5, 7].map((z) => <mesh key={z} position={[0, -1.45, z]} material={o.steel}><boxGeometry args={[4.2, 0.25, 0.2]} /></mesh>)}
          <mesh position={[0, -1.6, -0.4]} rotation={[0, 0, Math.PI / 2]} material={o.steel}><cylinderGeometry args={[0.07, 0.07, 3.6, 10]} /></mesh>
          {[-1.7, 1.7].map((x) => (<group key={x} position={[x, -1.6, -0.4]} rotation={[0, Math.PI / 2, 0]}><mesh material={o.rust}><torusGeometry args={[0.9, 0.09, 10, 36]} /></mesh>{Array.from({ length: 8 }, (_, k) => <mesh key={k} rotation={[0, 0, (k / 8) * Math.PI]} material={o.rust}><boxGeometry args={[1.8, 0.05, 0.06]} /></mesh>)}</group>))}
          {o.floorC.map((c, i) => <mesh key={`f${i}`} material={o.cable}><tubeGeometry args={[c, 30, 0.03, 6, false]} /></mesh>)}
          {o.under.map((c, i) => <mesh key={`u${i}`} material={o.cable}><tubeGeometry args={[c, 24, 0.025, 6, false]} /></mesh>)}
          {[[0.39, 0.07], [-0.52, -1.34]].map(([x, z], i) => <mesh key={`r${i}`} position={[x - 1.26, -0.43, z + 0.81]} rotation={[0, -1, 0]} material={o.steel}><boxGeometry args={[0.1, 0.09, 9]} /></mesh>)}
          {Array.from({ length: 11 }, (_, k) => <mesh key={`t${k}`} position={[-0.065 - 0.84 * (k * 0.85 - 2.2), -0.46, -0.635 + 0.54 * (k * 0.85 - 2.2)]} rotation={[0, -1, 0]} material={o.rust}><boxGeometry args={[2.2, 0.06, 0.18]} /></mesh>)}
          {o.cables.map((c, i) => <mesh key={i} material={o.cable}><tubeGeometry args={[c, 24, 0.022, 6, false]} /></mesh>)}
          {[-4.4, -1.4].map((x, i) => <mesh key={i} position={[x, 1.8, -5.5 - i]} material={o.steel}><cylinderGeometry args={[0.3, 0.3, 10, 14]} /></mesh>)}
          <mesh position={[-1.8, 3.9, -5.8]} rotation={[0, 0, Math.PI / 2]} material={o.steel}><cylinderGeometry args={[0.16, 0.16, 5.5, 12]} /></mesh>
        </>
      )}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[1.4, -0.465, 1.3]} material={o.puddle}><circleGeometry args={[0.9, 32]} /></mesh>
      {!coarse && (
        <>
          <mesh position={[0, 3.1, -0.5]} material={o.steel}><coneGeometry args={[0.38, 0.3, 20, 1, true]} /></mesh>
          <mesh position={[0, 2.95, -0.5]} material={o.bulb}><sphereGeometry args={[0.07, 10, 10]} /></mesh>
          {[0, 1, 2].map((k) => <mesh key={k} ref={(m) => { if (m) steam.current[k] = m }} position={[0.1 * k, 1 + k * 0.4, -0.2]}><planeGeometry args={[1, 1]} /><meshBasicMaterial map={o.tex} color="#8a7a6a" opacity={0.1} transparent blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>)}
        </>
      )}
      <mesh position={[-1.6, -0.34, 1.4]} rotation={[0, 0.5, Math.PI / 2]} material={o.rust}><cylinderGeometry args={[0.18, 0.15, 0.3, 16, 1, true]} /></mesh>
      {!coarse && (
        <>
          {[[-1.1, 1.7], [-0.8, 1.9], [0.9, 2.1]].map(([x, z], i) => <mesh key={i} position={[x, -0.41, z]} rotation={[0, 0, i === 1 ? Math.PI / 2 : 0]} material={o.rust}><cylinderGeometry args={[0.06, 0.06, 0.1, 10]} /></mesh>)}
          <mesh position={[1.9, -0.455, 0.2]} rotation={[0, 0.3, 0.05]} material={o.rust}><cylinderGeometry args={[0.3, 0.3, 0.02, 20]} /></mesh>
        </>
      )}
    </group>
  )
}
export function TombEnv() {
  const fog = useRef<THREE.Mesh[]>([])
  const o = useMemo(() => {
    const blade = new THREE.PlaneGeometry(0.025, 0.4, 1, 3); blade.translate(0, 0.2, 0)
    // Use fewer, shorter grass blades on phones and leave a clear foreground lane
    // for the Dear Mother title/status. Desktop grass placement is unchanged.
    const grassCount = coarse ? 360 : 420
    const grass = new THREE.InstancedMesh(blade, new THREE.MeshStandardMaterial({ color: '#3a3320', roughness: 1, side: THREE.DoubleSide }), grassCount), d = new THREE.Object3D()
    for (let i = 0; i < grassCount; i++) {
      const an = coarse ? (i / grassCount) * 6.28 + (rnd(i, 1) - 0.5) * 0.25 : rnd(i, 1) * 6.28
      let x: number, z: number
      if (coarse) {
        // A contained ring around the stone, not a full field of spikes in front.
        const r = 2 + rnd(i, 2) * 9.5
        x = Math.cos(an) * r * 0.9
        z = Math.sin(an) * r * 1.45
      } else {
        const r = 0.9 + rnd(i, 2) * 2.5
        x = Math.cos(an) * r * 0.9
        z = Math.sin(an) * r * 2 + 0.3
      }
      const clearFrontCenter = coarse && z > 1.6 && Math.abs(x) < 2.5
      const height = coarse ? 0.38 + rnd(i, 6) * 0.65 : 0.5 + rnd(i, 6) * 0.9
      d.position.set(x, -0.95 + 0.32 * Math.exp(-(x * x + (z / 2.3) * (z / 2.3)) / 1.8), z)
      d.rotation.set((rnd(i, 3) - 0.5) * 0.7, rnd(i, 4) * 6.28, (rnd(i, 5) - 0.5) * 0.7)
      d.scale.set(clearFrontCenter ? 0 : 1, clearFrontCenter ? 0 : height, clearFrontCenter ? 0 : 1)
      d.updateMatrix()
      grass.setMatrixAt(i, d.matrix)
    }
    grass.instanceMatrix.needsUpdate = true
    const tm = dark('#050605', 0, 1), trees = [[-5, -7], [-3.4, -9], [-1.2, -8], [2.4, -9.5], [4.2, -7.5], [5.6, -10]].map(([x, z], i) => ({ x, z, h: 6 + rnd(i, 9) * 2, br: [0, 1, 2].map((k) => V([[x, 3 + k * 0.6, z], [x + (rnd(i * 3 + k, 7) - 0.5) * 1.4, 4 + k * 0.7, z + 0.1], [x + (rnd(i * 3 + k, 8) - 0.5) * 2.4, 5.2 + k * 0.6, z]])) }))
    const rt = dark('#1b120a', 0, 1), under = Array.from({ length: 9 }, (_, i) => V([[(rnd(i, 31) - 0.5) * 1.8, -0.85, 1.1 + rnd(i, 32) * 0.9], [(rnd(i, 33) - 0.5) * 1.6, -2, 1.1 + rnd(i, 34) * 0.9], [(rnd(i, 35) - 0.5) * 1.8, -3.4, 1 + rnd(i, 36)], [(rnd(i, 37) - 0.5) * 1.6, -5.2, 1.1 + rnd(i, 38) * 0.9]]))
    const pg = new THREE.BufferGeometry(), pa = new Float32Array(260 * 3); for (let i = 0; i < 260; i++) { pa[i * 3] = (rnd(i, 41) - 0.5) * 3; pa[i * 3 + 1] = -1 - rnd(i, 42) * 5; pa[i * 3 + 2] = 0.7 + rnd(i, 43) * 1.8 } pg.setAttribute('position', new THREE.BufferAttribute(pa, 3))
    const st = bake(512, 512, (u, v) => { const band = Math.floor((1 - v) * 8 + fbm(u * 3, v * 3, 9) * 2), cols = [[0.05, 0.035, 0.025], [0.1, 0.07, 0.045], [0.07, 0.06, 0.05], [0.13, 0.09, 0.06], [0.06, 0.05, 0.04], [0.1, 0.08, 0.06], [0.05, 0.04, 0.035], [0.08, 0.06, 0.05]], c = cols[band % 8], n = 0.7 + 0.6 * fbm(u * 30, v * 30, 5), stn = sm(0.74, 0.8, fbm(u * 14, v * 14, 6)); return [c[0] * n + 0.06 * stn, c[1] * n + 0.06 * stn, c[2] * n + 0.055 * stn, 1, 0, 0.5 + (n - 1) * 0.5] })
    const ac = document.createElement('canvas'); ac.width = 8; ac.height = 256; const ax = ac.getContext('2d')!; const ag = ax.createLinearGradient(0, 0, 0, 256); ag.addColorStop(0, '#fff'); ag.addColorStop(0.35, '#bbb'); ag.addColorStop(1, '#000'); ax.fillStyle = ag; ax.fillRect(0, 0, 8, 256)
    const wall = new THREE.CylinderGeometry(3.2, 2.9, 4.6, 64, 14, true), wp = wall.attributes.position; for (let i = 0; i < wp.count; i++) { const x = wp.getX(i), z = wp.getZ(i), y = wp.getY(i), f = 1 + 0.06 * (fbm(Math.atan2(z, x) * 3, y * 0.8, 2) - 0.5); wp.setX(i, x * f); wp.setZ(i, z * f) } wall.computeVertexNormals()
    const wm = new THREE.MeshStandardMaterial({ map: st.map, roughnessMap: st.orm, roughness: 1, bumpMap: st.bump, bumpScale: 3, alphaMap: new THREE.CanvasTexture(ac), transparent: true })
    const R = (y: number) => 3.2 - 0.3 * ((-0.85 - y) / 4.6), onWall = (phi: number, y: number, k = 1) => new THREE.Vector3(R(y) * k * Math.sin(phi) * 0.9, y, 0.3 + R(y) * k * Math.cos(phi) * 2.3)
    const wroots = Array.from({ length: 8 }, (_, i) => { const phi = -1.1 + i * 0.3 + (rnd(i, 51) - 0.5) * 0.1; return V([-1.1, -2, -3, -4].map((y, j) => { const p = onWall(phi + (rnd(i * 4 + j, 52) - 0.5) * 0.12, y - (rnd(i, 53)) * 0.3, 1.02); return [p.x, p.y, p.z] })) })
    const stones = Array.from({ length: 7 }, (_, i) => { const p = onWall(-1.2 + i * 0.4 + rnd(i, 61) * 0.15, -1.4 - rnd(i, 62) * 2.8, 0.985); return { p, s: 0.15 + rnd(i, 63) * 0.15 } })
    const planks = [[-0.4, -2.6], [0.6, -3.5]].map(([phi, y], i) => ({ p: onWall(phi, y, 1.0), r: -phi, t: i }))
    const platform = new THREE.CircleGeometry(coarse ? 16 : 2.2, 64), platformMat = dark('#141009', 0, 1)
    return { grass, tm, trees, tex: soft(), rt, under, pg, wall, wm, wroots, stones, planks, stone: dark('#2a2a28', 0, 1), wood: dark('#1c140d', 0, 1), platform, platformMat }
  }, [])
  useFrame(({ clock }) => { const t = clock.elapsedTime; o.grass.rotation.z = Math.sin(t * 0.4) * 0.002 * (1 + 5 * (H.i === 1 ? 1 : 0)); o.grass.rotation.x = Math.cos(t * 0.33) * 0.0015 * (1 + 5 * (H.i === 1 ? 1 : 0)); fog.current.forEach((m, k) => { if (m) { m.position.x = Math.sin(t * 0.05 + k * 2) * 0.8; m.rotation.z = t * 0.01 * (k + 1) } }) })
  return (
    <group>
      {coarse ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.97, 0]} geometry={o.platform} material={o.platformMat} />
      ) : (
        <>
          <mesh geometry={o.wall} material={o.wm} position={[0, -3.15, 0.3]} scale={[0.9, 1, 2.3]} />
          {o.wroots.map((c, i) => <mesh key={`w${i}`} material={o.rt}><tubeGeometry args={[c, 20, 0.05 + (i % 3) * 0.015, 6, false]} /></mesh>)}
          {o.stones.map((q, i) => <mesh key={`s${i}`} position={q.p} scale={[q.s, q.s * 0.7, q.s * 0.8]} rotation={[i, i * 2, 0]} material={o.stone}><icosahedronGeometry args={[1, 1]} /></mesh>)}
          {o.planks.map((q, i) => <mesh key={`k${i}`} position={q.p} rotation={[0.1 * i, q.r, 0.2 - 0.3 * i]} material={o.wood}><boxGeometry args={[0.6, 0.06, 0.16]} /></mesh>)}
        </>
      )}
      <instancedMesh args={[undefined as any, undefined as any, 420]} ref={() => {}} visible={false} />
      <primitive object={o.grass} />
    </group>
  )
}