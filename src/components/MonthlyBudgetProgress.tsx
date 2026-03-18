import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Target } from 'lucide-react';

interface Props {
  monthlyTotal: number;
  budgetTarget: number;
}

const MonthlyBudgetProgress = ({ monthlyTotal, budgetTarget }: Props) => {
  if (!budgetTarget || budgetTarget <= 0) return null;

  const percent = Math.min(100, Math.round((monthlyTotal / budgetTarget) * 100));
  const exceeded = monthlyTotal > budgetTarget;
  const remaining = budgetTarget - monthlyTotal;

  return (
    <Card className={exceeded ? 'border-destructive/50 bg-destructive/5' : ''}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          Monthly Budget Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            ₹{monthlyTotal.toLocaleString()} / ₹{budgetTarget.toLocaleString()}
          </span>
          <span className={`font-medium ${exceeded ? 'text-destructive' : 'text-[hsl(var(--success))]'}`}>
            {exceeded ? `Over by ₹${Math.abs(remaining).toLocaleString()}` : `₹${remaining.toLocaleString()} left`}
          </span>
        </div>
        <Progress
          value={percent}
          className={`h-2.5 ${exceeded ? '[&>div]:bg-destructive' : '[&>div]:bg-primary'}`}
        />
        <p className="text-xs text-muted-foreground">{percent}% of monthly target used</p>
      </CardContent>
    </Card>
  );
};

export default MonthlyBudgetProgress;
