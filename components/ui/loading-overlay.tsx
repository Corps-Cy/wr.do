"use client";

import { cn } from "@/lib/utils";
import { Icons } from "@/components/shared/icons";

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  className?: string;
}

export function LoadingOverlay({ 
  isLoading, 
  message = "加载中...", 
  className 
}: LoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <div 
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm",
        className
      )}
    >
      <div className="flex flex-col items-center gap-4 rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900">
        <Icons.spinner className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm text-gray-600 dark:text-gray-300">{message}</p>
      </div>
    </div>
  );
}
