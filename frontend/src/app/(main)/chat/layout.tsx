export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="-m-6 flex h-[calc(100%+3rem)] flex-col md:-mb-6 md:h-[calc(100%+1.5rem)]">
      {children}
    </div>
  );
}
