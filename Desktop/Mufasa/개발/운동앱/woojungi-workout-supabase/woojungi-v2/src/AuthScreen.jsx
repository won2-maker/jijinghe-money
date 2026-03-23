import { useState } from 'react'
import { supabase } from './lib/supabase'

export default function AuthScreen() {
  const [mode,     setMode]     = useState('login')   // 'login' | 'signup' | 'reset'
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')
  const [loading,  setLoading]  = useState(false)
  const [msg,      setMsg]      = useState(null)       // { type: 'error'|'ok', text }

  const show = (type, text) => setMsg({ type, text })

  /* ── Google ── */
  const handleGoogle = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) { show('error', error.message); setLoading(false) }
  }

  /* ── Email sign up ── */
  const handleSignup = async () => {
    if (!name.trim()) return show('error', '이름을 입력해주세요')
    if (!email.trim()) return show('error', '이메일을 입력해주세요')
    if (password.length < 6) return show('error', '비밀번호는 6자 이상이어야 해요')
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { name: name.trim() } },
    })
    if (error) show('error', error.message)
    else show('ok', '인증 이메일을 보냈어요! 확인 후 로그인해주세요.')
    setLoading(false)
  }

  /* ── Email login ── */
  const handleLogin = async () => {
    if (!email.trim() || !password) return show('error', '이메일과 비밀번호를 입력해주세요')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) show('error', error.message === 'Invalid login credentials'
      ? '이메일 또는 비밀번호가 올바르지 않아요' : error.message)
    setLoading(false)
  }

  /* ── Password reset ── */
  const handleReset = async () => {
    if (!email.trim()) return show('error', '이메일을 입력해주세요')
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })
    if (error) show('error', error.message)
    else show('ok', '비밀번호 재설정 링크를 이메일로 보냈어요!')
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0A0A0F',
      fontFamily: "'DM Mono','Courier New',monospace",
      color: '#E8E8E0', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Space+Grotesk:wght@400;600;700&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        input { outline:none; }
        .btn { cursor:pointer; border:none; transition:all 0.15s; }
        .btn:active { transform:scale(0.97); }
        .inp {
          width:100%; background:#1A1A24; border:1px solid #2A2A38;
          color:#E8E8E0; font-family:'DM Mono',monospace; font-size:14px;
          padding:12px 16px; border-radius:10px;
        }
        .inp:focus { border-color:#FF4D6D; outline:none; }
      `}</style>

      <div style={{ width: '100%', maxWidth: 380 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 42, marginBottom: 8 }}>💪</div>
          <div style={{ fontSize: 10, letterSpacing: '0.2em', color: '#444', marginBottom: 4 }}>WORKOUT TRACKER</div>
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 22, fontWeight: 700 }}>
            우중이의 <span style={{ color: '#FF4D6D' }}>운동기록</span>
          </div>
        </div>

        <div style={{ background: '#111118', border: '1px solid #1E1E2A', borderRadius: 18, padding: '28px 24px' }}>

          {/* Tab */}
          {mode !== 'reset' && (
            <div style={{ display: 'flex', gap: 0, marginBottom: 24, background: '#0A0A0F', borderRadius: 10, padding: 3 }}>
              {[['login','로그인'], ['signup','회원가입']].map(([m, label]) => (
                <button key={m} className="btn" onClick={() => { setMode(m); setMsg(null) }}
                  style={{ flex: 1, padding: '9px', borderRadius: 8, fontSize: 13,
                    fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700,
                    background: mode === m ? '#FF4D6D' : 'transparent',
                    color: mode === m ? '#0A0A0F' : '#555',
                  }}>{label}</button>
              ))}
            </div>
          )}

          {mode === 'reset' && (
            <div style={{ marginBottom: 20 }}>
              <button className="btn" onClick={() => { setMode('login'); setMsg(null) }}
                style={{ background: '#1A1A24', color: '#888', borderRadius: 8, width: 32, height: 32, fontSize: 15 }}>←</button>
              <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 700, marginTop: 12 }}>비밀번호 재설정</div>
            </div>
          )}

          {/* Google button */}
          {mode !== 'reset' && (
            <>
              <button className="btn" onClick={handleGoogle} disabled={loading}
                style={{
                  width: '100%', padding: '12px', borderRadius: 10, fontSize: 14,
                  fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700,
                  background: '#fff', color: '#1a1a1a',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  marginBottom: 16,
                }}>
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.909-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
                </svg>
                Google로 {mode === 'login' ? '로그인' : '시작하기'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ flex: 1, height: 1, background: '#1E1E2A' }}/>
                <span style={{ fontSize: 11, color: '#444' }}>또는</span>
                <div style={{ flex: 1, height: 1, background: '#1E1E2A' }}/>
              </div>
            </>
          )}

          {/* Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {mode === 'signup' && (
              <input className="inp" placeholder="이름 (닉네임)"
                value={name} onChange={e => setName(e.target.value)}/>
            )}
            <input className="inp" type="email" placeholder="이메일"
              value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (mode === 'reset' ? handleReset() : mode === 'login' ? handleLogin() : null)}/>
            {mode !== 'reset' && (
              <input className="inp" type="password" placeholder="비밀번호 (6자 이상)"
                value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (mode === 'login' ? handleLogin() : handleSignup())}/>
            )}
          </div>

          {/* Error / OK message */}
          {msg && (
            <div style={{
              marginTop: 12, padding: '10px 14px', borderRadius: 8, fontSize: 12,
              background: msg.type === 'error' ? '#3A1A1A' : '#1A3A2A',
              color: msg.type === 'error' ? '#FF6B6B' : '#4ECDC4',
              border: `1px solid ${msg.type === 'error' ? '#FF6B6B30' : '#4ECDC430'}`,
              lineHeight: 1.5,
            }}>{msg.text}</div>
          )}

          {/* Submit */}
          <button className="btn" onClick={mode === 'reset' ? handleReset : mode === 'login' ? handleLogin : handleSignup}
            disabled={loading}
            style={{
              width: '100%', marginTop: 16, padding: '13px',
              borderRadius: 10, fontSize: 14,
              fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700,
              background: loading ? '#333' : '#FF4D6D', color: '#0A0A0F',
            }}>
            {loading ? '처리 중...' : mode === 'reset' ? '재설정 링크 보내기' : mode === 'login' ? '로그인' : '가입하기'}
          </button>

          {/* Reset password link */}
          {mode === 'login' && (
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <button className="btn" onClick={() => { setMode('reset'); setMsg(null) }}
                style={{ fontSize: 12, color: '#555', background: 'none' }}>
                비밀번호를 잊으셨나요?
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
