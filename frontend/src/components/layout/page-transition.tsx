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
      setIsVisible(false);
      // 短暂隐藏后触发入场动画
      const timer = setTimeout(() => {
        setIsVisible(true);
        prevPathname.current = pathname;
      }, 50);
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
