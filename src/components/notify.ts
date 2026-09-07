/**
 * 휴식 종료 알림 (요구사항 8절).
 * 1차 인앱 → 2차 브라우저 알림 순서로 확장합니다.
 * 권한이 없거나 OS가 막아도 앱 내부 표시는 항상 동작합니다.
 */

let ctx: AudioContext | null = null;

export function beep(enabled: boolean): void {
  if (!enabled) return;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;
    [880, 1174].forEach((freq, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.16);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.18);
    });
  } catch {
    // 사운드 실패는 무시합니다 — 인앱 표시가 이미 떠 있습니다.
  }
}

export function vibrate(): void {
  try {
    navigator.vibrate?.([120, 60, 120]);
  } catch { /* 지원하지 않는 기기 */ }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

export function browserNotify(title: string, body: string): void {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, tag: 'fitrpg-rest' });
    }
  } catch { /* OS가 막은 경우 */ }
}
