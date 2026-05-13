'use client'

import { useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase-browser'

function AuthCallbackContent() {
  const router = useRouter()

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const email = user.email ?? null
        const rawNickname =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.user_metadata?.user_name ||
          null

        // 기존 nickname이 있으면 유지, 없으면 OAuth 메타데이터 값 사용
        const { data: existing } = await supabase
          .from('profiles')
          .select('nickname')
          .eq('id', user.id)
          .single()

        const nickname = existing?.nickname ?? rawNickname

        await supabase.from('profiles').upsert(
          { id: user.id, email, nickname },
          { onConflict: 'id' }
        )
      }

      router.replace('/')
    })()
  }, [])

  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh'}}>
      로그인 처리 중...
    </div>
  )
}

export default function AuthCallback() {
  return (
    <Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh'}}>로딩 중...</div>}>
      <AuthCallbackContent />
    </Suspense>
  )
}
