/** Index du jeu de données (Map), recalculés une fois par modification : les pages n'itèrent plus en O(n²). */
import type { Contribution, Dataset, Entity, EntityKR, GlobalKR, Indicator, IndicatorValue, Initiative, Milestone, MilestoneUpdate } from '../types';
import { groupBy } from './progress';

export interface Indexes {
  entity: Map<string, Entity>;
  kr: Map<string, EntityKR>;
  globalKr: Map<string, GlobalKR>;
  krByEntity: Map<string, EntityKR[]>;
  krByDepartment: Map<string, EntityKR[]>;
  initByKr: Map<string, Initiative[]>;
  msByInit: Map<string, Milestone[]>;
  updatesByMs: Map<string, MilestoneUpdate[]>;
  indByKr: Map<string, Indicator[]>;
  valuesByInd: Map<string, IndicatorValue[]>;
  linksByKr: Map<string, Contribution[]>;
  linksByGlobal: Map<string, Contribution[]>;
}

export function buildIndexes(ds: Dataset): Indexes {
  const order = (a: { order: number }, b: { order: number }) => a.order - b.order;
  const initByKr = groupBy(ds.initiatives, (i) => i.entityKrId);
  for (const l of initByKr.values()) l.sort(order);
  const indByKr = groupBy(ds.indicators, (i) => i.entityKrId);
  for (const l of indByKr.values()) l.sort(order);
  const msByInit = groupBy(ds.milestones, (m) => m.initiativeId);
  for (const l of msByInit.values()) l.sort((a, b) => a.quarter - b.quarter);
  return {
    entity: new Map(ds.entities.map((e) => [e.id, e])),
    kr: new Map(ds.entityKrs.map((k) => [k.id, k])),
    globalKr: new Map(ds.globalKrs.map((g) => [g.id, g])),
    krByEntity: groupBy(ds.entityKrs, (k) => k.entityId),
    krByDepartment: groupBy(ds.entityKrs, (k) => k.departmentId),
    initByKr,
    msByInit,
    updatesByMs: groupBy(ds.updates, (u) => u.milestoneId),
    indByKr,
    valuesByInd: groupBy(ds.indicatorValues, (v) => v.indicatorId),
    linksByKr: groupBy(ds.contributions, (c) => c.entityKrId),
    linksByGlobal: groupBy(ds.contributions, (c) => c.globalKrId),
  };
}
