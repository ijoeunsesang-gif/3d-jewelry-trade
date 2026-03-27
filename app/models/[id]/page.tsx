"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import ModelDetailClient from "./ModelDetailClient";

type ModelItem = {
  id: string;
  title: string;
  description: string;
  price: number;
  thumbnail: string;
  file_url: string;
  seller_id: string;
  category: string;
  created_at: string;
};

export default function ModelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [model, setModel] = useState<ModelItem | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function fetchModel() {
      const { id } = await params;

      const { data, error } = await supabase
        .from("models")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("모델 상세 불러오기 실패:", error);
        setLoaded(true);
        return;
      }

      setModel(data);
      setLoaded(true);
    }

    fetchModel();
  }, [params]);

  if (!loaded) {
    return (
      <main style={{ maxWidth: 900, margin: "60px auto", padding: "0 20px" }}>
        <p>모델 정보를 불러오는 중...</p>
      </main>
    );
  }

  if (!model) {
    return (
      <main style={{ maxWidth: 900, margin: "60px auto", padding: "0 20px" }}>
        <p>모델을 찾을 수 없습니다.</p>
      </main>
    );
  }

  return <ModelDetailClient model={model} />;
}