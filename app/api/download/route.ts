import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { r2SignedUrl } from "@/lib/r2";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const adminSupabase = createClient(supabaseUrl, serviceRoleKey);
const publicSupabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { modelId } = body as {
      modelId?: string;
    };

    if (!modelId) {
      return NextResponse.json(
        { error: "modelId가 필요합니다." },
        { status: 400 }
      );
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "인증 정보가 없습니다." },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error: userError,
    } = await publicSupabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: "유효하지 않은 사용자입니다." },
        { status: 401 }
      );
    }

    const { data: purchase, error: purchaseError } = await adminSupabase
      .from("purchases")
      .select("id, created_at")
      .eq("user_id", user.id)
      .eq("model_id", modelId)
      .maybeSingle();

    if (purchaseError) {
      return NextResponse.json(
        { error: "구매 여부 확인 실패" },
        { status: 500 }
      );
    }

    if (!purchase) {
      return NextResponse.json(
        { error: "구매한 사용자만 다운로드할 수 있습니다." },
        { status: 403 }
      );
    }

    const DOWNLOAD_PERIOD_DAYS = 180;
    const purchasedAt = new Date(purchase.created_at);
    const expiresAt = new Date(purchasedAt.getTime() + DOWNLOAD_PERIOD_DAYS * 24 * 60 * 60 * 1000);
    if (new Date() > expiresAt) {
      return NextResponse.json(
        { error: "다운로드 기한이 만료되었습니다. (구매일로부터 6개월)" },
        { status: 403 }
      );
    }

    const { data: model, error: modelError } = await adminSupabase
      .from("models")
      .select("model_file_path, download_count")
      .eq("id", modelId)
      .single();

    if (modelError || !model?.model_file_path) {
      return NextResponse.json(
        { error: "모델 파일 경로를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const signedUrl = await r2SignedUrl(
      process.env.R2_BUCKET_MODELS_PRIVATE || "models-private",
      model.model_file_path,
      60 * 3,
    ).catch(() => null);

    if (!signedUrl) {
      return NextResponse.json({ error: "signed URL 생성 실패" }, { status: 500 });
    }

    await adminSupabase
      .from("models")
      .update({ download_count: (model.download_count || 0) + 1 })
      .eq("id", modelId);

    return NextResponse.json({ signedUrl });
        
  } catch (error) {
    console.error("다운로드 API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}