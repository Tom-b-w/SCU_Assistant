"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";

/**
 * 页面过渡动画包装器
 * 在路由变化时添加 fade + slide-up 入场动画
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(true);
  const prevPathname = useRef(pathname);

  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      // 页面过渡动画需要先隐藏再显示
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsVisible(false);
      const timer = setTimeout(() => setIsVisible(true), 50);
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  return (
    <div
      className={`transition-all duration-300 ease-out ${
        isVisible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-2"
      }`}
    >
      {children}
    </div>
  );
}
