import { cn } from '@/lib/utils';

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export function Table({ children, className }: TableProps) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function Thead({ children }: { children: React.ReactNode }) {
  return <thead className="bg-slate-50 border-b border-slate-200">{children}</thead>;
}

export function Th({ children, className }: TableProps) {
  return (
    <th className={cn('px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider', className)}>
      {children}
    </th>
  );
}

export function Td({ children, className }: TableProps) {
  return (
    <td className={cn('px-4 py-3 text-slate-700', className)}>
      {children}
    </td>
  );
}

export function Tr({ children, className }: TableProps) {
  return (
    <tr className={cn('border-b border-slate-100 hover:bg-slate-50', className)}>
      {children}
    </tr>
  );
}
