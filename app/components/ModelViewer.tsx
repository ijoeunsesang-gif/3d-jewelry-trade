"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { TrackballControls, Environment } from "@react-three/drei";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

type Props = { url: string };

type ModelProps = {
  url: string;
  controlsRef: React.MutableRefObject<any>;
  onFitted: (pos: THREE.Vector3) => void;
};

/** 모델 중심을 origin으로 맞추고 카메라를 bounding sphere 기반으로 배치 */
function fitCameraToRadius(
  camera: THREE.PerspectiveCamera,
  controls: any,
  radius: number
) {
  const fov = (camera.fov * Math.PI) / 180;
  const distance = (radius / Math.sin(fov / 2)) * 1.25;

  const dir = new THREE.Vector3(0.6, 0.5, 0.8).normalize();
  camera.position.copy(dir.multiplyScalar(distance));
  camera.up.set(0, 1, 0);
  camera.lookAt(0, 0, 0);
  camera.near = distance * 0.01;
  camera.far = distance * 100;
  camera.updateProjectionMatrix();

  controls.target.set(0, 0, 0);
  controls.minDistance = radius * 0.3;
  controls.maxDistance = radius * 30;
  controls.update();
}

function STLModel({ url, controlsRef, onFitted }: ModelProps) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const { camera } = useThree();

  useEffect(() => {
    let active = true;
    const loader = new STLLoader();
    loader.load(
      url,
      (loaded) => {
        if (!active) return;
        loaded.computeVertexNormals();
        loaded.center();
        setGeometry(loaded);
      },
      undefined,
      (error) => console.error("STL 로드 실패:", error)
    );
    return () => { active = false; };
  }, [url]);

  useEffect(() => {
    if (!geometry || !controlsRef.current) return;
    geometry.computeBoundingSphere();
    const radius = geometry.boundingSphere?.radius ?? 5;
    fitCameraToRadius(camera as THREE.PerspectiveCamera, controlsRef.current, radius);
    onFitted(camera.position.clone());
  }, [geometry]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color="#bcc2c9" metalness={0.18} roughness={0.62} />
    </mesh>
  );
}

function OBJModel({ url, controlsRef, onFitted }: ModelProps) {
  const [object, setObject] = useState<THREE.Group | null>(null);
  const { camera } = useThree();

  useEffect(() => {
    let active = true;
    const loader = new OBJLoader();
    loader.load(
      url,
      (loaded) => {
        if (!active) return;
        loaded.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.material = new THREE.MeshStandardMaterial({
              color: "#bcc2c9",
              metalness: 0.18,
              roughness: 0.62,
            });
          }
        });
        const box = new THREE.Box3().setFromObject(loaded);
        const center = box.getCenter(new THREE.Vector3());
        loaded.position.sub(center);
        setObject(loaded);
      },
      undefined,
      (error) => console.error("OBJ 로드 실패:", error)
    );
    return () => { active = false; };
  }, [url]);

  useEffect(() => {
    if (!object || !controlsRef.current) return;
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const radius = size.length() / 2;
    fitCameraToRadius(camera as THREE.PerspectiveCamera, controlsRef.current, radius);
    onFitted(camera.position.clone());
  }, [object]);

  if (!object) return null;

  return <primitive object={object} />;
}

// 자동회전: TrackballControls에는 autoRotate prop이 없으므로
// 쿼터니언으로 카메라를 Y축 기준으로 직접 회전시킴
const _rotAxis = new THREE.Vector3(0, 1, 0);
const _rotQuat = new THREE.Quaternion();

function AutoRotate({
  enabled,
  controlsRef,
}: {
  enabled: boolean;
  controlsRef: React.MutableRefObject<any>;
}) {
  const { camera } = useThree();

  useFrame((_, delta) => {
    if (!enabled || !controlsRef.current) return;
    const target = controlsRef.current.target as THREE.Vector3;
    const angle = 0.5 * delta; // ~0.5 rad/s

    _rotQuat.setFromAxisAngle(_rotAxis, angle);

    // 카메라 위치를 target 중심으로 Y축 회전
    const offset = camera.position.clone().sub(target);
    offset.applyQuaternion(_rotQuat);
    camera.position.copy(target).add(offset);

    // 카메라 방향도 함께 회전
    camera.quaternion.premultiply(_rotQuat);
  });

  return null;
}

function CameraReset({
  resetSignal,
  controlsRef,
  savedPosRef,
}: {
  resetSignal: number;
  controlsRef: React.MutableRefObject<any>;
  savedPosRef: React.MutableRefObject<THREE.Vector3 | null>;
}) {
  const { camera } = useThree();

  useEffect(() => {
    if (resetSignal === 0) return;
    if (!controlsRef.current || !savedPosRef.current) return;
    camera.position.copy(savedPosRef.current);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
  }, [resetSignal]);

  return null;
}

export default function ModelViewer({ url }: Props) {
  const controlsRef = useRef<any>(null);
  const savedPosRef = useRef<THREE.Vector3 | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [resetSignal, setResetSignal] = useState(0);

  const ext = useMemo(() => {
    const clean = url.split("?")[0];
    return clean.split(".").pop()?.toLowerCase() || "";
  }, [url]);

  const supported = ["stl", "obj"].includes(ext);

  if (!supported) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontWeight: 800,
          fontSize: 16,
          textAlign: "center",
          padding: 24,
          lineHeight: 1.7,
          background: "#1b1c1f",
        }}
      >
        이 파일 형식은 브라우저 3D 미리보기를 지원하지 않습니다.
        <br />
        다운로드 후 전용 프로그램에서 확인해주세요.
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 20,
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          justifyContent: "flex-end",
          maxWidth: "calc(100% - 32px)",
        }}
      >
        <button
          type="button"
          onClick={() => setAutoRotate((v) => !v)}
          style={getPrettyToggleButtonStyle(autoRotate)}
        >
          <span style={dotStyle(autoRotate)} />
          {autoRotate ? "자동회전 ON" : "자동회전 OFF"}
        </button>

        <button
          type="button"
          onClick={() => setResetSignal((v) => v + 1)}
          style={prettyResetButtonStyle}
        >
          뷰 초기화
        </button>
      </div>

      <Canvas
        camera={{ position: [0, 0, 10], fov: 40 }}
        dpr={1}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        shadows
      >
        <color attach="background" args={["#1b1c1f"]} />

        <ambientLight intensity={0.9} />
        <directionalLight position={[6, 8, 6]} intensity={1.6} castShadow />
        <directionalLight position={[-5, 4, -4]} intensity={0.7} />
        <directionalLight position={[0, -3, 5]} intensity={0.45} />
        <hemisphereLight intensity={0.55} groundColor="#2a2c31" />

        <Suspense fallback={null}>
          {ext === "stl" && (
            <STLModel
              url={url}
              controlsRef={controlsRef}
              onFitted={(pos) => { savedPosRef.current = pos; }}
            />
          )}
          {ext === "obj" && (
            <OBJModel
              url={url}
              controlsRef={controlsRef}
              onFitted={(pos) => { savedPosRef.current = pos; }}
            />
          )}
          <Environment preset="studio" />
        </Suspense>

        <AutoRotate enabled={autoRotate} controlsRef={controlsRef} />

        <CameraReset
          resetSignal={resetSignal}
          controlsRef={controlsRef}
          savedPosRef={savedPosRef}
        />

        {/* TrackballControls: 쿼터니언 기반 회전 — 상하좌우 360도 짐벌락 없음 */}
        <TrackballControls
          ref={controlsRef}
          makeDefault
          rotateSpeed={2.5}
          zoomSpeed={1.2}
          panSpeed={0.6}
          noPan={false}
          staticMoving={false}
          dynamicDampingFactor={0.15}
        />
      </Canvas>
    </div>
  );
}

function getPrettyToggleButtonStyle(active: boolean): React.CSSProperties {
  return {
    height: 52,
    padding: "0 18px",
    borderRadius: 999,
    border: active
      ? "1px solid rgba(34,197,94,0.95)"
      : "1px solid rgba(255,255,255,0.14)",
    background: active
      ? "linear-gradient(180deg, #22c55e 0%, #16a34a 100%)"
      : "rgba(15, 23, 42, 0.72)",
    color: "white",
    fontSize: 16,
    fontWeight: 800,
    cursor: "pointer",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    whiteSpace: "nowrap",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    boxShadow: active
      ? "0 8px 20px rgba(34,197,94,0.28), inset 0 1px 0 rgba(255,255,255,0.18)"
      : "0 8px 20px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.05)",
    transition: "all 0.18s ease",
  };
}

const prettyResetButtonStyle: React.CSSProperties = {
  height: 52,
  padding: "0 18px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(30, 41, 59, 0.82)",
  color: "white",
  fontSize: 16,
  fontWeight: 800,
  cursor: "pointer",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  whiteSpace: "nowrap",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow:
    "0 8px 20px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.06)",
  transition: "all 0.18s ease",
};

function dotStyle(active: boolean): React.CSSProperties {
  return {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: active ? "white" : "rgba(255,255,255,0.72)",
    boxShadow: active ? "0 0 10px rgba(255,255,255,0.75)" : "none",
    flexShrink: 0,
  };
}
