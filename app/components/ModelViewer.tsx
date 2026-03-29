"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  Bounds,
  Environment,
  useBounds,
} from "@react-three/drei";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

type Props = {
  url: string;
};

type SceneProps = {
  url: string;
  ext: string;
  controlsRef: React.MutableRefObject<any>;
};

function STLModel({ url, controlsRef }: { url: string; controlsRef: React.MutableRefObject<any> }) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const bounds = useBounds();

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
      (error) => { console.error("STL 로드 실패:", error); }
    );
    return () => { active = false; };
  }, [url]);

  useEffect(() => {
    if (!geometry || !meshRef.current) return;
    const mesh = meshRef.current;
    requestAnimationFrame(() => {
      const box = new THREE.Box3().setFromObject(mesh);
      const center = box.getCenter(new THREE.Vector3());
      if (controlsRef.current) {
        controlsRef.current.target.copy(center);
        controlsRef.current.update();
      }
      bounds.refresh(mesh).fit();
    });
  }, [geometry]);

  if (!geometry) return null;

  return (
    <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color="#bcc2c9" metalness={0.18} roughness={0.62} />
    </mesh>
  );
}

function OBJModel({ url, controlsRef }: { url: string; controlsRef: React.MutableRefObject<any> }) {
  const [object, setObject] = useState<THREE.Group | null>(null);
  const groupRef = useRef<THREE.Group>(null);
  const bounds = useBounds();

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
              color: "#bcc2c9", metalness: 0.18, roughness: 0.62,
            });
          }
        });
        const box = new THREE.Box3().setFromObject(loaded);
        const center = box.getCenter(new THREE.Vector3());
        loaded.position.sub(center);
        setObject(loaded);
      },
      undefined,
      (error) => { console.error("OBJ 로드 실패:", error); }
    );
    return () => { active = false; };
  }, [url]);

  useEffect(() => {
    if (!object || !groupRef.current) return;
    const group = groupRef.current;
    requestAnimationFrame(() => {
      const box = new THREE.Box3().setFromObject(group);
      const center = box.getCenter(new THREE.Vector3());
      if (controlsRef.current) {
        controlsRef.current.target.copy(center);
        controlsRef.current.update();
      }
      bounds.refresh(group).fit();
    });
  }, [object]);

  if (!object) return null;

  return <primitive ref={groupRef} object={object} />;
}

function Scene({ url, ext, controlsRef }: SceneProps) {
  if (ext === "stl") return <STLModel url={url} controlsRef={controlsRef} />;
  if (ext === "obj") return <OBJModel url={url} controlsRef={controlsRef} />;
  return null;
}

function CameraReset({ resetSignal, controlsRef }: { resetSignal: number; controlsRef: React.MutableRefObject<any> }) {
  const bounds = useBounds();

  useEffect(() => {
    if (resetSignal > 0) {
      requestAnimationFrame(() => {
        bounds.refresh().fit();
      });
    }
  }, [resetSignal]);

  return null;
}

export default function ModelViewer({ url }: Props) {
  const controlsRef = useRef<any>(null);
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
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
      }}
    >
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
        camera={{ position: [-5, 10, 3], fov: 40 }}
        dpr={1}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        shadows
      >
        <color attach="background" args={["#1b1c1f"]} />

        <ambientLight intensity={0.9} />

        <directionalLight
          position={[6, 8, 6]}
          intensity={1.6}
          castShadow
        />

        <directionalLight position={[-5, 4, -4]} intensity={0.7} />
        <directionalLight position={[0, -3, 5]} intensity={0.45} />

        <hemisphereLight intensity={0.55} groundColor="#2a2c31" />

        <Suspense fallback={null}>
          <Bounds fit clip observe margin={2.0}>
            <Scene url={url} ext={ext} controlsRef={controlsRef} />
          </Bounds>
          <Environment preset="studio" />
        </Suspense>

        <CameraReset resetSignal={resetSignal} controlsRef={controlsRef} />

        <OrbitControls
          ref={controlsRef}
          makeDefault
          enablePan={false}
          minDistance={1.2}
          maxDistance={20}
          autoRotate={autoRotate}
          autoRotateSpeed={0.8}
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