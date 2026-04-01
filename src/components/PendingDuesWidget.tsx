import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface Props {
  members: any[];
  virtualMembers: any[];
  contributions: any[];
  currentTerm: number;
}

const PendingDuesWidget = ({ members, virtualMembers, contributions, currentTerm }: Props) => {
  const allMembers = useMemo(() => {
    const real = members.map((m: any) => ({ id: m.user_id || m.id, name: m.name }));
    const virtual = virtualMembers.map((v: any) => ({ id: v.id, name: v.name }));
    return [...real, ...virtual];
  }, [members, virtualMembers]);

  const { paid, unpaid } = useMemo(() => {
    const paidIds = new Set(
      contributions
        .filter((c: any) => c.term === currentTerm && c.paid)
        .map((c: any) => c.user_id)
    );
    return {
      paid: allMembers.filter(m => paidIds.has(m.id)),
      unpaid: allMembers.filter(m => !paidIds.has(m.id)),
    };
  }, [allMembers, contributions, currentTerm]);

  if (allMembers.length === 0) return null;

  return (
    <Card className={unpaid.length > 0 ? 'border-[hsl(var(--warning))]/40' : 'border-[hsl(var(--success))]/40'}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          {unpaid.length > 0 ? (
            <AlertCircle className="w-4 h-4 text-[hsl(var(--warning))]" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-[hsl(var(--success))]" />
          )}
          Term {currentTerm} Dues — {paid.length}/{allMembers.length} Paid
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {unpaid.map(m => (
            <Badge key={m.id} variant="outline" className="text-xs border-[hsl(var(--warning))]/50 text-[hsl(var(--warning))]">
              {m.name} — Pending
            </Badge>
          ))}
          {paid.map(m => (
            <Badge key={m.id} variant="secondary" className="text-xs bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]">
              {m.name} ✓
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default PendingDuesWidget;
