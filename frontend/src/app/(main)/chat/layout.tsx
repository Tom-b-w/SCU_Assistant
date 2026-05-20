export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    // 确保底层背景色纯净
    <div className="-mx-6 -mt-6 flex h-[calc(100%+1.5rem)] flex-col overflow-hidden md:-m-6 md:h-[calc(100%+3rem)] bg-white dark:bg-zinc-950">
      {children}
    </div>
  );
}