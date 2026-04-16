'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase-browser'

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/'

    if (!code) {
      router.replace('/')
      return
    }

    const timeout = setTimeout(() => {
      router.replace('/')
    }, 10000)

    supabase.auth.exchangeCodeForSession(code)
      .then(({ error }) => {
        clearTimeout(timeout)
        if (error) {
          console.error('Auth error:', error.message)
          console.error('PKCE error:', error.message)
        }
        router.replace(next)
      })
      .catch(() => {
        clearTimeout(timeout)
        router.replace('/')
      })
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
