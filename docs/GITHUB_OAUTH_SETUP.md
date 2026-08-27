# GitHub OAuth 로그인 설정

이 앱은 GitHub OAuth(web application flow)로 로그인한다. 공유 접근 코드
(`ACCESS_CODE`)는 제거되었고, 모든 페이지와 mutation은 로그인한 사용자
본인의 데이터에만 접근한다.

## 1. GitHub OAuth App 만들기

1. https://github.com/settings/developers → **OAuth Apps** → **New OAuth App**
2. 값 입력:
   - **Application name**: 아무 이름 (예: `todo-app`)
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/auth/github/callback`
3. 생성 후 **Add another URL** 로 배포 도메인 콜백도 추가한다. 하나의 OAuth App에
   여러 콜백 URL을 등록할 수 있으므로 로컬/프로덕션에 별도 App이 필요 없다:
   - `http://localhost:3000/auth/github/callback`
   - `https://<배포도메인>/auth/github/callback`  (예: `https://todo-ten-alpha-44.vercel.app/auth/github/callback`)
4. **Client ID** 확인, **Generate a new client secret** 로 secret 발급.

## 2. 환경변수 설정

`.env.local` (git에 커밋되지 않음) 에 아래를 채운다. `.env.local.example` 참고.

```
GITHUB_CLIENT_ID=<Client ID>
GITHUB_CLIENT_SECRET=<Client secret>       # 절대 커밋하지 말 것
```

- **콜백 URL은 요청 origin에서 자동으로 유도된다** (`http://localhost:3000` 은
  `http://localhost:3000/auth/github/callback`, 배포 도메인은 그 도메인의 콜백).
  따라서 로컬과 배포가 같은 OAuth App / 같은 `.env` 로 동작한다. 1번에서 등록한
  콜백 URL 목록에 사용하는 origin이 모두 들어있기만 하면 된다.
- `GITHUB_OAUTH_REDIRECT_URI` 는 선택 사항이다. 설정하면 그 값으로 **고정**되므로
  (예: origin을 가리는 프록시 뒤) 특수한 경우에만 쓴다. 배포 환경(Vercel 등)에서
  이 변수가 설정돼 있으면 제거해야 자동 유도가 동작한다.
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` 중 하나라도 없으면 `/auth/github`
  접근 시 500과 함께 어떤 변수가 비었는지 알려준다 (앱이 크래시하지 않음).

## 3. 로그인 흐름

| 경로 | 동작 |
|---|---|
| `GET /auth/github` | CSRF `state` 쿠키를 굽고 GitHub 인증 페이지로 리다이렉트 (`scope=read:user`) |
| `GET /auth/github/callback` | `state` 검증 → `code`를 access token으로 교환 → `GET https://api.github.com/user` → `users` 컬렉션에 upsert(`login`, `avatar_url`) → `sessions` 문서 생성 → `todo_session` 쿠키(httpOnly) 설정 → 원래 페이지로 복귀 |
| 로그아웃 (사이드바 버튼) | `sessions` 문서 삭제 + 쿠키 제거 → `/login` |

세션은 DB(`sessions` 컬렉션)에 저장되고 쿠키에는 불투명 토큰만 담긴다.
`expiresAt` TTL 인덱스로 30일 후 자동 삭제되며, 로그아웃 시 즉시 삭제되어
같은 토큰으로 재인증할 수 없다.

## 4. 기존 데이터 마이그레이션 (`user_id` backfill)

OAuth 도입 전 데이터에는 소유자(`userId`)가 없다. 한 번만 실행한다:

1. 소유자가 될 GitHub 계정으로 앱에 **최소 한 번 로그인** (그래야 `users` 행이 생김).
2. `.env.local` 에 `SEED_OWNER_GITHUB_LOGIN=<그 계정의 GitHub 로그인>` 설정.
3. 실행:

   ```
   npm run migrate-user-id
   ```

   `yearlyGoals`, `monthlyPlans`, `weeklyPlans`, `tasks`, `taskEvents` 중
   `userId` 가 없는 문서에만 해당 사용자 id를 채운다. 재실행해도 안전(idempotent).

## 5. 인덱스

`npm run init-indexes` 가 `users.githubId`(unique), `sessions.token`(unique),
`sessions.expiresAt`(TTL), `tasks {userId, weeklyPlanId, status}` 인덱스를 만든다.
앱 런타임에서도 첫 로그인 시 동일 인덱스를 idempotent 하게 보장하므로 필수는 아니다.
