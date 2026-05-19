"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, MapPin, Users, ArrowLeft, Building2, GraduationCap } from "lucide-react";
import { getBuildings, getBuildingDetail, type BuildingInfo, type BuildingDetail as BuildingDetailType, type TimeSlot } from "@/lib/freeclassroom";

const CAMPUS_ORDER = ["望江校区", "江安校区", "华西校区"];
const TIME_SLOTS = ["一大节", "二大节", "三大节", "四大节", "五大节"];

function groupByCampus(buildings: BuildingInfo[]): Map<string, BuildingInfo[]> {
  const groups = new Map<string, BuildingInfo[]>();
  for (const b of buildings) {
    const list = groups.get(b.campus_name) || [];
    list.push(b);
    groups.set(b.campus_name, list);
  }
  return groups;
}

export default function FreeClassroomPage() {
  const [buildings, setBuildings] = useState<BuildingInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingDetailType | null>(null);
  const [buildingLoading, setBuildingLoading] = useState(false);

  const fetchBuildings = useCallback(async () => {
    try {
      const data = await getBuildings();
      setBuildings(data.buildings);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBuildings();
  }, [fetchBuildings]);

  async function handleSelectBuilding(location: string) {
    setBuildingLoading(true);
    try {
      const detail = await getBuildingDetail(location);
      setSelectedBuilding(detail);
    } catch {
      // silently fail
    } finally {
      setBuildingLoading(false);
    }
  }

  function handleBack() {
    setSelectedBuilding(null);
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (selectedBuilding) {
    return (
      <BuildingDetailView
        detail={selectedBuilding}
        onBack={handleBack}
        loading={buildingLoading}
      />
    );
  }

  const grouped = groupByCampus(buildings);
  const sortedGroups = CAMPUS_ORDER.filter((c) => grouped.has(c)).map((c) => [c, grouped.get(c)!] as const);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
            <Building2 className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold">空闲教室</h1>
            <p className="text-xs text-muted-foreground">
              选择教学楼查看今日空闲教室
            </p>
          </div>
        </div>
      </div>

      {/* Building Grid */}
      <div className="space-y-4">
        {sortedGroups.map(([campusName, campusBuildings]) => (
          <div key={campusName}>
            <div className="mb-2 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-muted-foreground">{campusName}</h2>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {campusBuildings.map((b) => (
                <button
                  key={b.location}
                  onClick={() => handleSelectBuilding(b.location)}
                  className="group relative flex flex-col items-center justify-center rounded-xl bg-white p-4 text-center shadow-sm ring-1 ring-black/[0.04] transition-all hover:shadow-md hover:ring-emerald-500/30 dark:bg-gray-900 dark:ring-white/[0.06] dark:hover:ring-emerald-400/30"
                >
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 transition-all group-hover:bg-emerald-500/20">
                    <GraduationCap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="text-sm font-medium">{b.name}</span>
                  <span className="mt-0.5 text-[10px] text-muted-foreground">{b.campus_name}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        数据来源：四川大学教室状态查询系统（与教务系统数据同步）
      </p>
    </div>
  );
}

function BuildingDetailView({
  detail,
  onBack,
  loading,
}: {
  detail: BuildingDetailType;
  onBack: () => void;
  loading: boolean;
}) {
  const freeRoomsBySlot = TIME_SLOTS.map(() => 0);
  for (const room of detail.classrooms) {
    room.time_slots.forEach((slot, idx) => {
      if (slot.is_free && idx < freeRoomsBySlot.length) {
        freeRoomsBySlot[idx]++;
      }
    });
  }

  const totalFreeRooms = freeRoomsBySlot.reduce((a, b) => a + b, 0);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/40 transition-colors hover:bg-muted/60"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
            <Building2 className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{detail.name}</h1>
            <p className="text-xs text-muted-foreground">
              {detail.campus_name} · {detail.classrooms.length} 间教室 · 当前空闲 {totalFreeRooms} 间
            </p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-2">
        {TIME_SLOTS.map((name, idx) => (
          <div
            key={name}
            className="rounded-xl bg-white p-3 text-center shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]"
          >
            <div className="text-xs font-medium text-muted-foreground">{name}</div>
            <div className={`mt-1 text-lg font-bold ${freeRoomsBySlot[idx] > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
              {freeRoomsBySlot[idx]}
            </div>
            <div className="text-[10px] text-muted-foreground">空闲</div>
          </div>
        ))}
      </div>

      {/* Classroom Table */}
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-border/40">
              <th className="sticky left-0 z-10 bg-white px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground dark:bg-gray-900">
                教室
              </th>
              <th className="px-2 py-2.5 text-center text-xs font-semibold text-muted-foreground">座位</th>
              {TIME_SLOTS.map((name) => (
                <th
                  key={name}
                  className="px-2 py-2.5 text-center text-xs font-semibold text-muted-foreground"
                >
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {detail.classrooms.map((room) => (
              <tr
                key={room.name}
                className="border-b border-border/20 transition-colors hover:bg-muted/20 last:border-b-0"
              >
                <td className="sticky left-0 z-10 bg-white px-3 py-2 dark:bg-gray-900">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium">{room.name}</span>
                  </div>
                </td>
                <td className="px-2 py-2 text-center">
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {room.seats ?? "-"}
                  </span>
                </td>
                {room.time_slots.map((slot, idx) => (
                  <td key={idx} className="px-1 py-1.5 text-center">
                    <SlotCell slot={slot} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 text-xs text-muted-foreground shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
        <span className="font-medium">图例：</span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-emerald-100 dark:bg-emerald-900/40" />
          空闲
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-red-100 dark:bg-red-900/40" />
          占用
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-amber-100 dark:bg-amber-900/40" />
          借用/考试
        </span>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        数据来源：四川大学教室状态查询系统（与教务系统数据同步）
      </p>
    </div>
  );
}

function SlotCell({ slot }: { slot: TimeSlot }) {
  if (slot.is_free) {
    return (
      <span className="inline-flex h-7 w-full items-center justify-center rounded-md bg-emerald-100 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
        空
      </span>
    );
  }

  const isBorrow = slot.course_name?.includes("借用");
  const isExam = slot.course_name?.includes("考试");

  let bg = "bg-red-100 dark:bg-red-900/40";
  let textColor = "text-red-700 dark:text-red-300";
  if (isBorrow || isExam) {
    bg = "bg-amber-100 dark:bg-amber-900/40";
    textColor = "text-amber-700 dark:text-amber-300";
  }

  return (
    <div className="group relative">
      <span className={`inline-flex h-7 w-full items-center justify-center rounded-md ${bg} ${textColor} text-xs font-medium`}>
        {isBorrow ? "借" : isExam ? "考" : "用"}
      </span>
      {(slot.course_name || slot.teacher) && (
        <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 w-48 -translate-x-1/2 rounded-lg bg-gray-900 p-2 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:bg-gray-700">
          {slot.course_name && <p className="font-medium">{slot.course_name}</p>}
          {slot.teacher && <p className="mt-0.5 text-gray-300">{slot.teacher}</p>}
        </div>
      )}
    </div>
  );
}