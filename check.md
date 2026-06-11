# DING Server 작업 체크리스트

## 진행 순서

### 1. Postgres 전환
- [x] `prisma/schema.prisma` datasource를 PostgreSQL 기준으로 변경
- [x] `.env.example`를 PostgreSQL 기본값 기준으로 정리
- [x] Prisma migrate/generate 기준 점검
- [x] 빌드 확인

### 2. queue 경로 DING summary 캐시 무효화 버그 수정
- [x] worker에서 encounter 생성 후 summary 캐시 무효화 처리
- [x] inline / queue 경로 동작 일관성 맞추기
- [x] 빌드 확인

### 3. 테스트 추가
- [x] auth signup/login
- [x] runs finish
- [x] ding send / match 생성
- [x] chat append / pagination

### 4. notification token + push worker
- [x] 디바이스 토큰 저장 모델 추가
- [x] 토큰 등록 API 추가
- [x] push worker 추가

### 5. chat unread/read 정리
- [x] unreadCount 증가 규칙 정리
- [x] 읽음 처리 API 추가
- [x] 관련 캐시 무효화 반영

### 6. DTO / validation 보강
- [x] preference DTO 추가
- [x] run finish DTO 추가
- [x] chat message DTO 검증 강화

### 7. API 스모크 테스트
- [x] signup/login 실제 호출 확인
- [x] bootstrap/preference/profile device token 확인
- [x] activity/chat read API 확인

### 8. Prisma migration 파일 정리
- [x] `prisma/migrations` 초기 마이그레이션 생성
- [x] `migration_lock.toml` 추가

### 9. Push provider 연동 준비
- [x] webhook 기반 push gateway 추가
- [x] worker에서 gateway 사용하도록 연결
- [x] `.env.example`에 push 설정 추가

### 10. 문서/예시 보강
- [x] `README.md` 실행/주요 API 정리
- [x] `api.http` 예시 요청 추가
- [x] mock push webhook 스크립트 추가

### 11. Queue / push end-to-end 검증
- [x] redis 실행
- [x] webhook mock + 서버를 queue 모드로 실행
- [x] 실제 enqueue 후 webhook 수신 확인

### 12. 실제 push provider 연결 준비
- [x] FCM(firebase-admin) 의존성 추가
- [x] FCM env 기반 gateway 연결
- [x] 문서에 디바이스 토큰/FCM 설정 정리
