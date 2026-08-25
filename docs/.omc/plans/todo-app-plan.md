# 할 일 관리 앱 — 구현 계획서

**상태: pending approval** (실행 승인 전, 코드/파일 변경 없음)
**기준 문서**: `docs/PRD.md`
**작성 모드**: Direct + Analyst 자문 (consensus 아님)

---

## 1. 요구사항 요약

PRD(`docs/PRD.md`)의 3단 계층 구조를 구현한다: **1년 목표(Yearly Goal) → 주간 계획(Weekly Plan) → 할 일(Task)**.
Task는 todo/doing/done 상태를 드래그 앤 드롭으로 이동하며(PRD:35-37), 상태 변경 시 상위 Weekly Plan의 진행률이 자동 재계산되고(PRD:48-50), Yearly Goal 화면은 하위 Weekly Plan들의 평균 진행률을 보여준다(PRD:51).

### 확정된 인터뷰 결정 사항
| 항목 | 결정 |
|---|---|
| 기술 스택 | Next.js(App Router) + TypeScript + Tailwind CSS + MongoDB (linknamu 스타일 재사용) |
| 범위 | PRD P0 + P1 전체 (단, 다중 디바이스 동기화는 인증 미포함으로 후순위) |
| 인증 | 없음 — 단일 암묵적 사용자, 로그인 없음 |
| 배포 | Vercel + MongoDB Atlas |

### Analyst 리뷰로 드러난 미해결 지점과 이번 계획의 기본값(default)
PRD와 인터뷰가 명시하지 않은 지점은 아래처럼 **명시적 기본값**으로 확정하고 진행한다. 사용자가 이 표의 항목에 이견이 있으면 실행 승인 전에 알려달라 — 없으면 이 값대로 구현한다.

| 미해결 지점 | 채택한 기본값 | 근거 |
|---|---|---|
| PRD:45 "필수" vs PRD:46 "예외" 모순 | Weekly Plan도 Task처럼 상위 Yearly Goal 없이 생성 가능 | PRD:46의 예외 철학을 상위 계층에도 일관 적용, 구조 단순화 |
| 보드 뷰 범위(PRD:36) | 보드는 **Weekly Plan 단위**로 스코프. 상위 미지정 Task는 별도 "미지정 할 일함" 목록 뷰 | 계층 구조(PRD:41-42)와 일치, 쿼리/DnD 범위가 명확해짐 |
| 주(week) 정의 | 월요일 시작(ISO-8601), `weekStart`를 `YYYY-MM-DD` 문자열로 저장(연도+주차 번호 저장 안 함) | 연도 경계에서 `연도+주차` 계산 오류 방지 |
| 타임존 | 앱 전역 상수 `Asia/Seoul` 고정. 기한(dueDate)은 날짜 전용 문자열로 저장 | Vercel은 UTC로 실행되어 "오늘/기한 지남" 판정이 9시간 어긋남 |
| 빈 Weekly Plan 진행률 | Task 0개면 `progress = null`, UI에 "할 일 없음" 표시, **연간 평균 계산에서 제외** | null을 0으로 세면 빈 다음 주 계획을 만들자마자 연간 %가 하락하는 체감상 버그 발생 |
| 연간 평균 계산식 | PRD:51 문구 그대로 — null이 아닌 하위 Weekly Plan 진행률의 **단순 평균**(task 수 가중치 없음) | PRD 원문 준수, 가중 평균은 P1 이후 옵션으로 follow-up |
| doing 상태의 진행률 기여 | 기여하지 않음 (PRD:49 공식 그대로 done만 분자) | PRD 공식이 명시적으로 done만 카운트 |
| "실시간 재계산"(PRD:50) 의미 | 내 화면에서 즉시 반영(로컬). 다른 탭/기기로 push하지 않음 | 동기화 후순위 결정과 일관, SSE/WebSocket 불필요 |
| 삭제 정책 | Yearly Goal/Weekly Plan 삭제 시 하위 항목은 **고아 처리**(상위 참조를 null로, 삭제하지 않음), 개수를 보여주는 확인창 필수. Task 삭제는 하드 삭제하되 상태 변경 이력은 별도 `taskEvents` 컬렉션에 append-only로 남겨 통계(PRD:67) 보존 | PRD:46의 "미지정 허용" 철학과 일관, 통계 기능이 Task 삭제에 영향받지 않게 함 |
| Task 재상위지정(re-parenting) | 허용(완료된 Task 포함) — 진행률은 저장하지 않고 조회 시 즉시 계산(derive)하므로 이동해도 정합성 깨지지 않음 | 저장형 진행률의 drift 문제 회피 |
| Task 기한이 상위 주 범위를 벗어나는 경우 | 제약하지 않음(자유 입력), UI에 안내 문구만 표시 | P0 범위 최소화, 강제 검증은 follow-up |
| 컬럼 내 순서(order) 정렬 | **미지원**. 드래그는 상태(컬럼) 이동만 처리, 컬럼 내부는 최근 수정순 정렬 | PRD에 명시 없음, 범위 크리프 방지. 필요 시 P2 follow-up |
| 기한 알림(PRD:65) | 백그라운드 push 불가(인증 없음 + Vercel Hobby cron 제약). **탭이 열려 있을 때 브라우저 Notification API** + 화면 내 "오늘 마감/지연" 배지로 구현 | 실현 불가능한 기능을 약속하지 않기 위한 정직한 축소 |
| 반복 생성(PRD:66) | Cron 기반 자동 생성 아님. 사용자가 누르는 **"다음 주 계획 만들기"** 버튼으로 즉시 복제(플랜 shell + Task, 상태는 todo로 리셋, 기한은 +7일 이동) | Vercel Hobby cron 제약 회피, UX적으로도 더 예측 가능 |
| 통계/리포트(PRD:67) 범위 | 정확히 3개 뷰로 고정: ① 최근 12주 주간 완료율 추이, ② 최근 30일 일별 완료 개수, ③ Yearly Goal별 누적 완료 수 | 무한정 확장 방지 |
| 다중 디바이스 동기화(PRD:68) | **이번 계획에서 구현하지 않음.** 인증 도입 이후 별도 계획으로 진행 (Follow-up) | 인터뷰에서 인증 미포함으로 확정 |
| DnD 라이브러리 | `@dnd-kit/core` + `@dnd-kit/sortable` | React 19 + Next 16과 호환, `react-beautiful-dnd`는 유지보수 중단·React 19 미호환 |
| 배포 URL 노출 | 인증 없이 공개 배포되므로 `X-Robots-Tag: noindex` 헤더만 추가(검색엔진 노출 방지). URL을 아는 누구나 쓰기 가능한 상태는 **의도된 리스크로 accept** | 인증 없음 결정에 따른 최소 완화책, 완전한 차단은 follow-up |

---

## 2. 데이터 모델 (MongoDB, `mongodb` native driver, ODM 없음)

모든 문서에 `schemaVersion: 1` 필드 포함(향후 마이그레이션 대비).

### `yearlyGoals`
```ts
{
  _id: ObjectId,
  title: string,        // required, trim, max 200자
  description?: string, // max 2000자
  year: number,         // e.g. 2026
  createdAt: Date,      // UTC
  updatedAt: Date,
  schemaVersion: 1
}
```

### `weeklyPlans`
```ts
{
  _id: ObjectId,
  yearlyGoalId: ObjectId | null,  // PRD:46 철학을 확장 적용
  title: string,                  // required, trim, max 200자
  weekStart: string,              // 'YYYY-MM-DD', 월요일, Asia/Seoul 기준
  weekEnd: string,                // weekStart + 6일, 저장 시 계산
  createdAt: Date,
  updatedAt: Date,
  schemaVersion: 1
}
```
- 부분 unique 인덱스: `{ yearlyGoalId: 1, weekStart: 1 }` (yearlyGoalId가 null이 아닌 문서에만 적용) — 같은 목표 아래 같은 주가 중복 생성되는 것 방지, 반복 생성 버튼의 idempotency 보장.

### `tasks`
```ts
{
  _id: ObjectId,
  weeklyPlanId: ObjectId | null,  // PRD:46 명시적 허용
  title: string,        // required, trim, max 200자
  description?: string, // max 2000자
  status: 'todo' | 'doing' | 'done',
  dueDate?: string,      // 'YYYY-MM-DD', optional
  completedAt?: Date,    // status가 done이 될 때 기록, todo/doing로 되돌리면 null
  notifiedAt?: string,   // 'YYYY-MM-DD', 기한 알림 중복 방지용
  createdAt: Date,
  updatedAt: Date,
  schemaVersion: 1
}
```
- 인덱스: `{ weeklyPlanId: 1, status: 1 }`, `{ dueDate: 1 }`

### `taskEvents` (append-only, 통계용)
```ts
{
  _id: ObjectId,
  taskId: ObjectId,
  weeklyPlanId: ObjectId | null,  // 이벤트 시점 스냅샷 (재상위지정 이력 보존)
  yearlyGoalId: ObjectId | null,
  fromStatus: string | null,
  toStatus: 'todo' | 'doing' | 'done',
  occurredAt: Date  // UTC
}
```
- Task 삭제와 무관하게 유지되어 완료 이력 통계(PRD:67)의 데이터 소스가 된다.

### 진행률: **저장하지 않고 조회 시 계산(derive)**
- Weekly Plan 진행률: `tasks`에서 `weeklyPlanId`로 `$group`하여 `done`/전체 카운트 후 계산. `total === 0`이면 `null`.
- Yearly Goal 진행률: 하위 Weekly Plan들의 (null 아닌) 진행률 단순 평균.
- 이유: 저장형 카운터는 동시 드래그·수동 DB 편집·삭제 시 drift 위험(Analyst 지적). 이 프로젝트 규모(개인 사용자, 문서 수천 건)에서는 집계 쿼리가 충분히 빠르다.

---

## 3. 아키텍처

- **Next.js App Router**, Server Actions로 CRUD 처리(별도 클라이언트 fetch 없이 폼/버튼에서 직접 mutate). 드래그 앤 드롭 상태 변경만 낙관적 UI(`useOptimistic`) + Server Action 조합.
- **Zod**로 모든 Server Action/Route Handler 입력 검증 (linknamu에는 없던 계층이지만 네이티브 드라이버는 스키마 강제가 없으므로 필수로 추가).
- MongoDB 연결: `src/lib/mongodb.ts`에서 **모든 환경**(dev+prod)에 대해 전역 캐시된 client promise 사용, `maxPoolSize: 10`. (linknamu의 dev-only 캐싱 버그를 그대로 복사하지 않는다 — Atlas M0 연결 수 초과 방지.)
- 라우트 구조 (예정):
  - `/` — 이번 주(Asia/Seoul 기준 오늘이 속한 주) Weekly Plan 보드. 없으면 생성 유도 화면.
  - `/goals` — Yearly Goal 목록 + 생성
  - `/goals/[id]` — Yearly Goal 상세: 하위 Weekly Plan 목록 + 평균 진행률 + 대시보드(P1)
  - `/plans/[id]` — Weekly Plan 상세: todo/doing/done 3-컬럼 보드
  - `/tasks/unassigned` — 상위 Weekly Plan 없는 Task 목록
  - `/stats` — 통계 3뷰(P1)
- 컴포넌트: `src/components/board/`(DnD 보드), `src/components/goal/`, `src/components/plan/`

---

## 4. 구현 단계

### Phase 0 — 프로젝트 셋업
1. `create-next-app`으로 TypeScript + Tailwind v4 + App Router 스캐폴딩 (linknamu와 동일 설정 참고: `@/*` alias, ESLint)
2. `mongodb`, `zod`, `@dnd-kit/core`, `@dnd-kit/sortable` 설치
3. `src/lib/mongodb.ts` 작성 (전역 연결 캐시, `maxPoolSize: 10`)
4. `src/lib/db-schema.ts`에 Zod 스키마 정의(3개 컬렉션 + taskEvents)
5. MongoDB Atlas 클러스터(M0) 생성, `.env.local`에 연결 문자열, Vercel 환경변수 등록
6. `next.config.ts`에 `X-Robots-Tag: noindex` 헤더 추가
7. **DnD 스파이크**: 3컬럼 더미 보드를 Next 16 + React 19 프로덕션 빌드(`next build && next start`)에서 검증 — dev 모드에서만 동작하고 prod에서 깨지는 경우를 사전 차단

### Phase 1 — P0 핵심 기능
8. `weeklyPlans`, `tasks` collections에 인덱스 생성 스크립트(`scripts/init-indexes.ts`)
9. Yearly Goal CRUD: Server Actions(`createGoal`, `updateGoal`, `deleteGoal`) + `/goals`, `/goals/[id]` 페이지
10. Weekly Plan CRUD: Server Actions + `/plans/[id]` 페이지, weekStart 자동 계산 유틸(`getWeekStart(date, 'Asia/Seoul')`)
11. Task CRUD: Server Actions(`createTask`, `updateTask`, `deleteTask`) — 제목/설명/기한/상위 Weekly Plan 필드
12. 상태 관리: `updateTaskStatus(taskId, newStatus)` Server Action — `taskEvents`에 이벤트 기록 + `completedAt` 설정/해제
13. 보드 UI: `/plans/[id]`에 3컬럼 DnD 보드(`@dnd-kit`), 드롭 시 `updateTaskStatus` 호출 + `useOptimistic`으로 즉시 반영, 실패 시 카드+진행률 원복 및 에러 토스트
14. 비-DnD 상태 변경 컨트롤(드롭다운/버튼) — 접근성 및 테스트 용이성 확보(마우스 없이도 상태 이동 가능)
15. 진행률 계산 유틸(`getWeeklyPlanProgress`, `getYearlyGoalProgress`) — 위 2절의 derive 규칙 구현, 단위 테스트 작성
16. `/` 홈: 오늘이 속한 주의 Weekly Plan 자동 탐색 → 있으면 리다이렉트, 없으면 생성 유도
17. `/tasks/unassigned` 목록 + 여기서 Weekly Plan 재상위지정 UI

### Phase 2 — P1 추가 기능
18. Yearly Goal 대시보드(`/goals/[id]`에 진행률 바 + 하위 Weekly Plan별 미니 진행률 목록)
19. 기한 알림: 브라우저 `Notification` 권한 요청(사용자 제스처 트리거) + "오늘 마감/지연" 배지, `notifiedAt` 필드로 하루 1회 중복 방지, 완료된 Task는 알림 억제
20. "다음 주 계획 만들기" 버튼: 현재 Weekly Plan → 다음 `weekStart`로 plan+tasks 복제(상태 todo 리셋, 기한 +7일, `weekStart` unique 인덱스로 중복 생성 방지)
21. 통계 3뷰(`/stats`): `taskEvents` 집계 쿼리로 ① 최근 12주 완료율 ② 최근 30일 일별 완료 수 ③ Yearly Goal별 누적 완료. Tailwind/inline SVG로 렌더(차트 라이브러리 미도입)

### Phase 3 — 마감
22. 시드 스크립트로 Task 2,000건 생성 후 보드 쿼리 성능 확인, 인덱스 검증
23. 모바일(터치) 실기기 QA: 드래그, 스크롤 공존 확인(`touch-action` 설정)
24. Vercel 배포, Atlas 프로덕션 연결 확인

---

## 5. 인수 조건(Acceptance Criteria)

- [ ] Weekly Plan(Task 3개, done 2개)의 진행률 API/함수 결과가 `66`(내림)이다.
- [ ] Task 3/3 done → 진행률 `100`.
- [ ] Task 0개인 Weekly Plan → 진행률 `null`, UI에 "할 일 없음" 표시.
- [ ] Yearly Goal 하위에 진행률 50%, 100%, null(빈 plan)인 Weekly Plan이 있으면 대시보드는 `75`를 표시한다(null 제외 평균).
- [ ] 보드에서 카드를 drop하면 새로고침 없이 진행률 바가 갱신된다.
- [ ] 네트워크 오프라인 상태에서 drop하면 카드와 진행률 바가 모두 원래 상태로 되돌아가고 에러 토스트가 뜬다.
- [ ] 같은 컬럼 안으로 drop하면 서버 요청이 발생하지 않는다(no-op).
- [ ] Weekly Plan 삭제 시 하위 Task 5개는 삭제되지 않고 `/tasks/unassigned`에 나타나며, 삭제 확인창에 "5개의 할 일이 미지정 상태가 됩니다"가 표시된다.
- [ ] 상위 Weekly Plan 없이 생성한 Task가 어떤 Weekly Plan/Yearly Goal 진행률 계산에도 포함되지 않는다.
- [ ] 390px 너비 터치 기기에서 카드를 todo→doing→done으로 이동할 수 있고, 보드 영역의 세로 스크롤도 정상 동작한다.
- [ ] 마우스/터치 없이 드롭다운 컨트롤만으로 모든 상태 전이가 가능하다.
- [ ] KST 2026-08-25 08:00에 기한이 `2026-08-25`인 Task가 "오늘 마감"으로 표시된다(서버가 UTC로 동작해도 정확함).
- [ ] "다음 주 계획 만들기"를 두 번 눌러도 다음 주 Weekly Plan은 1개만 생성된다(unique 인덱스 + upsert).
- [ ] 유효하지 않은 `ObjectId` 문자열로 `/plans/[id]` 접근 시 500이 아니라 404를 반환한다.

---

## 6. 리스크 및 완화

| 리스크 | 완화 |
|---|---|
| `react-beautiful-dnd` 류 미유지보수 DnD 라이브러리 채택 시 React 19에서 깨짐 | `@dnd-kit` 채택 확정 + Phase 0에 프로덕션 빌드 스파이크 포함 |
| 저장형 progress 카운터의 동시성 drift | 진행률을 저장하지 않고 조회 시 항상 재계산(derive) |
| Vercel UTC 실행으로 인한 "오늘/기한 지남" 오판 | `Asia/Seoul` 앱 전역 상수 + 날짜 전용 문자열 저장, `new Date()`로 "오늘" 판단 금지 |
| 네이티브 MongoDB 드라이버의 스키마 미검증으로 잘못된 문서 저장 | 모든 mutation 경로에 Zod 검증 추가 |
| 인증 없는 공개 URL에 대한 쓰기 접근 | `noindex` 헤더 + 리스크를 명시적으로 accept, follow-up으로 문서화 |
| Vercel Hobby cron 제약으로 백그라운드 알림/자동 반복 생성 불가능 | 알림은 탭-오픈 Notification, 반복 생성은 수동 버튼으로 설계해 cron 의존성 자체를 제거 |
| linknamu의 dev-only 커넥션 캐싱 버그를 그대로 복사 시 Atlas M0 연결 수 초과 | 전 환경 캐싱 + `maxPoolSize: 10`으로 재구현 |
| 2,000+ Task 규모에서 전역 보드/집계 쿼리 성능 저하 | Phase 3에 시드 데이터 성능 검증 포함, 사전 인덱스 설계 |

---

## 7. 검증 단계

1. 단위 테스트: 진행률 계산 유틸(`getWeeklyPlanProgress`, `getYearlyGoalProgress`) — 위 인수 조건의 66/100/null/75 케이스 포함
2. 통합 테스트: Server Action 경로별(생성/수정/삭제/상태변경) Zod 검증 실패·성공 케이스, `ObjectId.isValid()` 가드
3. `next build && next start` 프로덕션 빌드에서 DnD 동작 확인(dev 전용 동작 여부 검증)
4. 실기기(모바일) 터치 드래그 + 스크롤 공존 QA
5. 오프라인 시나리오 수동 QA(드롭 실패 시 카드/진행률 원복)
6. 2,000건 시드 데이터로 보드/대시보드 로딩 시간 확인

---

## 8. 범위 제외 / Follow-up

- **다중 디바이스 동기화(PRD:68)** — 인증 도입 후 별도 계획.
- **컬럼 내 순서 정렬(order)** — 필요 시 fractional index 추가.
- **가중 평균 방식의 연간 진행률** — 현재는 PRD 원문대로 단순 평균, 필요 시 옵션 추가.
- **완전한 접근 제어(비밀번호 게이트/Vercel Deployment Protection)** — 현재는 noindex만 적용, 필요 시 후속 작업.
- **Task 기한이 상위 주 범위를 벗어나는 경우의 검증/경고** — 현재는 자유 입력.

---

## 다음 단계

이 계획은 **pending approval** 상태다. 위 "확정된 기본값" 표에 이견이 없으면 실행 승인을 부탁드린다. 승인 시 team(권장, 병렬 에이전트) 또는 ralph(순차 실행) 중 하나로 실행을 시작할 수 있다.
