# DING Server

NestJS + Prisma 기반 DING API 서버입니다.

## 실행

```bash
npm install
npm run prisma:generate
npx prisma db push
npm start
```

기본 주소:
- `http://localhost:3000`

## 환경 변수

예시:

```env
DATABASE_URL="postgresql://ding:ding@localhost:5432/ding?schema=public"
JWT_SECRET="ding-dev-secret"
REDIS_URL=""
PUSH_WEBHOOK_URL=""
```

## 주요 API

### Auth
- `POST /auth/signup`
- `POST /auth/login`
- `GET /auth/bootstrap`
- `PATCH /auth/preference`

### Profile
- `GET /profile/me`
- `PATCH /profile/me`
- `POST /profile/me/device-tokens`

### Runs
- `GET /runs/dashboard`
- `GET /runs/activity`
- `GET /runs/activity/page?page=1&pageSize=20`
- `POST /runs/finish`

### Ding
- `GET /ding/summary`
- `POST /ding/send`

### Chat
- `GET /chat/threads`
- `GET /chat/threads/page?page=1&pageSize=20`
- `GET /chat/threads/:id/messages/page?page=1&pageSize=20`
- `PUT /chat/threads/:id`
- `POST /chat/threads/:id/messages`
- `PATCH /chat/threads/:id/read`

## 예시 흐름

### 1. 회원가입
```bash
curl -X POST http://localhost:3000/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"alex@ding.run","password":"1234","username":"alex"}'
```

### 2. 토큰 사용
```bash
curl http://localhost:3000/profile/me \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

### 3. 디바이스 토큰 등록
```bash
curl -X POST http://localhost:3000/profile/me/device-tokens \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{"token":"device-token-1","platform":"ios"}'
```

## Push 동작
- `REDIS_URL`이 있으면 BullMQ worker 사용
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`가 있으면 **FCM 전송 우선 사용**
- FCM 설정이 없고 `PUSH_WEBHOOK_URL`이 있으면 webhook으로 push 전달
- 둘 다 없으면 simulated log mode로 동작

## FCM 연결

Firebase service account 값을 환경 변수로 넣으면 됩니다.

```env
FIREBASE_PROJECT_ID="your-project-id"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxx@your-project-id.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

앱은 로그인 후 디바이스 토큰을 아래 API로 등록해야 합니다.

```bash
POST /profile/me/device-tokens
```

## 로컬 queue 검증

```bash
npm run redis:memory
npm run push:webhook:mock
REDIS_URL="redis://127.0.0.1:6379" PUSH_WEBHOOK_URL="http://localhost:4010" npm start
```

## Railway 배포

### 1. Railway 프로젝트 생성
- GitHub 저장소에 이 서버 코드를 올립니다.
- Railway에서 **New Project > Deploy from GitHub repo** 로 연결합니다.
- 같은 프로젝트에 **Postgres** 서비스 추가
- queue를 쓸 예정이면 **Redis** 서비스도 추가

### 2. Railway 환경 변수
서버 서비스에 아래 값을 설정하세요.

```env
DATABASE_URL=<Railway Postgres가 제공한 연결 문자열>
JWT_SECRET=<충분히 긴 랜덤 문자열>
REDIS_URL=<Railway Redis 연결 문자열, Redis 안 쓰면 비워도 됨>
PUSH_WEBHOOK_URL=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

주의:
- `PORT`는 Railway가 자동 주입하므로 직접 설정하지 않아도 됩니다.
- `FIREBASE_PRIVATE_KEY`는 줄바꿈을 포함한 원문 대신 `\n` 형태 문자열로 넣어도 됩니다.

### 3. 배포 동작
이 저장소에는 `railway.json`이 포함되어 있어서 Railway가 아래 순서로 실행합니다.
- build: `npm ci && npm run prisma:generate && npm run build`
- deploy/start: `npm run prisma:migrate:deploy && npm run start:prod`

### 4. 배포 확인
- 헬스체크: `GET /health`
- 예: `https://<railway-domain>/health`

## 테스트

```bash
npm test -- --runInBand
```
