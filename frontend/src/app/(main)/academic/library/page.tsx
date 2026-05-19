"use client";

import { useState, useCallback } from "react";
import {
  Search,
  Bell,
  Library,
  BookMarked,
  AlertTriangle,
  Clock,
  CheckCircle2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  searchBooks,
  getPersonalBorrowing,
  getDueReminders,
  type BookSearchResult,
  type PersonalBorrowing,
  type DueReminder,
  type BorrowedBook,
} from "@/lib/library";

type Tab = "search" | "borrowing" | "reminders";

export default function LibraryPage() {
  const [activeTab, setActiveTab] = useState<Tab>("search");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResult, setSearchResult] = useState<BookSearchResult | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [borrowing, setBorrowing] = useState<PersonalBorrowing | null>(null);
  const [borrowingLoading, setBorrowingLoading] = useState(false);
  const [borrowingError, setBorrowingError] = useState("");
  const [reminders, setReminders] = useState<DueReminder | null>(null);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [remindersError, setRemindersError] = useState("");

  const handleSearch = useCallback(async (page = 1) => {
    if (!searchKeyword.trim()) return;
    setSearchLoading(true);
    setSearchError("");
    setCurrentPage(page);
    try {
      const data = await searchBooks(searchKeyword.trim(), page);
      setSearchResult(data);
    } catch {
      setSearchError("检索失败，请稍后重试");
    } finally {
      setSearchLoading(false);
    }
  }, [searchKeyword]);

  const handlePageChange = useCallback((page: number) => {
    handleSearch(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [handleSearch]);

  const fetchBorrowing = useCallback(async () => {
    setBorrowingLoading(true);
    setBorrowingError("");
    try {
      const data = await getPersonalBorrowing();
      setBorrowing(data);
    } catch {
      setBorrowingError("获取借阅信息失败，请稍后重试");
    } finally {
      setBorrowingLoading(false);
    }
  }, []);

  const fetchReminders = useCallback(async () => {
    setRemindersLoading(true);
    setRemindersError("");
    try {
      const data = await getDueReminders();
      setReminders(data);
    } catch {
      setRemindersError("获取到期提醒失败，请稍后重试");
    } finally {
      setRemindersLoading(false);
    }
  }, []);

  const handleTabChange = useCallback((tab: Tab) => {
    setActiveTab(tab);
    if (tab === "borrowing") {
      fetchBorrowing();
    }
    if (tab === "reminders") {
      fetchReminders();
    }
  }, [fetchBorrowing, fetchReminders]);

  const tabs: { key: Tab; label: string; icon: typeof Search }[] = [
    { key: "search", label: "图书检索", icon: Search },
    { key: "borrowing", label: "个人借阅", icon: BookMarked },
    { key: "reminders", label: "到期提醒", icon: Bell },
  ];

  const totalPages = searchResult ? Math.ceil(searchResult.total_count / searchResult.page_size) : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
            <Library className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold">四川大学图书馆</h1>
            <p className="text-xs text-muted-foreground">图书检索 · 个人借阅 · 到期提醒</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-muted/50 p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                isActive
                  ? "bg-white text-emerald-600 shadow-sm dark:bg-gray-800 dark:text-emerald-400"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "search" && (
        <SearchTab
          keyword={searchKeyword}
          onKeywordChange={setSearchKeyword}
          onSearch={() => handleSearch(1)}
          loading={searchLoading}
          error={searchError}
          result={searchResult}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      )}
      {activeTab === "borrowing" && (
        <BorrowingTab
          data={borrowing}
          loading={borrowingLoading}
          error={borrowingError}
          onRefresh={fetchBorrowing}
        />
      )}
      {activeTab === "reminders" && (
        <RemindersTab
          data={reminders}
          loading={remindersLoading}
          error={remindersError}
          onRefresh={fetchReminders}
        />
      )}
    </div>
  );
}

/* ====== Search Tab ====== */
function SearchTab({
  keyword,
  onKeywordChange,
  onSearch,
  loading,
  error,
  result,
  currentPage,
  totalPages,
  onPageChange,
}: {
  keyword: string;
  onKeywordChange: (v: string) => void;
  onSearch: () => void;
  loading: boolean;
  error: string;
  result: BookSearchResult | null;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => onKeywordChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearch()}
            placeholder="输入书名、作者或关键词检索馆藏..."
            className="h-10 w-full rounded-xl border border-border bg-white pl-9 pr-4 text-sm outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:bg-gray-900"
          />
        </div>
        <button
          onClick={onSearch}
          disabled={loading || !keyword.trim()}
          className="flex h-10 items-center gap-1.5 rounded-xl bg-emerald-500 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
        >
          {loading ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          检索
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 p-4 text-center text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {result && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              共找到 <span className="font-medium text-foreground">{result.total_count}</span> 条结果
              ，当前第 {currentPage}/{totalPages} 页
            </p>
          </div>
          <div className="space-y-2">
            {result.books.map((book, idx) => (
              <div
                key={idx}
                className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/[0.04] transition-colors hover:ring-emerald-500/20 dark:bg-gray-900 dark:ring-white/[0.06]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold leading-snug">{book.title}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">{book.author}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                      {book.year && <span>{book.year}</span>}
                      <span>{book.publisher}</span>
                      {book.isbn && <span>ISBN: {book.isbn}</span>}
                      <span>索书号: {book.call_number}</span>
                      <span>馆藏: {book.location}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                        book.available
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                      }`}
                    >
                      {book.status || (book.available ? "在馆" : "借出")}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 pt-2">
              <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage <= 1 || loading}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 7) {
                  pageNum = i + 1;
                } else if (currentPage <= 4) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 3) {
                  pageNum = totalPages - 6 + i;
                } else {
                  pageNum = currentPage - 3 + i;
                }
                const isActive = pageNum === currentPage;
                return (
                  <button
                    key={pageNum}
                    onClick={() => onPageChange(pageNum)}
                    disabled={loading}
                    className={`flex h-8 min-w-[2rem] items-center justify-center rounded-lg px-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-emerald-500 text-white"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage >= totalPages || loading}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ====== Borrowing Tab ====== */
function BorrowingTab({
  data,
  loading,
  error,
  onRefresh,
}: {
  data: PersonalBorrowing | null;
  loading: boolean;
  error: string;
  onRefresh: () => void;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>正在获取借阅信息...</span>
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-red-500/10 p-4 text-center text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
        <button
          onClick={onRefresh}
          className="mx-auto flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-600"
        >
          <RefreshCw className="h-4 w-4" />
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">
            共借阅 <strong className="text-foreground">{data?.total_borrowed ?? 0}</strong> 册
          </span>
          {(data?.overdue_count ?? 0) > 0 && (
            <span className="text-red-500">
              逾期 <strong>{data?.overdue_count}</strong> 册
            </span>
          )}
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          刷新
        </button>
      </div>

      {data && data.books.length > 0 && (
        <div className="space-y-2">
          {data.books.map((book, idx) => (
            <BorrowedBookCard key={idx} book={book} />
          ))}
        </div>
      )}

      {data && data.books.length === 0 && (
        <div className="rounded-xl bg-muted/50 p-8 text-center text-sm text-muted-foreground">
          暂无借阅记录
        </div>
      )}
    </div>
  );
}

/* ====== Reminders Tab ====== */
function RemindersTab({
  data,
  loading,
  error,
  onRefresh,
}: {
  data: DueReminder | null;
  loading: boolean;
  error: string;
  onRefresh: () => void;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>正在获取到期提醒...</span>
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-red-500/10 p-4 text-center text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
        <button
          onClick={onRefresh}
          className="mx-auto flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-600"
        >
          <RefreshCw className="h-4 w-4" />
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          基于个人借阅数据计算到期提醒
        </p>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          刷新
        </button>
      </div>

      {data && (
        <div className="space-y-4">
          {/* Overdue */}
          {data.today_overdue.length > 0 && (
            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-red-500">
                <AlertTriangle className="h-4 w-4" />
                已逾期（{data.today_overdue.length} 册）
              </h3>
              <div className="space-y-2">
                {data.today_overdue.map((book, idx) => (
                  <BorrowedBookCard key={`overdue-${idx}`} book={book} />
                ))}
              </div>
            </div>
          )}

          {/* Due within a week */}
          {data.week_due.length > 0 && (
            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-orange-500">
                <Clock className="h-4 w-4" />
                即将到期（{data.week_due.length} 册）
              </h3>
              <div className="space-y-2">
                {data.week_due.map((book, idx) => (
                  <BorrowedBookCard key={`week-${idx}`} book={book} />
                ))}
              </div>
            </div>
          )}

          {/* Normal */}
          {data.normal.length > 0 && (
            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-emerald-500">
                <CheckCircle2 className="h-4 w-4" />
                正常在借（{data.normal.length} 册）
              </h3>
              <div className="space-y-2">
                {data.normal.map((book, idx) => (
                  <BorrowedBookCard key={`normal-${idx}`} book={book} />
                ))}
              </div>
            </div>
          )}

          {data.today_overdue.length === 0 && data.week_due.length === 0 && data.normal.length === 0 && (
            <div className="rounded-xl bg-muted/50 p-8 text-center text-sm text-muted-foreground">
              暂无借阅记录
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ====== Shared Card ====== */
function BorrowedBookCard({ book }: { book: BorrowedBook }) {
  const statusColor = book.is_overdue
    ? "border-l-red-500"
    : book.days_remaining <= 7
      ? "border-l-orange-500"
      : "border-l-emerald-500";

  const statusLabel = book.is_overdue
    ? `已逾期 ${book.overdue_days} 天`
    : `还剩 ${book.days_remaining} 天`;

  return (
    <div
      className={`rounded-xl border-l-4 bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06] ${statusColor}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-snug">{book.title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{book.author}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span>索书号: {book.call_number}</span>
            <span>借于: {book.borrow_date}</span>
            <span>应还: {book.due_date}</span>
            <span>续借: {book.renew_count} 次</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <span
            className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
              book.is_overdue
                ? "bg-red-500/10 text-red-600 dark:text-red-400"
                : book.days_remaining <= 7
                  ? "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {statusLabel}
          </span>
        </div>
      </div>
    </div>
  );
}