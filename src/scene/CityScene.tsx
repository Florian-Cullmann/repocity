import {
  Component,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  Object3D,
  OrthographicCamera,
  Vector3,
} from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { CityLayout } from '../city/types'
import type { Instance, Shape } from './primitives'
import { compileCity } from './compileCity'
import { cameraZoom } from './camera'

export interface CameraAction {
  type: 'reset' | 'in' | 'out' | 'rotate'
  sequence: number
}
interface Props {
  city: CityLayout
  selectedId: string | null
  onSelect: (id: string | null) => void
  cameraAction: CameraAction
  focusDistrict: string | null
  onReady?: () => void
}

const noRaycast = () => undefined

function Batch({
  shape,
  instances,
  focusDistrict,
  buildingDistricts,
}: {
  shape: Shape
  instances: Instance[]
  focusDistrict: string | null
  buildingDistricts: Map<string, string>
}) {
  const ref = useRef<InstancedMesh>(null)
  const invalidate = useThree((state) => state.invalidate)
  const geometry = useMemo(() => {
    switch (shape) {
      case 'box':
        return new BoxGeometry(1, 1, 1)
      case 'cylinder':
        return new CylinderGeometry(0.5, 0.5, 1, 8)
      case 'cone':
        return new ConeGeometry(0.5, 1, 6)
      case 'roof':
        return new ConeGeometry(0.5, 1, 4)
      case 'leaf':
        return new IcosahedronGeometry(0.65, 0)
    }
  }, [shape])
  useEffect(() => () => geometry.dispose(), [geometry])
  useLayoutEffect(() => {
    const mesh = ref.current!
    const object = new Object3D()
    const color = new Color()
    const muted = new Color('#cbd3c5')
    instances.forEach((instance, index) => {
      object.position.set(...instance.position)
      object.scale.set(...instance.scale)
      object.rotation.set(...(instance.rotation ?? [0, 0, 0]))
      object.updateMatrix()
      if (instance.shear) object.matrix.elements[8] += instance.shear * instance.scale[2]
      mesh.setMatrixAt(index, object.matrix)
      color.set(instance.color)
      if (
        focusDistrict &&
        instance.buildingId &&
        buildingDistricts.get(instance.buildingId) !== focusDistrict
      )
        color.lerp(muted, 0.78)
      mesh.setColorAt(index, color)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
    invalidate()
  }, [instances, invalidate, focusDistrict, buildingDistricts])
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, undefined, instances.length]}
      castShadow
      receiveShadow
      raycast={noRaycast}
    >
      <meshStandardMaterial roughness={0.88} metalness={0} flatShading />
    </instancedMesh>
  )
}

/** One lightweight picking volume per building, rather than raycasting every window. */
function BuildingPicking({
  city,
  onSelect,
  onHover,
}: {
  city: CityLayout
  onSelect: Props['onSelect']
  onHover: (id: string | null) => void
}) {
  const ref = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const object = new Object3D()
    city.buildings.forEach((building, index) => {
      const height = building.height + 2.8
      object.position.set(
        building.position[0],
        building.position[1] + height / 2,
        building.position[2],
      )
      object.scale.set(building.width + 0.6, height, building.depth + 0.6)
      object.rotation.set(0, building.rotation, 0)
      object.updateMatrix()
      ref.current!.setMatrixAt(index, object.matrix)
    })
    ref.current!.instanceMatrix.needsUpdate = true
    ref.current!.computeBoundingSphere()
  }, [city])
  const id = (event: ThreeEvent<PointerEvent | MouseEvent>) =>
    event.instanceId === undefined ? null : city.buildings[event.instanceId].id
  return (
    <instancedMesh
      key={city.buildings.length}
      ref={ref}
      args={[undefined, undefined, city.buildings.length]}
      onClick={(event) => {
        event.stopPropagation()
        if (event.delta <= 5) onSelect(id(event))
      }}
      onPointerMove={(event) => {
        event.stopPropagation()
        onHover(id(event))
      }}
      onPointerOut={() => onHover(null)}
    >
      <boxGeometry />
      <meshBasicMaterial colorWrite={false} depthWrite={false} />
    </instancedMesh>
  )
}

function CameraRig({ size, action }: { size: number; action: CameraAction }) {
  const controls = useRef<OrbitControlsImpl>(null)
  const { camera, size: viewport, invalidate, gl } = useThree()
  const {
    overview: baseZoom,
    far,
    min: minZoom,
    max: maxZoom,
  } = cameraZoom(viewport.width, viewport.height, size)
  const reportZoom = useCallback(() => {
    gl.domElement.dataset.far = String((camera as OrthographicCamera).far)
    gl.domElement.dataset.zoom = ((camera as OrthographicCamera).zoom / baseZoom).toFixed(2)
  }, [camera, gl, baseZoom])
  useEffect(() => {
    const ortho = camera as OrthographicCamera
    ortho.position.set(size * 0.85, size * 1.15, size)
    ortho.zoom = baseZoom
    ortho.far = far
    ortho.lookAt(0, 1, 0)
    ortho.updateProjectionMatrix()
    controls.current?.target.set(0, 1, 0)
    controls.current?.update()
    reportZoom()
    invalidate()
  }, [camera, size, baseZoom, far, invalidate, reportZoom])
  useEffect(() => {
    const ortho = camera as OrthographicCamera
    if (action.type === 'reset') {
      ortho.position.set(size * 0.85, size * 1.15, size)
      ortho.zoom = baseZoom
      controls.current?.target.set(0, 1, 0)
    } else if (action.type === 'rotate') {
      const target = controls.current?.target ?? new Vector3()
      ortho.position
        .sub(target)
        .applyAxisAngle(new Vector3(0, 1, 0), Math.PI / 4)
        .add(target)
    } else {
      ortho.zoom = Math.max(
        minZoom,
        Math.min(maxZoom, ortho.zoom * (action.type === 'in' ? 1.35 : 1 / 1.35)),
      )
    }
    ortho.updateProjectionMatrix()
    controls.current?.update()
    reportZoom()
    invalidate()
    // Actions are commands; viewport and city changes are handled separately above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action])
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.12}
      minZoom={minZoom}
      maxZoom={maxZoom}
      zoomToCursor
      onChange={reportZoom}
      minPolarAngle={0.12}
      maxPolarAngle={Math.PI / 2.15}
      screenSpacePanning
      target={[0, 1, 0]}
    />
  )
}

function SceneContent({ city, selectedId, onSelect, cameraAction, focusDistrict, onReady }: Props) {
  const geometry = useMemo(() => compileCity(city), [city])
  const buildingDistricts = useMemo(
    () => new Map(city.buildings.map((b) => [b.id, b.districtId])),
    [city],
  )
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const active = city.buildings.find((building) => building.id === (selectedId ?? hoveredId))
  const { gl } = useThree()
  useEffect(() => {
    gl.domElement.style.cursor = hoveredId ? 'pointer' : 'grab'
    return () => {
      gl.domElement.style.cursor = ''
    }
  }, [hoveredId, gl])
  useEffect(() => {
    onReady?.()
  }, [onReady])
  return (
    <>
      <ambientLight intensity={0.7} />
      <hemisphereLight args={['#fff7e0', '#71877a', 1.3]} />
      <directionalLight
        position={[-city.size * 0.5, Math.max(70, city.size * 0.9), city.size * 0.4]}
        intensity={2.7}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-city.size * 0.8}
        shadow-camera-right={city.size * 0.8}
        shadow-camera-top={city.size * 0.8}
        shadow-camera-bottom={-city.size * 0.8}
        shadow-camera-far={city.size * 4 + 200}
        shadow-normalBias={0.16}
        shadow-bias={-0.0002}
      />
      <CameraRig size={city.size} action={cameraAction} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.1, 0]} receiveShadow>
        <planeGeometry args={[3000, 3000]} />
        <meshStandardMaterial color="#e6ebdf" roughness={1} />
      </mesh>
      {(Object.keys(geometry) as Shape[]).map((shape) => (
        <Batch
          key={`${shape}:${geometry[shape].length}`}
          shape={shape}
          instances={geometry[shape]}
          focusDistrict={focusDistrict}
          buildingDistricts={buildingDistricts}
        />
      ))}
      {city.buildings.length > 0 && (
        <BuildingPicking city={city} onSelect={onSelect} onHover={setHoveredId} />
      )}
      {active && (
        <group
          position={[active.position[0], 0.56, active.position[2]]}
          rotation={[0, active.rotation, 0]}
        >
          {[-1, 1].map((sign) => (
            <group key={sign}>
              <mesh position={[sign * (active.width / 2 + 0.28), 0, 0]}>
                <boxGeometry args={[0.14, 0.12, active.depth + 0.7]} />
                <meshBasicMaterial color="#f2ff94" />
              </mesh>
              <mesh position={[0, 0, sign * (active.depth / 2 + 0.28)]}>
                <boxGeometry args={[active.width + 0.7, 0.12, 0.14]} />
                <meshBasicMaterial color="#f2ff94" />
              </mesh>
            </group>
          ))}
          <mesh position={[0, active.height + 2.9, 0]} rotation={[0, 0, Math.PI]}>
            <coneGeometry args={[0.55, 0.9, 4]} />
            <meshBasicMaterial color="#2d674b" />
          </mesh>
        </group>
      )}
    </>
  )
}

class SceneErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false }
  static getDerivedStateFromError() {
    return { error: true }
  }
  render() {
    return this.state.error ? (
      <div className="scene-error">
        <strong>The 3D view could not start.</strong>
        <p>
          Enable WebGL or hardware acceleration in your browser. You can still explore modules from
          the sidebar.
        </p>
        <button onClick={() => window.location.reload()}>Try again</button>
      </div>
    ) : (
      this.props.children
    )
  }
}

export default function CityScene(props: Props) {
  return (
    <SceneErrorBoundary>
      <Canvas
        orthographic
        shadows
        frameloop="demand"
        dpr={[1, 1.75]}
        camera={{
          position: [100, 95, 120],
          near: 0.1,
          far: Math.max(2000, props.city.size * 5),
          zoom: 7,
        }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        onPointerMissed={(event) => {
          if (event.type === 'click') props.onSelect(null)
        }}
        fallback={
          <div className="scene-error">
            WebGL is unavailable. You can select modules from the sidebar.
          </div>
        }
      >
        <SceneContent {...props} />
      </Canvas>
    </SceneErrorBoundary>
  )
}
