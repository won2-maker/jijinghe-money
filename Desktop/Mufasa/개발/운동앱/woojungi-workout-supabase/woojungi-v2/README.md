# 우중이의 Workout Tracker v2 (Supabase 버전)

## 배포 순서 요약
1. Supabase 프로젝트 생성 + DB 설정
2. Google 로그인 설정
3. GitHub에 올리기
4. Vercel 배포 + 환경변수 설정

---

## STEP 1 — Supabase 프로젝트 생성

1. https://supabase.com 접속 → **Start your project** → GitHub으로 가입
2. **New project** 클릭
   - Name: `woojungi-workout`
   - Database Password: 기억할 수 있는 비밀번호 설정
   - Region: **Northeast Asia (Seoul)** 선택
3. 프로젝트 생성 완료까지 약 1~2분 대기

### DB 테이블 만들기
1. 좌측 메뉴 **SQL Editor** 클릭
2. `supabase_schema.sql` 파일 전체 내용 복사 → 에디터에 붙여넣기
3. **Run** 버튼 클릭 → "Success" 확인

### 키 복사
1. 좌측 메뉴 **Project Settings** → **API**
2. 다음 두 값을 메모장에 복사해두기:
   - **Project URL** (예: `https://abcdefgh.supabase.co`)
   - **anon public** key (긴 문자열)

---

## STEP 2 — Google 로그인 설정

### Google Cloud Console
1. https://console.cloud.google.com 접속 → 구글 계정 로그인
2. 상단 프로젝트 선택 → **New Project** → 이름 입력 → Create
3. 좌측 메뉴 **APIs & Services** → **OAuth consent screen**
   - User Type: **External** → Create
   - App name: `Workout Tracker`
   - User support email: 내 이메일
   - 나머지 기본값 → Save and Continue (3번 반복)
4. 좌측 **Credentials** → **+ CREATE CREDENTIALS** → **OAuth client ID**
   - Application type: **Web application**
   - Name: `Workout Tracker`
   - **Authorized redirect URIs** 에 아래 주소 추가:
     ```
     https://[SUPABASE_PROJECT_ID].supabase.co/auth/v1/callback
     ```
     (SUPABASE_PROJECT_ID는 Project URL에서 `https://` 다음 `.supabase.co` 앞 부분)
5. **Create** → **Client ID** 와 **Client Secret** 복사

### Supabase에 Google 연결
1. Supabase → **Authentication** → **Providers** → **Google**
2. Enable 토글 ON
3. Client ID, Client Secret 붙여넣기 → Save

---

## STEP 3 — GitHub에 올리기

Git이 없으면 먼저 설치: https://git-scm.com/downloads

```bash
# 터미널(맥) 또는 명령 프롬프트(윈도우)
cd woojungi-workout      # 압축 푼 폴더로 이동

git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/내아이디/woojungi-workout.git
git push -u origin main
```

> GitHub에서 먼저 빈 repository `woojungi-workout` 만들어야 해요

---

## STEP 4 — Vercel 배포

1. https://vercel.com → **Sign up with GitHub**
2. **Add New Project** → `woojungi-workout` repo 선택
3. Framework: **Vite** 자동 감지
4. **Environment Variables** 섹션에서 아래 두 개 추가:
   ```
   VITE_SUPABASE_URL       = https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY  = eyJhbGci...
   ```
5. **Deploy** 클릭 → 1~2분 후 URL 생성 🎉

### Vercel URL을 Supabase에 등록
배포 완료 후 생성된 URL (예: `https://woojungi-workout.vercel.app`) 을
Supabase에 등록해야 Google 로그인이 작동해요:

1. Supabase → **Authentication** → **URL Configuration**
2. **Site URL**: `https://woojungi-workout.vercel.app`
3. **Redirect URLs** 에 추가: `https://woojungi-workout.vercel.app`
4. Save

Google Cloud Console → Credentials → OAuth Client → **Authorized redirect URIs** 에도
`https://woojungi-workout.vercel.app` 추가

---

## 로컬 개발 (선택사항)

```bash
npm install

# .env 파일 만들기 (.env.example 복사)
cp .env.example .env
# .env 파일을 텍스트 편집기로 열어서 Supabase 키 입력

npm run dev
# http://localhost:5173 에서 확인
```

---

## 기능 목록
- 구글 / 이메일 로그인
- 운동 기록 (부위별, 전체 뷰, 루틴)
- 컨디션 (상/중/하) + 몸무게 기록
- 캘린더 + 데이터 분석
- 친구 피드 + 댓글 + 반응
- 프라이버시 설정 (운동 종목/무게 숨기기)
- 어디서든 같은 데이터 (Supabase 클라우드)
- 운동 중 자동저장 (창 닫아도 이어서 작성)
