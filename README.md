# 별짓 · byeoljit v0.1

아주 쓸데있는 딴짓. 별짓 콘텐츠 진열장, **기존 말랑 푸딩 v24를 이식한 독립 페이지**, 비둘기 모이주기 **새 모델 체형·깃털 연구 화면**입니다.

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
| `/pigeon` | 새 Blender 모델: 8방향·얼굴 확대·기본색/무채색 관찰 |
| 그 외 | 404 안내와 홈 복귀 |

- 원본의 **커스터드 / 딸기 / 말차 / 초코 / 우유** 5종과 맛 선택 저장을 유지합니다.
- 푸딩 위에서 누르면 꾹 눌리고, 끌면 늘어나며, 놓으면 복원됩니다.
- PC에서는 **푸딩 바깥이나 화면 빈 곳에서 좌클릭을 누른 채 푸딩 쪽으로 휘두르면** 손·양푼으로 타격합니다. 푸딩 위에서 시작하면 원본처럼 누르기·당기기가 됩니다.
- 채찍은 포인터가 아닌 **실제 줄과 푸딩의 접촉**으로 판정합니다. 빠른 끝 움직임의 공기 파동과 손 움직임에 따른 휘두르기 소리를 유지했습니다.
- 말랑함·복원 속도는 0–100, 원본 기본값은 **60 / 50**입니다. ‘처음 상태로’는 물성·움직임을 초기화하고 맛·도구·음량 선택은 유지합니다.
- 원본처럼 터치는 누르기·당기기를 지원하며, PC 휘두르기 도구 선택은 터치 환경에서 숨깁니다.
- 키보드는 푸딩 영역에 초점을 맞춘 뒤 Enter/Space로 타격할 수 있습니다. 슬라이더는 방향키로 조절합니다.

## 비둘기 모이주기 · R01 모델 연구

사용자가 제공한 회색 비둘기 시트(R01)를 같은 3D 모델로 제작합니다. 현재 **clay-v8**은 둥근 두상·아랫배와 부리 위치를 조정하고, 날개 겹깃·검은 두 줄·머리의 가는 깃결·목과 가슴의 얇은 깃털 형상과 기본색을 추가한 버전입니다. `/pigeon`에서 8방향, 전신/얼굴, 기본색/무채색을 전환해 같은 GLB를 확인합니다.

체형을 먼저 대조하며, 무채색 보기에도 실제 깃털 형상이 유지됩니다. 최종 목 광택·미세 깃가지·리그와 7종 자세는 남아 있으며 R01과 완전히 일치한 완성 모델로 표시하지 않습니다. 원본 시트 파일은 저장소에 없어 비율은 시각 추정값입니다. [제작 명세](docs/pigeon/MODEL-SPEC.ko.md) · [제작 기준](docs/pigeon/REFERENCE-BASIS.ko.md) · [최신 실제 렌더·검증 기록](docs/pigeon/reviews/clay-v8/README.md)

GitHub 작업 브랜치는 [`codex/pigeon-clay-v1`](https://github.com/poosuck/All_sorts_of_nonsense/tree/codex/pigeon-clay-v1)입니다. [브랜치 ZIP](https://github.com/poosuck/All_sorts_of_nonsense/archive/refs/heads/codex/pigeon-clay-v1.zip)을 내려받아 압축을 풀고 `npm ci`, `npm run dev`를 실행한 뒤 http://localhost:5173/pigeon 에서 상단 **clay-v8**을 확인합니다. 일반 실행에는 Blender가 필요 없습니다.

모델 재생성에만 Blender 4.x·NumPy·Pillow가 필요합니다. `npm run pigeon:probe`, `npm run pigeon:build`로 원본 `art/pigeon/pigeon.blend`와 런타임 `src/assets/pigeon/pigeon.glb`를 같은 제작 소스에서 생성하고 해시를 기록합니다.

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
  views/                         # 별짓 홈, v24 푸딩, 비둘기 체형 연구, 404
  features/pudding/
    core/                        # v24 원본 모듈에서 생성한 JavaScript
    usePudding.js                # Vue 상태·저장·수명주기·선택적 Sites 도구
    original.css                 # 범위를 지정한 원본 CSS (생성 파일)
    controls.css                 # Vue native 컨트롤 및 추가 볼륨 스타일
scripts/sync-pudding-source.mjs   # 원본 검증·이식 변경·재생성
vendor/pudding-v24/               # 제공된 원본 17개 파일과 SHA-256
src/assets/sounds/               # 원본 음원 검토용 MP3 사본
netlify.toml                     # 빌드·SPA rewrite
```

콘텐츠 페이지는 지연 로딩합니다. 푸딩에서 사용하는 Three.js는 별도 청크로 분리되며, 압축 전 500 kB를 넘는 라이브러리 청크에 Vite 크기 경고가 있습니다. 홈 진입 시에는 콘텐츠 엔진과 Three.js를 로드하지 않습니다.

별짓 홈은 제공된 브랜드 요약의 `#F8F8F6`, `#181818`, `#DFFF50`, 미니멀 병맛, 카드 진열장과 심볼 결합형 로고를 반영했습니다. 브랜드 정의서 v0.7 전문은 미제공 상태여서 요약 밖의 규정 준수는 확인하지 않았습니다. 홈의 푸딩 SVG는 진열장 일러스트이며, 실제 푸딩 페이지는 제공된 v24를 사용합니다.

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
