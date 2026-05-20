import type { Course } from "./academic";

export type SupportedCampus = "江安" | "望江" | "华西";

type SectionTime = [string, string];

export const JIANGAN_SECTION_TIMES: Record<number, SectionTime> = {
  1: ["08:15", "09:00"],
  2: ["09:10", "09:55"],
  3: ["10:15", "11:00"],
  4: ["11:10", "11:55"],
  5: ["13:50", "14:35"],
  6: ["14:45", "15:30"],
  7: ["15:40", "16:25"],
  8: ["16:45", "17:30"],
  9: ["17:40", "18:25"],
  10: ["19:20", "20:05"],
  11: ["20:15", "21:00"],
  12: ["21:10", "21:55"],
};

export const WANGJIANG_HUAXI_SECTION_TIMES: Record<number, SectionTime> = {
  1: ["08:00", "08:45"],
  2: ["08:55", "09:40"],
  3: ["10:00", "10:45"],
  4: ["10:55", "11:40"],
  5: ["14:00", "14:45"],
  6: ["14:55", "15:40"],
  7: ["15:50", "16:35"],
  8: ["16:55", "17:40"],
  9: ["17:50", "18:35"],
  10: ["19:30", "20:15"],
  11: ["20:25", "21:10"],
  12: ["21:20", "22:05"],
};

function normalizeText(value?: string | null) {
  return value?.replace(/\s+/g, "").trim() ?? "";
}

function normalizeSectionValue(value: number | string | null | undefined) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

export function normalizeCampusName(raw?: string | null): SupportedCampus | null {
  const text = normalizeText(raw);
  if (!text) return null;
  if (text.includes("江安")) return "江安";
  if (text.includes("望江")) return "望江";
  if (text.includes("华西")) return "华西";
  return null;
}

export function inferCampusFromCourse(course?: Partial<Course> | null): SupportedCampus | null {
  if (!course) return null;

  return (
    normalizeCampusName(course.campus) ||
    normalizeCampusName(course.building) ||
    normalizeCampusName(course.location)
  );
}

export function normalizeScheduleCourse<
  T extends Pick<Course, "weekday" | "start_section" | "end_section" | "campus" | "building" | "location">
>(course: T): (T & { weekday: number; start_section: number; end_section: number; campus?: string | null }) | null {
  const weekday = normalizeSectionValue(course.weekday);
  const startSection = normalizeSectionValue(course.start_section);
  const endSection = normalizeSectionValue(course.end_section);

  if (weekday === null || startSection === null || endSection === null) {
    return null;
  }

  const normalizedStart = Math.max(1, Math.min(startSection, endSection));
  const normalizedEnd = Math.min(12, Math.max(startSection, endSection));

  if (weekday < 1 || weekday > 7 || normalizedStart > 12 || normalizedEnd < 1) {
    return null;
  }

  const campus = inferCampusFromCourse(course);

  return {
    ...course,
    weekday,
    start_section: normalizedStart,
    end_section: normalizedEnd,
    campus: campus ? `${campus}校区` : (course.campus ?? null),
  };
}

export function getSectionTime(section: number, campus?: string | null): SectionTime | null {
  const normalizedCampus = normalizeCampusName(campus);

  if (normalizedCampus === "江安") {
    return JIANGAN_SECTION_TIMES[section] ?? null;
  }

  if (normalizedCampus === "望江" || normalizedCampus === "华西") {
    return WANGJIANG_HUAXI_SECTION_TIMES[section] ?? null;
  }

  return null;
}

export function getCourseTimeRange(course: Pick<Course, "start_section" | "end_section" | "campus" | "building" | "location">): string {
  const campus = inferCampusFromCourse(course);
  const startSection = normalizeSectionValue(course.start_section);
  const endSection = normalizeSectionValue(course.end_section);

  if (startSection === null || endSection === null) {
    return "";
  }

  const normalizedStart = Math.max(1, Math.min(startSection, endSection));
  const normalizedEnd = Math.min(12, Math.max(startSection, endSection));
  const startTime = getSectionTime(normalizedStart, campus);
  const endTime = getSectionTime(normalizedEnd, campus);

  if (startTime && endTime) {
    return `${startTime[0]}-${endTime[1]}`;
  }

  if (normalizedStart === normalizedEnd) {
    return `第${normalizedStart}节`;
  }

  return `第${normalizedStart}-${normalizedEnd}节`;
}
