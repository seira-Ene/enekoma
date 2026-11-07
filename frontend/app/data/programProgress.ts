// コース・副専攻・教職の教科専門科目の進み具合を、修得済み科目から判定する
import { isSameCourseName } from './courseGrades';
import type { CourseOrMinorItem, GroupRule } from './coursesAndMinorsCurriculum';

export interface ProgramRequirements {
  requiredCourses: CourseOrMinorItem[];
  electiveRequiredCourses: CourseOrMinorItem[];
  groupRules?: GroupRule[];
}

export interface GroupStatus {
  label: string;
  met: boolean;
  // 足りないときの説明（例：あと2単位）
  shortfall?: string;
}

export interface ProgramProgress {
  completedRequired: CourseOrMinorItem[];
  missingRequired: CourseOrMinorItem[];
  groups: GroupStatus[];
  // 要覧の単位数で数えた、この要件に使える修得単位
  earnedCredits: number;
}

export function hasCompleted(item: Pick<CourseOrMinorItem, 'name' | 'aliases'>, earnedNames: string[]): boolean {
  const names = [item.name, ...(item.aliases || [])];
  return earnedNames.some((n) => names.some((target) => isSameCourseName(n, target)));
}

function evaluateGroup(rule: GroupRule, items: CourseOrMinorItem[], earnedNames: string[]): GroupStatus {
  if (rule.alternatives?.length) {
    const met = rule.alternatives.some((alt) => alt.courses.every((name) => hasCompleted({ name }, earnedNames)));
    return { label: rule.label, met, ...(met ? {} : { shortfall: 'どちらかの組の科目をすべて修得' }) };
  }
  const done = items.filter((c) => c.group === rule.group && hasCompleted(c, earnedNames));
  const credits = done.reduce((s, c) => s + c.credits, 0);
  if (rule.minCourses !== undefined && done.length < rule.minCourses) {
    return { label: rule.label, met: false, shortfall: `あと${rule.minCourses - done.length}科目` };
  }
  if (rule.minCredits !== undefined && credits < rule.minCredits) {
    return { label: rule.label, met: false, shortfall: `あと${rule.minCredits - credits}単位` };
  }
  return { label: rule.label, met: true };
}

export function evaluateProgram(def: ProgramRequirements, earnedNames: string[]): ProgramProgress {
  const completedRequired: CourseOrMinorItem[] = [];
  const missingRequired: CourseOrMinorItem[] = [];
  for (const item of def.requiredCourses) {
    (hasCompleted(item, earnedNames) ? completedRequired : missingRequired).push(item);
  }
  // 同じ科目が複数の欄に載っていても単位は1回だけ数える
  const counted = new Set<string>();
  let earnedCredits = 0;
  for (const item of [...def.requiredCourses, ...def.electiveRequiredCourses]) {
    if (counted.has(item.name) || !hasCompleted(item, earnedNames)) continue;
    counted.add(item.name);
    earnedCredits += item.credits;
  }
  const groups = (def.groupRules || []).map((rule) => evaluateGroup(rule, def.electiveRequiredCourses, earnedNames));
  return { completedRequired, missingRequired, groups, earnedCredits };
}
