# DING Server Architecture

## 목표
- 많은 유저가 붙어도 API 서버를 수평 확장할 수 있는 구조
- 러닝 / DING / 채팅을 분리 가능한 도메인으로 유지
- 지금은 모놀리식 NestJS로 빠르게 개발하고, 나중에 서비스 단위로 분리 가능하게 설계

## 현재 구조
- `auth/`: signup, login, jwt, guard
- `profile/`: profile 조회/수정
- `runs/`: dashboard, activity, finish run
- `ding/`: summary, send ding
- `chat/`: threads, messages
- `prisma/`: DB client/provider
- `queue/`: BullMQ enqueue/worker
- `cache/`: Redis cache facade
- `common/`: 공통 dto
- `data/`: 현재 application facade/service

## 현재 DB 설계 원칙
정규화된 핵심 테이블:
- `User`
- `Profile`
- `Run`
- `RunRoutePoint`
- `RunSplit`
- `Encounter`
- `Match`
- `ChatThread`
- `ChatMessage`

핵심 포인트:
1. `Run`, `ChatMessage` 같이 빠르게 커지는 엔티티를 분리
2. `userId + createdAt` 인덱스로 최근순 조회 최적화
3. `userId + runnerId` 유니크 키로 encounter/match dedupe
4. `userId + participantId` 유니크 키로 thread dedupe
5. route/split 분리로 향후 통계/추천 계산 가능

## API 확장 원칙
- 인증은 JWT 기반 stateless
- list API는 점진적으로 pagination 기본 적용
- chat/activity 같은 hot path는 항상 최신순 + page/pageSize
- 모바일 앱 호환 때문에 기존 array API는 유지, 신규 paged API를 추가하는 방식으로 확장

## 대규모 유저 전제의 권장 구조
### 1) 단기
- SQLite -> Postgres 전환
- Prisma migration CI 포함
- read-heavy API에 Redis 캐시 추가
- background job 없이도 운영 가능한 단순 구조 유지

### 2) 중기
- `encounter generation worker`
  - run finish 시 큐에 적재
  - worker가 proximity / scoring 계산
- `notification worker`
  - DING / match / chat push 비동기 발송
- `chat gateway`
  - WebSocket 또는 SSE
- `analytics pipeline`
  - streak, pace trend, retention 계산 비동기화

### 3) 장기
도메인 분리 후보:
- Auth/Profile Service
- Run Tracking Service
- Matching/Recommendation Service
- Chat Service
- Notification Service

분리 기준:
- DB 부하 패턴이 다를 때
- 배포 주기가 달라질 때
- 실시간 요구사항이 다를 때

## 인프라 권장안
- API: NestJS stateless instances behind load balancer
- DB: Postgres primary + read replica
- Cache: Redis
- Queue: BullMQ or SQS
- File/Media: S3
- Realtime: WebSocket gateway
- Observability: structured logs + metrics + tracing

## 지금 코드에서 확장 가능한 부분
- Prisma datasource는 env 기반이라 Postgres 전환 쉬움
- encounter 계산 로직은 `DataService.generateEncounters`에 모여 있어 worker로 추출 쉬움
- pagination DTO 분리로 list API 공통화 시작 가능
- chat/activity/messages는 무한 스크롤 대응 가능
- dashboard/ding/chat page는 Redis 캐시 적용 가능 구조
- encounter generation enqueue 포인트가 있어 worker 분리 준비 완료

## 다음 추천 구현
1. Postgres 전환
2. Redis 캐시
3. queue 기반 encounter generation
4. chat message append API + pagination 분리
5. notification token 저장 및 push worker
