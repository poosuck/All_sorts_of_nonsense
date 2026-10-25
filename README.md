# 별짓 · byeoljit v0.1

아주 쓸데있는 딴짓. 별짓 콘텐츠 진열장, **기존 말랑 푸딩 v24를 이식한 독립 페이지**, 비둘기 모이주기 **비둘기 모델·동작 v3 미리보기**입니다.

Vue 3 · Vite · JavaScript · CSS · Vue Router · Three.js. 서버·DB·API 키 없이 정적 파일로 운영합니다. 기존 ChatGPT Sites 사이트에는 쓰기 작업을 하지 않았습니다.

## 실행

Node.js **24** (`.nvmrc`). 이 README와 `package.json`이 있는 프로젝트 루트에서 실행합니다.

```sh
npm ci
npm run dev
```

클라우드에서 기본 npm 캐시를 사용할 수 없으면 `npm ci --include=dev --cache /tmp/byeoljit-npm-cache`를 사용하세요.

```sh
npm run build
npm run preview
```

배포 결과물은 `dist/`입니다. 개발·미리보기 프로세스는 환경 재시작 후 다시 실행해야 합니다.

## 기존 v24 소스가 기준입니다

사용자가 제공한 **`pudding-play-source-v24.zip`**을 기준으로 했습니다. 원본의 React 래퍼를 Vue로 옮기고, TypeScript 게임 모듈의 타입을 제거해 JavaScript로 변환했습니다. 3D 형상·재질·카메라·조명·물성·마우스/터치·스윕 판정·채찍 줄 시뮬레이션·음원은 원본 코드를 사용합니다. 원본 CSS도 푸딩 페이지에 범위를 지정해 사용합니다.

원본 17개 파일을 `vendor/pudding-v24/`에 **변경 없이** 보존했고, SHA-256 목록과 변환 스크립트를 포함했습니다.

```sh
npm run source:sync   # 보존한 v24에서 JS·원본 스타일 다시 생성
npm run source:check  # 원본 체크섬과 생성 결과 검사
```

생성된 `core/*.js`와 `original.css`를 직접 편집하지 마세요. 필요한 이식 변경은 `scripts/sync-pudding-source.mjs`에 명시합니다. 변환기는 원본에 맞는 TypeScript 5.9.3으로 고정했습니다.

원본 README에 있는 Sites/Cloudflare 설치·게시 지침은 원본 프로젝트 운영 설명입니다. 이번 요청은 Vue/정적 Netlify 프로젝트이므로, 푸딩이 사용하지 않는 Sites 서버·인증·D1 예제는 이식하지 않았습니다. 선택적인 `document.modelContext`의 설정·리셋 도구는 Vue 수명주기에 연결해 유지했습니다.

[원본 대비 변경 기록](docs/REFERENCE.md) · [검증 결과](docs/VALIDATION.md)

## 페이지와 조작

| 경로 | 내용 |
| --- | --- |
| `/` | 별짓 홈, 카드 진열장, 짧은 Hover 애니메이션, 콘텐츠별 진입 |
| `/pudding` | 기존 v24 푸딩 UI·동작, 홈 복귀, 볼륨 조절 |
| `/pigeon` | 중립 배경의 모델 관찰: 일반형·닭둘기, 쉬기·눈 깜박임·걷기·먹기·비행 |
| `/pigeon?view=front` | 선택한 개체 정면 관찰, 측면·회전 전환과 자세 시점 조절 |
| `/pigeon?view=pair` | 같은 조명에서 일반형·닭둘기 크기 비교 |
| 그 외 | 404 안내와 홈 복귀 |

- 원본의 **커스터드 / 딸기 / 말차 / 초코 / 우유** 5종과 맛 선택 저장을 유지합니다.
- 푸딩 위에서 누르면 꾹 눌리고, 끌면 늘어나며, 놓으면 복원됩니다.
- PC에서는 **푸딩 바깥이나 화면 빈 곳에서 좌클릭을 누른 채 푸딩 쪽으로 휘두르면** 손·양푼으로 타격합니다. 푸딩 위에서 시작하면 원본처럼 누르기·당기기가 됩니다.
- 채찍은 포인터가 아닌 **실제 줄과 푸딩의 접촉**으로 판정합니다. 빠른 끝 움직임의 공기 파동과 손 움직임에 따른 휘두르기 소리를 유지했습니다.
- 말랑함·복원 속도는 0–100, 원본 기본값은 **60 / 50**입니다. ‘처음 상태로’는 물성·움직임을 초기화하고 맛·도구·음량 선택은 유지합니다.
- 원본처럼 터치는 누르기·당기기를 지원하며, PC 휘두르기 도구 선택은 터치 환경에서 숨깁니다.
- 키보드는 푸딩 영역에 초점을 맞춘 뒤 Enter/Space로 타격할 수 있습니다. 슬라이더는 방향키로 조절합니다.

## 비둘기 모이주기 · 비둘기 우선 v3

홈의 비둘기 카드 또는 `/pigeon`으로 엽니다. 배경 개발에 앞서 **비둘기 외형과 기본 동작을 검토하는 화면**이 기본입니다. 일반 비둘기 / 닭둘기를 고르고 **쉬기 / 걷기 / 먹기 / 날기**를 선택합니다. 쉬기에는 숨쉬기·눈 깜박임·작은 고개 움직임이 포함됩니다.

모델 보기 / 정면 비교 / 측면 비교 / 돌려보기는 선택한 개체를 크게 보여 줍니다. **크기 비교**는 왼쪽 일반형·오른쪽 닭둘기를 같은 조명에서 함께 보여 줍니다. ‘자세 시점’으로 멈춘 뒤 체형·시점만 바꾸어 같은 포즈를 비교할 수 있습니다. 일시정지·재개·처음부터도 지원합니다.

기준은 사용자 제공 [기능 명세 v1.0](docs/pigeon/pigeon_feeding_spec_v1.0.md)과 A+ 시안입니다. v3는 이전 세로형 몸통을 가슴·목·머리가 이어진 곡면으로 다시 만들고, 닭둘기는 배가 더 낮고 넓은 별도 체형으로 제작했습니다. 작은 잔깃, 층진 날개, 실제 닫히는 눈꺼풀, 얇은 눈테와 홍채·부리를 포함합니다. **주변환경은 이번 작업에서 수정하지 않았습니다.** 이전 공원은 `?view=park`에서만 볼 수 있는 이력입니다.

실제 3D GLB 두 개는 `src/assets/pigeon/*-v3.glb`이며 재질·관절·네 가지 동작 클립을 내장합니다. 모델은 이 저장소의 제작 소스로 작성했습니다. 회색 깃털 바탕 텍스처는 OpenAI image_gen으로 제작했으며 [원본 PNG와 출처](scripts/pigeon-assets/textures/PROVENANCE.md)를 보존했습니다. 제공된 시안의 3D 원본이나 음원을 확보했다고 설명하지 않습니다. 날개 배열과 먹기 자세의 목·가슴 연결은 시안과 차이가 남아 있으며, 시안 재현 완료로 표시하지 않습니다. [비교 사진·동작 영상·검증과 남은 차이](docs/pigeon/MODEL-V3.md)

일반 실행에는 자산 재생성이 필요 없습니다. 모델 제작 소스를 수정한 경우에만 다음 명령으로 다시 내보냅니다. Playwright Chromium이 필요하며 시스템 Chromium 경로를 환경 변수로 지정할 수도 있습니다.

```sh
npm run assets:pigeon
npm test
```

v3 GLB 두 개의 압축 전 합계는 약 **13.1 MB**이며 비둘기 페이지를 열 때만 요청합니다. 제작 소스·자산 SHA-256은 `src/assets/pigeon/manifest.json`에 보존하고 단위 검사에서 확인합니다. v2 파일은 이력으로 남기며 현재 빌드에 포함하지 않습니다.

투척·자동 충전·실제 섭취·성장·싸움·연애·부위별 부착·도감·효과음은 아직 구현하지 않았습니다. 먹기는 부리를 바닥까지 내리는 동작 관찰이며 실제 모이가 줄어드는 게임 기능은 아닙니다. 개체나 설정을 저장하지 않습니다. **PC 웹 우선**이며 모바일 플레이 지원은 후속 범위입니다. [이전 v2 이력](docs/pigeon/MODEL-V2.md) · [1단계 이력](docs/pigeon/STAGE1.md)

## 푸딩 효과음

손 / 양푼 / 채찍 타격 / 채찍 휘두르기의 **원본 음원 바이트, 재생 offset, 상대 gain**을 보존했습니다. 합성음이나 임의 파일로 대체하지 않았습니다.

원본의 voice 제한도 유지합니다: 손·양푼 최대 6, 채찍 휘두르기 최대 3, 채찍 충격은 확인된 새 접촉마다 1 voice입니다. 같은 도구의 이전 음을 재시작하는 방식 대신 각각의 source로 중첩 재생하며, 채찍 충격의 단일 voice 처리는 v24 원본 동작입니다.

요청된 전체 볼륨(기본 **100%**)과 중첩 피크를 관리하는 compressor를 추가했습니다. 브라우저 정책에 따라 사용자 조작 이후 오디오가 활성화됩니다. 음소거는 기존처럼 진행 중인 소리를 멈춥니다. 소스는 원본의 base64 데이터 모듈을 사용하며, `src/assets/sounds/`에는 검토용으로 분리한 동일 MP3도 보관했습니다. [음원 체크섬](docs/reference-assets.json)

## 검증

```sh
npm run source:check
npm test
npx playwright install chromium
npm run test:e2e
npm run build
TEST_PRODUCTION=1 npm run test:e2e
```

이미 Chromium이 설치된 Linux에서는 다운로드 없이 사용할 수 있습니다.

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
TEST_PRODUCTION=1 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

브라우저 검사는 실제 WebGL 조작, 원본 음원의 오디오 스레드 출력·중첩·볼륨·음소거·입력 시각, 직접 진입/새로고침/홈 복귀, 모바일 터치와 콘솔 오류를 확인합니다. 실제 스피커의 청감·최종 출력 지연, 실기기 Safari/Firefox, 실제 Netlify 배포는 별도 검토 대상입니다. [검토용 화면](docs/screenshots/)

## 구조

```text
src/
  components/                    # 별짓 로고·홈 일러스트
  views/                         # 별짓 홈, v24 푸딩, 비둘기 동작 미리보기, 404
  features/pigeon/                # 공원·비둘기 모델·동작·렌더링·미리보기 스타일
  assets/pigeon/                  # 현재 v3·이전 v2 GLB와 자산/소스 체크섬
  features/pudding/
    core/                        # v24 원본 모듈에서 생성한 JavaScript
    usePudding.js                # Vue 상태·저장·수명주기·선택적 Sites 도구
    original.css                 # 범위를 지정한 원본 CSS (생성 파일)
    controls.css                 # Vue native 컨트롤 및 추가 볼륨 스타일
scripts/sync-pudding-source.mjs   # 원본 검증·이식 변경·재생성
scripts/pigeon-assets/            # 비둘기 곡면·깃 형상·관절·재질·생성 텍스처 원본
scripts/build-pigeon-assets.mjs   # 웹용 GLB 내보내기
vendor/pudding-v24/               # 제공된 원본 17개 파일과 SHA-256
src/assets/sounds/               # 원본 음원 검토용 MP3 사본
netlify.toml                     # 빌드·SPA rewrite
```

콘텐츠 페이지는 지연 로딩합니다. 두 콘텐츠가 사용하는 Three.js는 공유 청크로 분리되며, 압축 전 500 kB를 넘는 라이브러리 청크에 Vite 크기 경고가 있습니다. 홈 진입 시에는 콘텐츠 엔진과 Three.js를 로드하지 않습니다.

별짓 홈은 제공된 브랜드 요약의 `#F8F8F6`, `#181818`, `#DFFF50`, 미니멀 병맛, 카드 진열장과 심볼 결합형 로고를 반영했습니다. 브랜드 정의서 v0.7 전문은 미제공 상태여서 요약 밖의 규정 준수는 확인하지 않았습니다. 홈의 푸딩·비둘기 SVG는 진열장 일러스트이며, 실제 푸딩 페이지는 제공된 v24를 사용합니다.

## GitHub / Netlify

프로젝트/package 이름은 `byeoljit`이며 GitHub 저장소는 **`poosuck/All_sorts_of_nonsense`**를 사용합니다. 저장소를 새로 만들거나 이름을 변경하지 않습니다.

사용자의 2026-10-24 지시에 따라 소스는 이 저장소에 업로드하고, **Netlify 배포는 보류합니다.** 아래 설정은 향후 배포용으로 준비한 것으로, GitHub 업로드가 Netlify 배포 승인을 뜻하지 않습니다.

| Netlify 설정 | 값 |
| --- | --- |
| Node | 24 |
| Base directory | 프로젝트 루트 |
| Build command | `npm run build` |
| Publish directory | `dist` |
| Secrets/API keys | 필요 없음 |

`netlify.toml`의 `/* → /index.html` status 200 rewrite로 `/pudding` 직접 진입과 새로고침을 지원합니다. 배포 후에도 직접 접속·새로고침·홈 복귀와 실기기의 소리를 확인해야 합니다. 다른 정적 호스트에도 동일한 SPA fallback이 필요합니다.

`.env`, `.env.*`, Netlify 로컬 설정, 의존성·빌드·테스트 출력은 Git에서 제외했습니다. 향후 `VITE_*` 변수는 브라우저에 공개되므로 민감한 값을 넣지 마세요.
