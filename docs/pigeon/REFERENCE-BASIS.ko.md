# R01 제작 기준 · clay-v9

사용자가 제공한 8방향·얼굴 확대 시트의 회색 비둘기를 실제 3D 모델로 제작합니다. 현재는 **색 작업에 앞서 머리와 머리–목–몸통의 형태를 무채색으로 대조하는 구간**입니다. 시트 원본 파일은 실행 환경과 저장소에 없으며, `profiles.json` 값은 시각 추정값입니다. 픽셀 실측값이나 외형 일치율로 표시하지 않습니다.

- 앞·옆·뒤에서 같은 본체를 사용합니다. Blender +Z 위, -Y 앞, +X 왼쪽, H=1 기준입니다.
- 몸통·목·머리는 연속 단면 로프트이며 정수리는 연속 곡면으로 연결합니다.
- 깃털을 숨긴 본체 표면과 깃털이 붙은 무채색 모델을 함께 확인합니다. 재질로 앞목의 패임이나 두상의 각을 가리지 않습니다.
- 기존 기본색·깃털 재질은 보존하며, 이번 구간에서 색·광택을 추가하지 않습니다. 웹의 기본 보기와 초기화는 무채색입니다.
- 기술 검사 통과는 외형 일치의 합격 판정이 아닙니다. 이전 비둘기 모델이나 외부 모델을 불러오지 않습니다.

## 현재 변경

clay-v8의 앞목은 .70H에서 뒤로 들어갔다가 머리 아래에서 다시 튀어나와 머리가 목 위에 얹힌 듯 보였습니다. clay-v9는 머리·목의 곡선을 가슴 위쪽까지 내려 .55H~.645H에서 본체와 연결합니다. .70H의 앞면을 -.290H에서 -.320H로 조정해 패임을 줄이고, 턱 밑에서 가슴까지 완만하게 이어지도록 했습니다.

눈높이 부근에는 둥근 두개골 부피를 만들고 바로 아래의 목을 정리했습니다. 뒤통수는 약 .015~.025H 뒤로 채우며 등으로 점진적으로 연결했습니다. 머리 폭이 늘어나도 눈이 과하게 벌어지지 않도록 눈 각도를 50°에서 44°로 바꿨습니다. 부리·납막의 위치는 유지했습니다. 이 수치들은 시트 실측값이 아닌 제작 매개변수입니다.

본체·두상·날개·꼬리 매개변수는 `art/pigeon/profiles.json`, 조형과 내보내기는 `scripts/pigeon-stage1/build.py`, 기존 깃털 배열은 `scripts/pigeon-stage1/plumage.py`에서 관리합니다. [무채색 결과와 전후 기록](reviews/clay-v9/README.md)을 기준으로 검토합니다.

## 재생성과 검토

Blender 4.x·NumPy·Pillow를 준비하고 프로젝트 루트에서 실행합니다.

```sh
npm run pigeon:probe
npm run pigeon:build
```

기본 빌드는 원본 `art/pigeon/pigeon.blend`, GLB와 manifest, Blender 전신 8방향을 생성합니다. `PIGEON_MODEL_ONLY=1`이면 원본·GLB·생성 기록만 만들고 Blender 전신 캡처는 생략합니다. clay-v9 원본은 이 옵션으로 생성하며, 전신 비교 자료는 실제 웹 렌더를 사용합니다. 과거 캡처는 각 리비전 폴더에 보존합니다.

```sh
PIGEON_REVIEW_HIDE_PLUMAGE=1 PIGEON_REVIEW_SAMPLES=24 blender -b --factory-startup -t 2 --python-exit-code 1 --python scripts/pigeon-stage1/review_head_neck.py
npm run build
npm test
npm run source:check
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node scripts/pigeon-stage1/verify.mjs
```

Blender 검토 스크립트는 원본을 저장하지 않고 렌더용 무채색 재질·카메라만 설정합니다. 깃털 숨김 검토는 본체의 실제 곡면을 확인하기 위한 것이며, 기록에는 원본 해시·카메라·조명·샘플 수·숨긴 메시가 포함됩니다. 전후 비교는 같은 카메라·조명·무채색 재질·24샘플을 사용합니다.

웹 검증은 같은 GLB의 무채색 전신 8방향·얼굴 3방향·머리–목 4방향, 총 15장을 촬영합니다. 렌더 기록에는 GLB 해시와 재질·관찰 범위가 포함됩니다.

## 이전 이력

clay-v3은 가슴·배, clay-v4~v5는 머리와 얼굴 관계, clay-v6은 몸통의 앞뒤 축·몸통을 감싸는 어깨·접힌 날개와 꼬리 부피를 수정했습니다. clay-v7은 전역 얼굴 면 변형을 제거하고 정수리 연결을 부드럽게 했습니다. clay-v8은 둥근 아랫배와 얼굴 관계·실제 겹깃·기본색을 추가했습니다. [clay-v8 원본과 기록](reviews/clay-v8/README.md)은 해당 커밋에 고정합니다.

Blender Wing Generator 공개 코드의 대상은 Blender 5.2이며 현재 제작 경로에서는 사용하지 않습니다. GitHub 검증 작업은 contents: read 권한으로 결과를 아티팩트에 보관하며 저장소에 자동 커밋하거나 배포하지 않습니다.
