import { beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_ALARM_HISTORY,
  MAX_LOG_HISTORY,
  resetReactorStore,
  useReactorStore,
} from './useReactorStore';

const s = () => useReactorStore.getState();

describe('useReactorStore', () => {
  beforeEach(() => resetReactorStore());

  it('démarre avec le preset Seborg, en automatique, prêt', () => {
    expect(s().status).toBe('ready');
    expect(s().mode).toBe('auto');
    expect(s().params.volumeL).toBe(100);
    expect(s().pid.setpointK).toBe(350);
    expect(s().timeScale).toBe(10);
  });

  it('patchParams / patchPid fusionnent sans perdre les autres champs', () => {
    s().patchParams({ rpm: 80 });
    expect(s().params.rpm).toBe(80);
    expect(s().params.volumeL).toBe(100);
    s().patchPid({ kp: 0.4 });
    expect(s().pid.kp).toBe(0.4);
    expect(s().pid.ki).toBe(0.01);
  });

  it('setStatus met à jour statut et (optionnellement) mode', () => {
    s().setStatus('running', 'manual');
    expect(s().status).toBe('running');
    expect(s().mode).toBe('manual');
    s().setStatus('paused');
    expect(s().mode).toBe('manual');
  });

  it('pushAlarm : historique antéposé, états actifs, acquittement', () => {
    s().pushAlarm({ level: 'H', active: true, simTimeS: 10, tempK: 366 });
    s().pushAlarm({ level: 'HH', active: true, simTimeS: 12, tempK: 381 });
    expect(s().activeAlarms).toEqual({ LL: false, H: true, HH: true });
    expect(s().alarms[0]?.level).toBe('HH');
    expect(s().alarms.every((a) => !a.acknowledged)).toBe(true);
    s().acknowledgeAlarms();
    expect(s().alarms.every((a) => a.acknowledged)).toBe(true);
    s().pushAlarm({ level: 'HH', active: false, simTimeS: 20, tempK: 370 });
    expect(s().activeAlarms.HH).toBe(false);
    expect(s().alarms[0]?.acknowledged).toBe(false);
  });

  it('une alarme RUPTURE est historisée sans modifier les niveaux actifs', () => {
    s().pushAlarm({ level: 'RUPTURE', active: true, simTimeS: 1, tempK: 451 });
    expect(s().alarms).toHaveLength(1);
    expect(s().activeAlarms).toEqual({ LL: false, H: false, HH: false });
  });

  it('borne la taille des historiques', () => {
    for (let i = 0; i < MAX_ALARM_HISTORY + 20; i++)
      s().pushAlarm({ level: 'H', active: i % 2 === 0, simTimeS: i, tempK: 370 });
    expect(s().alarms).toHaveLength(MAX_ALARM_HISTORY);
    for (let i = 0; i < MAX_LOG_HISTORY + 5; i++) s().pushLog(i, `e${i}`);
    expect(s().log).toHaveLength(MAX_LOG_HISTORY);
    expect(s().log[0]?.label).toBe(`e${MAX_LOG_HISTORY + 4}`);
  });

  it('identifiants uniques', () => {
    s().pushLog(0, 'a');
    s().pushLog(1, 'b');
    expect(new Set(s().log.map((l) => l.id)).size).toBe(2);
  });

  it('clearSession efface alarmes, journal, rupture, erreur, armement', () => {
    s().pushAlarm({ level: 'H', active: true, simTimeS: 1, tempK: 366 });
    s().pushLog(1, 'x');
    s().setRupture({ simTimeS: 5, tempK: 451 });
    s().setError('boom');
    s().setQuenchArmed(true);
    s().clearSession();
    expect(s().alarms).toHaveLength(0);
    expect(s().log).toHaveLength(0);
    expect(s().rupture).toBeNull();
    expect(s().error).toBeNull();
    expect(s().quenchArmed).toBe(false);
    expect(s().activeAlarms.H).toBe(false);
  });

  it('patchUi fusionne les préférences', () => {
    s().patchUi({ reducedMotion: true });
    expect(s().ui.reducedMotion).toBe(true);
    expect(s().ui.cutaway).toBe(true);
  });

  it('ne stocke aucune donnée rapide (garde-fou architectural, PLAN §5.4-5)', () => {
    const keys = Object.keys(s());
    for (const forbidden of ['T', 'CA', 'Tj', 'snapshot', 'temperature', 'pressure']) {
      expect(keys).not.toContain(forbidden);
    }
  });
});
