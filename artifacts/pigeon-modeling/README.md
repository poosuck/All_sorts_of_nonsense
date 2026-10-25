# 비둘기·닭둘기 모델링 미리보기

2026-10-25 모델링 단독 작업 결과입니다. 주변환경과 게임 기능은 변경하지 않았습니다.

- `pigeon.png`, `pigeon.jpg`: 일반 비둘기
- `chicken-pigeon.png`, `chicken-pigeon.jpg`: 닭둘기
- `chicken-pigeon-side.png`, `chicken-pigeon-side.jpg`: 닭둘기 측면과 꼬리 겹깃
- `pair.png`, `pair.jpg`: 두 체형 비교
- `comparison.jpg`: 네 시점을 한 장으로 합친 비교 이미지
- `pigeon-modeling-screenshots.zip`: PNG 원본과 비교 JPG 묶음

## 로컬 확인

```sh
npm ci
npm run dev
```

터미널에 표시된 주소의 `/pigeon`으로 들어가 일반 비둘기와 닭둘기를 선택합니다.

## 이전 버전 확인

이번 디벨롭 직전 버전은 태그 `pigeon-solo-modeling-preview`로 보존합니다. 단독 모델링을 시작하기 전 버전도 원격 브랜치 `archive/pigeon-v3-before-solo-modeling`과 태그 `pigeon-v3-before-solo-modeling`로 남아 있습니다.

```sh
git fetch --all --tags
git switch -c inspect-previous pigeon-solo-modeling-preview
```

현재 버전으로 돌아올 때는 `git switch master`를 사용합니다.
