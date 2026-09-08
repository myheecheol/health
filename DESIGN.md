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

러닝 XP = `min(round(km × 20), 300)` → 6.8km = **136 XP**

**보상 포인트 = round(XP × 0.5)** — 요구사항의 예시(136XP→68P, 185XP→95P)에서 역산한 값입니다.

> ⚠️ **미해결 항목:** 요구사항 9·24절의 XP 총합 예시(A루틴 +180, B루틴 +185)는
> 위 규칙으로 계산하면 약 390 XP가 나와 맞지 않습니다.
> 현재는 **규칙(10절)을 정본**으로 두었습니다.
> "1회 운동 ≈ 180 XP" 체감이 의도였다면 `SET_COMPLETE`를 5 → 2로 낮추면 근사해집니다.
> 3단계 구현 전에 확정이 필요합니다.

## 2. 레벨

MVP는 500XP 균등 구간 (`LEVEL_CURVE = { kind: 'flat', xpPerLevel: 500 }`).
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
`STREAK_MAX_GAP_DAYS` 하나만 바꾸면 조정됩니다. **3단계에서 구현합니다.**

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
반환된 `personalRecords` 배열을 완료 화면에서 쓰면 됩니다. **XP 지급은 3단계.**

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

## 10. 남은 단계

| 단계 | 할 일 |
|---|---|
| 3 | XP 지급, 레벨업 연출, 스트릭 계산, 업적 해금, PR 표시 |
| 4 | 보상 CRUD, 포인트 차감, 사용 내역 |
| 5 | 통계 페이지, SVG 그래프 5종 |
| 6 | 과부하 추천 UI, 알림 스케줄, PWA(manifest + service worker) |
