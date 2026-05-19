import { api } from "./api";

export interface BuildingInfo {
  name: string;
  location: string;
  campus: string;
  campus_name: string;
}

export interface TimeSlot {
  name: string;
  is_free: boolean;
  course_name: string | null;
  teacher: string | null;
}

export interface ClassroomInfo {
  name: string;
  seats: number | null;
  time_slots: TimeSlot[];
}

export interface BuildingDetail {
  name: string;
  location: string;
  campus: string;
  campus_name: string;
  classrooms: ClassroomInfo[];
}

export interface FreeClassroomResponse {
  buildings: BuildingInfo[];
  time_slot_names: string[];
}

export async function getBuildings(): Promise<FreeClassroomResponse> {
  const response = await api.get<FreeClassroomResponse>("/api/freeclassroom/buildings");
  return response.data;
}

export async function getBuildingDetail(location: string): Promise<BuildingDetail> {
  const response = await api.get<BuildingDetail>("/api/freeclassroom/building", {
    params: { location },
  });
  return response.data;
}