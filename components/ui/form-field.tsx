"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  children: ReactNode;
  error?: string;
  className?: string;
}

export function FormField({ children, error, className }: FormFieldProps) {
  return (
    <div className={cn("space-y-1", className)}>
      {children}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
