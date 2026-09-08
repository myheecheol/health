# 설계 기준 문서

2~6단계를 구현할 때 참조할 결정 사항입니다.
수치는 전부 `src/config/gameConfig.ts`에 있으므로, 값을 바꿀 때 이 문서도 함께 갱신하세요.

---

## 1. XP 규칙

| 이벤트 | XP | 설정 키 |
|---|---|---|
| 세트 완료 | +5 | `SET_COMPLETE` |
| 목표 반복 달성 | +5 | `TARGET_REPS_HIT` |
| 종목 하나 완료 | +10 | `EXERCISE_COMPLETE` |
| 루틴 전체 완료 | +50 | `ROUTINE_COMPLETE` |
| 개인 최고 기록 | +30 | `PERSONAL_RECORD` |
| 러닝 | 1km당 +20 (1회 최대 300) | `RUNNING_PER_KM` / `RUNNING_SESSION_MAX` |
| 7회 연속 | +100 | `STREAK_7` |
| 누적 30회 | +300 | `TOTAL_30` |

러닝 XP = `min(round(km × 30), 450)` → 6.8km = **204 XP**

**보상 포인트 = round(XP × 0.5)**

**밸런스 기준 (확정):** 사용자가 정한 기준은 XP 숫자가 아니라
**"운동 2~3번이면 약속(300P) 한 번"** 입니다. 여기서 역산했습니다.

| 운동 | XP | 포인트 |
|---|---|---|
| A 루틴 완주 | 370 | 185P |
| B 루틴 완주 | 360 | 180P |
| 러닝 6.8km | 204 | 102P |

→ 근력 2번(365P) · 러닝 3번(306P) · 근력1+러닝2(389P) 모두 약속 도달.

요구사항 9·24절의 XP 예시 숫자(A루틴 +180)는 10절 규칙과 산술이 맞지 않아
**규칙을 정본**으로 두고, 대신 위 보상 기준으로 균형을 잡았습니다.
`src/domain/xp.test.ts` 가 이 관계를 테스트로 고정합니다.

## 2. 레벨

`LEVEL_CURVE = { kind: 'linear', base: 600, step: 300 }`
Lv.1→2 에 600 XP(운동 2번), 이후 레벨마다 300씩 더 필요합니다. Lv.10 까지 누적 16,200 XP(운동 약 48번).
곡선을 아는 코드는 `src/domain/level.ts`의 두 함수뿐이라,
구간별 곡선(`{ kind: 'table', thresholds: [...] }`)으로 바꿔도 호출부는 그대로입니다.

## 3. 연속 운동(Streak)

요구사항 16절은 "달력 날짜"가 아니라 **운동 세션 연속 횟수**를 쓰라고 했지만,
그것만으로는 스트릭이 영원히 끊기지 않습니다. 그래서 공백일 상한을 두었습니다.

```
새 세션 완료 시
  마지막 운동일로부터 경과일 ≤ 3  →  currentStreak += 1
  경과일 > 3                     →  currentStreak = 1
```

3일로 잡은 근거는 요구사항 27절의 알림 문구 "3일째 운동 기록이 없습니다"와 맞물리기 때문입니다.
`STREAK_MAX_GAP_DAYS` 하나만 바꾸면 조정됩니다.

## 4. A/B 순서

`src/domain/progression.ts`의 `getNextStrengthRoutine()` 한 곳에서만 결정합니다.

```
1. 사용자 수동 지정(nextRoutineOverride)이 있으면 그것
2. 없으면 완료된 근력 세션 중 가장 최근 것을 찾아 반대편
3. 근력 기록이 하나도 없으면 A
```

러닝은 2번의 필터에서 제외되므로 순서에 영향을 줄 수 없습니다.
수동 지정은 해당 루틴을 실제로 완료하면 자동 해제됩니다(1회용).

## 5. 개인 최고 기록(PR)

종목별로 4가지를 추적합니다 (`ExerciseStats`).

| 항목 | 정의 |
|---|---|
| `maxWeight` | 최고 중량 |
| `maxReps` | 최고 반복 |
| `maxSetVolume` | 단일 세트 최대 볼륨 |
| `maxSessionVolume` | 한 세션 내 해당 종목 총 볼륨 최대치 |

화면에 "최고 볼륨"으로 보여줄 값은 `maxSessionVolume`입니다
(요구사항의 "랫풀다운 최고 볼륨 1,000kg"이 단일 세트인지 세션 합계인지 명시되지 않아,
성장 추이로 더 의미 있는 세션 합계를 택했습니다).

PR 판정은 `applySessionToStats()`가 세션 저장 시점에 함께 수행하며,
반환된 `personalRecords` 가 완료 화면에 표시되고 PR 하나당 +30 XP가 지급됩니다.

## 6. 러닝

- 거리는 미리 정하지 않습니다. 달린 뒤 실제 거리를 입력합니다.
- **페이스는 저장하지 않습니다.** "가장 빠른 기록" 같은 지표를 만들지 않습니다.
- 성장 지표: 총 횟수 / 누적 거리 / 최장 1회 / 최근 기록 / 월간 / 연간
- 거리 검증은 `validateDistanceKm()`가 유일한 통로입니다 (0.1 ~ 500km, 숫자만).

## 7. 점진적 과부하 추천 (6단계)

```
지난 세션의 모든 세트가 목표 반복 이상  →  최고 중량 + weightIncrement 추천
그 외                                  →  추천 없음
```

`weightIncrement`는 종목별 설정값입니다 (상체 2.5kg / 하체 5kg / 사이드레터럴 1.25kg).
**자동으로 채우지 않습니다.** 힌트 배지와 "적용" 버튼만 제공하고 최종 선택은 사용자에게 맡깁니다.

## 8. 통계 설계 (5단계)

집계 결과를 세 덩어리로 나누어, 화면에서 실수로 합산할 여지를 없앱니다.

```ts
computeStats(sessions) → {
  common:   { totalSessions, totalDuration, level, totalXp, currentStreak, bestStreak },
  strength: { countA, countB, totalSets, totalReps, totalVolume, maxWeightByExercise },
  running:  { totalRuns, totalDistanceKm, longestRunKm, monthlyDistanceKm, yearlyDistanceKm },
}
```

그래프 5종은 차트 라이브러리 없이 인라인 SVG로 직접 만듭니다.

## 9. Firestore 레이아웃

```
users/{uid}                              User
users/{uid}/sessions/{sessionId}         WorkoutSession (세트/러닝 기록 임베드)
users/{uid}/exerciseStats/{exerciseId}   ExerciseStats
users/{uid}/active/current               진행 중인 세션
```

**세트를 세션 문서에 임베드한 이유:** 세션당 세트가 최대 30개 내외라 1MB 문서 제한과 무관하고,
세션 1건 조회가 읽기 1회로 끝나 비용과 속도가 유리합니다.
"지난 기록 불러오기"는 `exerciseStats` 캐시가 담당하므로 조회 성능 손실도 없습니다.

앱 코드의 논리 모델은 요구사항 29절대로 `SetRecord.sessionId`를 유지합니다.

## 10. 진행도는 기록에서 다시 계산합니다

XP·레벨·스트릭·포인트·업적은 값을 조금씩 더해 쌓지 않고,
`withDerivedProgress()` 가 매번 전체 기록에서 다시 구합니다.
한 번이라도 어긋나면 영영 틀어진 채 남기 때문입니다.

포인트만은 '쓴 내역'이 필요하므로 `번 것 − 쓴 것` 으로 계산합니다.
덕분에 백업을 복원하거나 기록을 합쳐도 진행도가 자동으로 맞춰집니다.

XP 규칙이 도입되기 전 기록은 `User.dataVersion` 으로 판별해 소급 계산합니다.
**저장소 키 버전(`SCHEMA_VERSION`)은 올리지 마세요** — 올리면 기존 기록을 못 찾습니다.

## 11. 남은 단계

| 단계 | 할 일 |
|---|---|
| 5 | 통계 페이지, SVG 그래프 5종 |
| 6 | 과부하 추천 UI, 알림 스케줄, PWA(manifest + service worker) |
