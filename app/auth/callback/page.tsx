'use client'

import { useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'

function AuthCallbackContent() {
  const router = useRouter()

  useEffect(() => {
    const timeout = setTimeout(() => {
      router.replace('/')
    }, 500)

    return () => clearTimeout(timeout)
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
