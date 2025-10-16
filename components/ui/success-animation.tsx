"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle } from "lucide-react";

interface SuccessAnimationProps {
  isVisible: boolean;
  message: string;
  onComplete?: () => void;
  className?: string;
}

export function SuccessAnimation({ 
  isVisible, 
  message, 
  onComplete,
  className 
}: SuccessAnimationProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShow(true);
      const timer = setTimeout(() => {
        setShow(false);
        onComplete?.();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onComplete]);

  if (!show) return null;

  return (
    <div 
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm",
        className
      )}
    >
      <div className="animate-in zoom-in-95 fade-in-0 flex flex-col items-center gap-4 rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900">
        <CheckCircle className="h-12 w-12 text-green-600 animate-in zoom-in-95 slide-in-from-bottom-2" />
        <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
          {message}
        </p>
      </div>
    </div>
  );
}
