import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const { createServerClient } = await import("@supabase/ssr");
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // profiles upsert - OAuth 사용자 프로필 자동 생성
      const user = data.user;
      const nickname =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.user_metadata?.nickname ||
        user.email?.split("@")[0] ||
        "사용자";

      await adminSupabase.from("profiles").upsert(
        { id: user.id, nickname },
        { onConflict: "id", ignoreDuplicates: true }
      );

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth?error=oauth`);
}
