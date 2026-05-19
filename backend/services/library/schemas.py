from pydantic import BaseModel
from datetime import date


class BookItem(BaseModel):
    title: str
    author: str
    publisher: str
    isbn: str
    call_number: str
    location: str
    status: str
    available: bool
    year: str = ""


class BookSearchResult(BaseModel):
    keyword: str
    total: int
    books: list[BookItem]
    page: int = 1
    page_size: int = 20
    total_count: int = 0


class BorrowedBook(BaseModel):
    title: str
    author: str
    call_number: str
    borrow_date: str
    due_date: str
    renew_count: int
    days_remaining: int
    is_overdue: bool
    overdue_days: int


class PersonalBorrowing(BaseModel):
    total_borrowed: int
    overdue_count: int
    books: list[BorrowedBook]


class DueReminder(BaseModel):
    today_overdue: list[BorrowedBook]
    week_due: list[BorrowedBook]
    normal: list[BorrowedBook]