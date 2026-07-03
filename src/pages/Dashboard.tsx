import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { FileSpreadsheet, BarChart3, User, Settings, Clock, Moon, Sun, Calendar, Users, School } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { profileApi, classApi } from '@/db/api';
import { useCheckInData } from '@/contexts/CheckInDataContext';
import CheckInChart from '@/components/charts/CheckInChart';
import type { Profile, Class, UserFormData } from '@/types/types';

export default function Dashboard() {
  const { getUploadedRecordCounts, checkInData, totalSummaryData } = useCheckInData();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [totalUsers, setTotalUsers] = useState(0);
  const [currentChartType, setCurrentChartType] = useState<'lunch_break' | 'evening_break' | 'morning_evening_study' | 'weekend_day' | 'total_summary'>('total_summary');

  const setupForm = useForm<UserFormData>({
    defaultValues: {
      username: '',
      password: '',
      confirm_password: ''
    }
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (profile && !profile.username && !profile.password) {
      setShowSetupDialog(true);
    }
  }, [profile]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const profileData = await profileApi.getCurrentProfile();
      setProfile(profileData);
      
      const classesData = await classApi.getAllClasses();
      setClasses(classesData);
      
      const users = await profileApi.getAllProfiles();
      setTotalUsers(users.length);
    } catch (error) {
      console.error('加载数据失败:', error);
      setProfile(null);
      setClasses([]);
      setTotalUsers(0);
    } finally {
      setLoading(false);
    }
  };

  const getTeacherCount = () => {
    const teachers = new Set(classes.map(c => c.teacher_name));
    return teachers.size;
  };

  const getCurrentTypeRecordCount = () => {
    if (currentChartType === 'total_summary') {
      return totalSummaryData.reduce((sum, item) => sum + item.total_count, 0);
    }
    const data = checkInData[currentChartType as keyof typeof checkInData];
    return data.reduce((sum, item) => sum + item.dates.length, 0);
  };

  const handleInitialSetup = async (data: UserFormData) => {
    if (!profile) return;

    if (data.password !== data.confirm_password) {
      toast.error('两次输入的密码不一致');
      return;
    }

    if (!data.username || !data.password) {
      toast.error('请填写用户名和密码');
      return;
    }

    if (data.password.length < 6) {
      toast.error('密码长度至少6位');
      return;
    }

    try {
      const success = await profileApi.updateProfile(profile.id, {
        username: data.username,
        password: data.password
      });

      if (success) {
        toast.success('账户设置完成！');
        setShowSetupDialog(false);
        setupForm.reset();
        await loadData();
      } else {
        toast.error('设置失败，请重试');
      }
    } catch (error) {
      console.error('设置失败:', error);
      toast.error('设置失败');
    }
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

  const recordCounts = getUploadedRecordCounts();

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 系统统计看板 - 5个看板 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {/* 当前用户看板 - 特殊样式 */}
        <Card className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white border-0 shadow-xl hover:shadow-2xl transition-shadow duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-blue-50">当前用户</CardTitle>
            <div className="p-2 bg-white/20 rounded-full backdrop-blur-sm">
              <User className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold truncate mb-2">{profile?.username || profile?.phone || '未设置'}</div>
            <Badge variant="secondary" className="bg-white/25 text-white border-0 backdrop-blur-sm hover:bg-white/30 transition-colors">
              {profile?.role === 'admin' ? '🛡️ 管理员' : '👤 普通用户'}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">班级数</CardTitle>
            <School className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{classes.length}</div>
            <p className="text-xs text-muted-foreground">
              系统中的班级总数
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">班主任数</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getTeacherCount()}</div>
            <p className="text-xs text-muted-foreground">
              系统中的班主任总数
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">系统用户数</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              系统中的用户总数
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              签到记录数
            </CardTitle>
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getCurrentTypeRecordCount()}</div>
            <p className="text-xs text-muted-foreground">
              {currentChartType === 'total_summary' ? '所有类型总记录数' : '当前类型记录数'}
            </p>
          </CardContent>
        </Card>
      </div>
      {/* 统计图表 */}
      <CheckInChart 
        currentType={currentChartType} 
        onTypeChange={setCurrentChartType} 
      />
      {/* 初始设置对话框 */}
      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Settings className="mr-2 h-5 w-5" />
              完善账户信息
            </DialogTitle>
            <DialogDescription>
              欢迎首次登录！请设置您的用户名和密码，以便后续可以使用密码登录。
            </DialogDescription>
          </DialogHeader>
          <Form {...setupForm}>
            <form onSubmit={setupForm.handleSubmit(handleInitialSetup)} className="space-y-4">
              <FormField
                control={setupForm.control}
                name="username"
                rules={{ required: '请输入用户名' }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>用户名</FormLabel>
                    <FormControl>
                      <Input placeholder="请输入用户名" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={setupForm.control}
                name="password"
                rules={{ 
                  required: '请输入密码',
                  minLength: {
                    value: 6,
                    message: '密码长度至少6位'
                  }
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>密码</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="请输入密码" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={setupForm.control}
                name="confirm_password"
                rules={{ required: '请确认密码' }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>确认密码</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="请再次输入密码" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end space-x-2">
                <Button type="submit">
                  完成设置
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};