import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { r2SignedUrl } from "@/lib/r2";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
  throw new Error("Supabase 환경변수가 설정되지 않았습니다.");
}

const adminSupabase = createClient(supabaseUrl, serviceRoleKey);
const publicSupabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { modelFilePath, fileUrl } = body as {
      modelFilePath?: string;
      fileUrl?: string;
    };

    // private 버킷 파일은 반드시 인증 필요
    if (modelFilePath) {
      const authHeader = req.headers.get("authorization");
      const token =
        authHeader && authHeader.startsWith("Bearer ")
          ? authHeader.replace("Bearer ", "")
          : null;

      if (!token) {
        return NextResponse.json(
          { error: "인증 정보가 없습니다." },
          { status: 401 }
        );
      }

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

      const viewerUrl = await r2SignedUrl(
        process.env.R2_BUCKET_MODELS_PRIVATE || "models-private",
        modelFilePath,
        60 * 5,
      ).catch((e) => null);

      if (!viewerUrl) {
        return NextResponse.json(
          { error: "private viewer URL 생성 실패", path: modelFilePath },
          { status: 500 }
        );
      }

      return NextResponse.json({ viewerUrl });
    }

    // 공개 URL은 인증 없이 접근 가능
    if (fileUrl) {
      return NextResponse.json({ viewerUrl: fileUrl });
    }

    return NextResponse.json(
      { error: "뷰어용 파일 정보가 없습니다." },
      { status: 400 }
    );
  } catch (error) {
    console.error("viewer URL API 오류:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "서버 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
