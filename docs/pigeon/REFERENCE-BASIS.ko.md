# R01 체형 제작 기준 · clay-v2

현재 구간은 명세서 1~3단계의 체형 초안입니다. 깃털 층·최종 색·7종 자세는 후속 구간입니다.

첨부 시트 원본 파일은 실행 환경과 저장소에 등록되어 있지 않습니다. profiles.json 값은 대화의 시트를 보고 잡은 초기 추정값이며 픽셀 실측값으로 표시하지 않습니다.

- 앞·옆·뒤에서 같은 본체를 사용합니다.
- H=1 좌표계에서 몸통·목·머리가 이어지는 단일 단면 로프트를 조형합니다.
- 본체 최대 폭/H 0.65~0.75, 머리 폭/H 0.25~0.30, 전체 길이/H 1.05~1.20을 초기 조정 범위로 사용합니다.
- 날개는 접힌 위치와 부피만 확인하는 외피이며 덮깃·날깃 완성 모델이 아닙니다.
- 눈·납막·부리·발은 머리 비율과 접지를 판단하기 위한 기본 형상입니다.
- Blender 원본과 GLB는 같은 제작 소스에서 생성합니다. 이전 비둘기 자산을 사용하지 않습니다.

## 실행

Blender 4.x에서 프로젝트 루트를 기준으로 실행합니다. 시스템 Blender를 사용한다면 glTF 내보내기에 필요한 NumPy와 캡처 모음용 Pillow도 설치되어 있어야 합니다.

```sh
blender -b --factory-startup -t 2 --python-exit-code 1 --python scripts/pigeon-stage1/probe_tools.py
blender -b --factory-startup -t 2 --python-exit-code 1 --python scripts/pigeon-stage1/build.py
```

생성 결과: art/pigeon/pigeon.blend, src/assets/pigeon/pigeon.glb와 manifest.json, docs/pigeon/reviews/clay-v2의 8방향 캡처와 생성 기록입니다. 과거 clay-v1 캡처는 비교를 위해 보존합니다.

clay-v2에서는 가슴·어깨·목 뿌리의 부피를 늘리고 하복부를 줄였으며, 정수리를 둥글게 하고 얼굴 표식을 얇게 다듬었습니다. 날개 외피는 앞뒤 단면으로 다시 구성하고 후면 몸통·날개·꼬리의 연결을 조정했습니다. 발가락은 짧고 두껍게 바꿨습니다. 조명과 카메라는 기존 설정을 유지해 비교합니다.

웹 검증과 8방향 캡처는 빌드 후 실행합니다. 시스템 Chromium을 사용한다면 다음과 같이 경로를 지정합니다.

```sh
npm run build
npm test
npm run source:check
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node scripts/pigeon-stage1/verify.mjs
```

## 도구 상태

Blender Wing Generator의 공개 코드 대상은 Blender 5.2입니다. 현재 제작 경로에서는 채택하지 않았으며 외부 저장소 코드를 자동 실행하지 않습니다. 호환성·접기 제어·개별 깃 배열은 별도의 도입 검증이 필요합니다.

GitHub 검증 작업은 contents: read 권한으로 실행하고 결과를 아티팩트로 보관합니다. 이 작업은 저장소에 커밋하거나 배포하지 않습니다. 실제 성공 여부는 실행 기록과 생성 결과로 확인합니다.
