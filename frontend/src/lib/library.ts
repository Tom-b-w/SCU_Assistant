import { api } from "./api";

export interface BookItem {
  title: string;
  author: string;
  publisher: string;
  isbn: string;
  call_number: string;
  location: string;
  status: string;
  available: boolean;
  year: string;
}

export interface BookSearchResult {
  keyword: string;
  total: number;
  books: BookItem[];
  page: number;
  page_size: number;
  total_count: number;
}

export interface BorrowedBook {
  title: string;
  author: string;
  call_number: string;
  borrow_date: string;
  due_date: string;
  renew_count: number;
  days_remaining: number;
  is_overdue: boolean;
  overdue_days: number;
}

export interface PersonalBorrowing {
  total_borrowed: number;
  overdue_count: number;
  books: BorrowedBook[];
}

export interface DueReminder {
  today_overdue: BorrowedBook[];
  week_due: BorrowedBook[];
  normal: BorrowedBook[];
}

export async function searchBooks(keyword: string, page = 1, pageSize = 20): Promise<BookSearchResult> {
  const { data } = await api.get<BookSearchResult>("/api/library/search", {
    params: { keyword, page, page_size: pageSize },
  });
  return data;
}

/** 获取个人借阅（自动使用已登录账号，无需再次输入密码） */
export async function getPersonalBorrowing(): Promise<PersonalBorrowing> {
  const { data } = await api.get<PersonalBorrowing>("/api/library/borrowing");
  return data;
}

/** 获取到期提醒（自动使用已登录账号） */
export async function getDueReminders(): Promise<DueReminder> {
  const { data } = await api.get<DueReminder>("/api/library/duereminders");
  return data;
}