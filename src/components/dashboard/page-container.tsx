import { cn } from "@/lib/utils";

export function PageContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("w-full space-y-4 sm:space-y-6", className)}>
      {children}
    </div>
  );
}
