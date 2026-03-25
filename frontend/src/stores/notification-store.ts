import { create } from "zustand";

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "urgent";
  read: boolean;
  created_at: Date;
}

interface NotificationState {
  notifications: Notification[];
  add: (notification: Omit<Notification, "id" | "read" | "created_at">) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
  unreadCount: () => number;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function generateInitialNotifications(): Notification[] {
  const now = new Date();
  const items: Notification[] = [];

  // 校历事件提醒
  const events = [
    { date: new Date("2026-04-04"), label: "清明节放假" },
    { date: new Date("2026-05-01"), label: "劳动节放假" },
    { date: new Date("2026-05-31"), label: "端午节放假" },
    { date: new Date("2026-06-22"), label: "期末考试周" },
  ];

  // 找到下一个未来事件
  for (const event of events) {
    const diff = Math.ceil(
      (event.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diff > 0 && diff <= 60) {
      items.push({
        id: generateId(),
        title: "校历提醒",
        message: `距离${event.label}还有 ${diff} 天`,
        type: diff <= 7 ? "warning" : "info",
        read: false,
        created_at: new Date(now.getTime() - 1000 * 60 * 30), // 30分钟前
      });
    }
  }

  // 模拟 DDL 提醒
  items.push({
    id: generateId(),
    title: "作业截止提醒",
    message: "《软件工程》课程设计报告将于3天后截止提交",
    type: "urgent",
    read: false,
    created_at: new Date(now.getTime() - 1000 * 60 * 60 * 2), // 2小时前
  });

  items.push({
    id: generateId(),
    title: "选课通知",
    message: "2026年春季学期补选课将于下周一开放",
    type: "info",
    read: false,
    created_at: new Date(now.getTime() - 1000 * 60 * 60 * 5), // 5小时前
  });

  items.push({
    id: generateId(),
    title: "校车调整",
    message: "因道路施工，本周江安→望江线路临时调整发车时间",
    type: "warning",
    read: true,
    created_at: new Date(now.getTime() - 1000 * 60 * 60 * 24), // 1天前
  });

  return items.sort(
    (a, b) => b.created_at.getTime() - a.created_at.getTime()
  );
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: generateInitialNotifications(),

  add: (notification) =>
    set((state) => ({
      notifications: [
        {
          ...notification,
          id: generateId(),
          read: false,
          created_at: new Date(),
        },
        ...state.notifications,
      ],
    })),

  markRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    })),

  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    })),

  clearAll: () => set({ notifications: [] }),

  unreadCount: () => get().notifications.filter((n) => !n.read).length,
}));
