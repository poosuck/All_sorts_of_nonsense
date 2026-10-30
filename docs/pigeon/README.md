# 비둘기 R01 모델 제작

현재 **clay-v12**는 사람의 뒤통수처럼 보이던 후두부 돌출과 그 아래 목 패임을 수정한 무채색 모델입니다. 머리 뒤쪽 두께를 줄이고, 뒤 윤곽이 목에서 다시 안으로 들어가지 않도록 어깨까지 연결했습니다. 정면 폭과 색·조명 설정은 유지합니다.

- [최신 무채색 전후 비교·검증 기록](reviews/clay-v12/README.md)
- [clay-v8 체형·겹깃 기록](reviews/clay-v8/README.md)
- [clay-v7 두상 수정 기록](reviews/clay-v7/README.md)
- [첫 체형 초안 기록](reviews/clay-v1/README.md)
- [제작·웹 렌더링 명세서](MODEL-SPEC.ko.md) · [기준 시트와 제작 방식](REFERENCE-BASIS.ko.md)
- [Blender 원본](../../art/pigeon/pigeon.blend) · [GLB](../../src/assets/pigeon/pigeon.glb) · [해시·버전 기록](../../src/assets/pigeon/manifest.json)

## 현재 기준과 범위

사용자가 제공한 8방향·얼굴 확대·다양한 자세의 회색 비둘기 시트(R01)가 기준입니다. 시트 파일은 저장소에 없어 비율은 시각 추정값으로 기록합니다. 이전 먹이 먹는 사진은 자세와 겹깃의 보조 자료입니다.

몸통·목·머리의 단면 로프트와 표면을 따라 겹치는 깃털을 Blender에서 만들고 같은 형상을 GLB로 내보냅니다. 현재는 서기 1종이며, 8방향·전신/얼굴/머리·목·회전·확대·초기화를 지원합니다. 무채색이 기본이고 **기존색**은 이전 재질을 확인하는 선택입니다. 기술 검사 통과를 외형 일치의 합격 판정으로 사용하지 않습니다.

목의 광학적 광택·미세 깃가지·리그·7종 자세는 남아 있습니다. R01과 완전히 일치한 완성 모델로 표시하지 않습니다. 삭제한 이전 비둘기 자산을 다시 불러오지 않으며, 닭둘기·공원·게임 기능은 이번 모델에 포함하지 않습니다.

## 로컬 확인

작업 브랜치 [`codex/pigeon-clay-v1`](https://github.com/poosuck/All_sorts_of_nonsense/tree/codex/pigeon-clay-v1)의 [ZIP](https://github.com/poosuck/All_sorts_of_nonsense/archive/refs/heads/codex/pigeon-clay-v1.zip)을 받아 압축을 푼 뒤 프로젝트 루트에서 실행합니다.

```sh
npm ci
npm run dev
```

http://localhost:5173/pigeon 에서 상단 **clay-v12**을 확인합니다. **머리·목** 버튼으로 두상부터 가슴·등까지 확대하며, 직접 진입은 http://localhost:5173/pigeon?frame=head-neck 입니다. 초기화하면 무채색 전신 기본 시점으로 돌아갑니다. 작업 브랜치의 변경이며 master 병합·Netlify 배포를 뜻하지 않습니다.

[원본 기능 명세](pigeon_feeding_spec_v1.0.md)는 후속 게임 기능의 참고 문서입니다.
