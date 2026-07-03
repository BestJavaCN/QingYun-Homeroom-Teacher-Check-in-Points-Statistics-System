import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Upload, Download, School, FileSpreadsheet } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { classApi } from '@/db/api';
import { parseExcelFile, exportToExcel } from '@/utils/excel';
import type { Class, ClassFormData } from '@/types/types';

export default function ClassManagement() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedClasses, setSelectedClasses] = useState<Set<string>>(new Set());
  const [isBatchDeleteDialogOpen, setIsBatchDeleteDialogOpen] = useState(false);

  const form = useForm<ClassFormData>({
    defaultValues: {
      class_name: '',
      teacher_name: ''
    }
  });

  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
    try {
      setLoading(true);
      const data = await classApi.getAllClasses();
      setClasses(data);
    } catch (error) {
      console.error('加载班级列表失败:', error);
      toast.error('加载班级列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: ClassFormData) => {
    try {
      let success = false;
      if (editingClass) {
        success = await classApi.updateClass(editingClass.id, data);
        if (success) {
          toast.success('班级信息更新成功');
        }
      } else {
        success = await classApi.createClass(data);
        if (success) {
          toast.success('班级创建成功');
        }
      }

      if (success) {
        setIsDialogOpen(false);
        setEditingClass(null);
        form.reset();
        await loadClasses();
      } else {
        toast.error(editingClass ? '更新班级失败' : '创建班级失败');
      }
    } catch (error) {
      console.error('操作失败:', error);
      toast.error('操作失败');
    }
  };

  const handleEdit = (cls: Class) => {
    setEditingClass(cls);
    form.setValue('class_name', cls.class_name);
    form.setValue('teacher_name', cls.teacher_name);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const success = await classApi.deleteClass(id);
      if (success) {
        toast.success('班级删除成功');
        await loadClasses();
      } else {
        toast.error('删除班级失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      toast.error('删除失败');
    }
  };

  // 批量删除处理函数
  const handleBatchDelete = async () => {
    if (selectedClasses.size === 0) {
      toast.error('请选择要删除的班级');
      return;
    }

    try {
      const deletePromises = Array.from(selectedClasses).map(id => classApi.deleteClass(id));
      const results = await Promise.all(deletePromises);
      
      const successCount = results.filter(result => result).length;
      const failCount = results.length - successCount;

      if (successCount > 0) {
        toast.success(`成功删除 ${successCount} 个班级${failCount > 0 ? `，${failCount} 个删除失败` : ''}`);
      } else {
        toast.error('批量删除失败');
      }

      setSelectedClasses(new Set());
      setIsBatchDeleteDialogOpen(false);
      await loadClasses();
    } catch (error) {
      console.error('批量删除失败:', error);
      toast.error('批量删除失败');
    }
  };

  // 全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedClasses(new Set(classes.map(cls => cls.id)));
    } else {
      setSelectedClasses(new Set());
    }
  };

  // 单个选择
  const handleSelectClass = (classId: string, checked: boolean) => {
    const newSelected = new Set(selectedClasses);
    if (checked) {
      newSelected.add(classId);
    } else {
      newSelected.delete(classId);
    }
    setSelectedClasses(newSelected);
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await parseExcelFile(file);
      
      // 验证数据格式
      const validData: ClassFormData[] = [];
      const errors: string[] = [];

      data.forEach((row, index) => {
        // 支持多种可能的列名
        const className = row.班级 || row['班级名称'] || row['班级'] || row.class || row.Class;
        const teacherName = row.姓名 || row['班主任'] || row['教师姓名'] || row['班主任姓名'] || row.teacher || row.Teacher || row.name || row.Name;
        
        if (!className || !teacherName) {
          errors.push(`第${index + 2}行：班级或班主任信息缺失（班级：${className || '空'}，班主任：${teacherName || '空'}）`);
          return;
        }

        validData.push({
          class_name: String(className).trim(),
          teacher_name: String(teacherName).trim()
        });
      });

      if (errors.length > 0) {
        toast.error(`数据验证失败：${errors.join('; ')}`);
        return;
      }

      if (validData.length === 0) {
        toast.error('未找到有效的班级数据');
        return;
      }

      // 批量导入
      const success = await classApi.createClassesBatch(validData);
      if (success) {
        toast.success(`成功导入 ${validData.length} 条班级信息`);
        setIsImportDialogOpen(false);
        await loadClasses();
      } else {
        toast.error('批量导入失败');
      }
    } catch (error) {
      console.error('导入失败:', error);
      toast.error('文件解析失败，请检查文件格式');
    }

    // 清空文件输入
    event.target.value = '';
  };

  const handleExport = () => {
    const exportData = classes.map(cls => ({
      班级: cls.class_name,
      班主任: cls.teacher_name,
      创建时间: new Date(cls.created_at).toLocaleString()
    }));

    exportToExcel(exportData, '班级信息.xlsx', '班级列表');
    toast.success('导出成功');
  };

  const openCreateDialog = () => {
    setEditingClass(null);
    form.reset();
    setIsDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="container mx-auto p-6 space-y-6">
        {/* 页面头部 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
            {/* 左侧标题 */}
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg">
                <School className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent whitespace-nowrap">
                班级信息管理
              </h1>
            </div>
            
            {/* 右侧操作按钮 */}
            <div className="flex flex-wrap gap-2">
              {selectedClasses.size > 0 && (
                <AlertDialog open={isBatchDeleteDialogOpen} onOpenChange={setIsBatchDeleteDialogOpen}>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="mr-2 h-4 w-4" />
                      批量删除 ({selectedClasses.size})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>确认批量删除</AlertDialogTitle>
                      <AlertDialogDescription>
                        确定要删除选中的 {selectedClasses.size} 个班级吗？此操作不可撤销。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction onClick={handleBatchDelete}>
                        删除
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <Button onClick={handleExport} variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                导出Excel
              </Button>
              <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Upload className="mr-2 h-4 w-4" />
                    导入Excel
                  </Button>
                </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>导入班级信息</DialogTitle>
                <DialogDescription>
                  请选择包含班级和班主任信息的Excel文件。文件应包含"班级"和"姓名"列。
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="excel-file">选择Excel文件</Label>
                  <Input
                    id="excel-file"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileImport}
                    className="mt-2"
                  />
                </div>
                <div className="text-sm text-gray-600">
                  <p>文件格式要求：</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Excel格式（.xlsx 或 .xls）</li>
                    <li>第一行为表头</li>
                    <li>必须包含"班级"和"姓名"列</li>
                  </ul>
                </div>
              </div>
              </DialogContent>
            </Dialog>
            <Button onClick={openCreateDialog} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              添加班级
            </Button>
          </div>
        </div>
      </div>

      <Card className="shadow-lg border-0">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-6 w-6 text-blue-600" />
              <CardTitle className="text-xl">班级列表</CardTitle>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-200">
                {classes.length} 个班级
              </Badge>
              <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-200">
                {new Set(classes.map(c => c.teacher_name)).size} 位班主任
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={classes.length > 0 && selectedClasses.size === classes.length}
                      onCheckedChange={handleSelectAll}
                      aria-label="全选"
                    />
                  </TableHead>
                  <TableHead className="font-semibold text-gray-700">班级</TableHead>
                  <TableHead className="font-semibold text-gray-700">班主任</TableHead>
                  <TableHead className="font-semibold text-gray-700">创建时间</TableHead>
                  <TableHead className="font-semibold text-gray-700">更新时间</TableHead>
                  <TableHead className="font-semibold text-gray-700">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classes.map((cls, index) => (
                  <TableRow 
                    key={cls.id}
                    className={`hover:bg-blue-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedClasses.has(cls.id)}
                        onCheckedChange={(checked) => handleSelectClass(cls.id, checked as boolean)}
                        aria-label={`选择班级 ${cls.class_name}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{cls.class_name}</TableCell>
                  <TableCell>{cls.teacher_name}</TableCell>
                  <TableCell>{new Date(cls.created_at).toLocaleString()}</TableCell>
                  <TableCell>{new Date(cls.updated_at).toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(cls)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>确认删除</AlertDialogTitle>
                            <AlertDialogDescription>
                              确定要删除班级"{cls.class_name}"吗？此操作不可撤销。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(cls.id)}>
                              删除
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {classes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    暂无班级信息，请添加班级
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>

      {/* 添加/编辑班级对话框 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingClass ? '编辑班级' : '添加班级'}
            </DialogTitle>
            <DialogDescription>
              {editingClass ? '修改班级信息' : '添加新的班级信息'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="class_name"
                rules={{ required: '请输入班级名称' }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>班级名称</FormLabel>
                    <FormControl>
                      <Input placeholder="如：高一(1)班" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="teacher_name"
                rules={{ required: '请输入班主任姓名' }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>班主任姓名</FormLabel>
                    <FormControl>
                      <Input placeholder="如：张老师" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  取消
                </Button>
                <Button type="submit">
                  {editingClass ? '更新' : '添加'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}