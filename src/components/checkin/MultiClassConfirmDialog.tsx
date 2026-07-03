import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MultiClassConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacherName: string;
  classes: string[];
  action: 'delete' | 'add';
  date: string;
  onConfirm: (applyToAll: boolean) => void;
}

export function MultiClassConfirmDialog({
  open,
  onOpenChange,
  teacherName,
  classes,
  action,
  date,
  onConfirm
}: MultiClassConfirmDialogProps) {
  const actionText = action === 'delete' ? '删除' : '添加';
  
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>多班联动确认</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              教师 <span className="font-semibold text-foreground">{teacherName}</span> 担任多个班级的班主任：
            </p>
            <div className="pl-4">
              {classes.map((cls, idx) => (
                <div key={idx} className="text-sm">• {cls}</div>
              ))}
            </div>
            <p className="pt-2">
              是否将 <span className="font-semibold text-foreground">{date}</span> 的签到记录{actionText}操作应用到所有班级？
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onConfirm(false)}>
            仅当前班级
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(true)}>
            应用到所有班级
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
