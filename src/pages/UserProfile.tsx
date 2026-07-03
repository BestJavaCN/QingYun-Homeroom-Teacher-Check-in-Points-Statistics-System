import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { User, Phone, Lock, Save } from 'lucide-react';
import { profileApi } from '@/db/api';
import { useNavigate } from 'react-router-dom';

export default function UserProfile() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  
  // 用户信息表单
  const [userForm, setUserForm] = useState({
    username: '',
    phone: ''
  });
  
  // 密码修改表单
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // 加载用户信息
  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const userStr = localStorage.getItem('authenticated_user');
      if (!userStr) {
        toast.error('未登录');
        navigate('/login');
        return;
      }

      const user = JSON.parse(userStr);
      const userProfile = await profileApi.getProfileById(user.id);
      
      if (userProfile) {
        setProfile(userProfile);
        setUserForm({
          username: userProfile.username || '',
          phone: userProfile.phone || ''
        });
      }
    } catch (error) {
      console.error('加载用户信息失败:', error);
      toast.error('加载用户信息失败');
    }
  };

  // 更新用户信息
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userForm.username) {
      toast.error('用户名不能为空');
      return;
    }

    if (!userForm.phone) {
      toast.error('手机号不能为空');
      return;
    }

    // 验证手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(userForm.phone)) {
      toast.error('请输入正确的手机号格式');
      return;
    }

    setIsLoading(true);
    try {
      const success = await profileApi.updateProfile(profile.id, {
        username: userForm.username,
        phone: userForm.phone
      });

      if (!success) {
        toast.error('更新失败');
        return;
      }

      toast.success('用户信息更新成功');
      
      const userStr = localStorage.getItem('authenticated_user');
      if (userStr) {
        const user = JSON.parse(userStr);
        user.username = userForm.username;
        user.phone = userForm.phone;
        localStorage.setItem('authenticated_user', JSON.stringify(user));
      }
      
      await loadUserProfile();
      
    } catch (error) {
      console.error('更新用户信息失败:', error);
      toast.error('更新失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast.error('请填写完整信息');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error('新密码长度至少为6位');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('两次输入的新密码不一致');
      return;
    }

    setIsLoading(true);
    try {
      if (profile.password !== passwordForm.currentPassword) {
        toast.error('当前密码错误');
        setIsLoading(false);
        return;
      }

      const success = await profileApi.updateProfile(profile.id, {
        password: passwordForm.newPassword
      });

      if (!success) {
        toast.error('修改密码失败');
        return;
      }

      toast.success('密码修改成功');
      
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      await loadUserProfile();
      
    } catch (error) {
      console.error('修改密码失败:', error);
      toast.error('修改密码失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  if (!profile) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">加载中...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">个人资料</h1>
        <p className="text-gray-600 mt-2">管理您的个人信息和账号设置</p>
      </div>

      <div className="grid gap-6">
        {/* 基本信息 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              基本信息
            </CardTitle>
            <CardDescription>
              设置您的用户名和联系方式
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">用户名</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="请输入用户名"
                    value={userForm.username}
                    onChange={(e) => setUserForm(prev => ({ ...prev, username: e.target.value }))}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">手机号</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="请输入手机号"
                    value={userForm.phone}
                    onChange={(e) => setUserForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="pl-10"
                  />
                </div>
              </div>

              <Button type="submit" disabled={isLoading}>
                <Save className="mr-2 h-4 w-4" />
                {isLoading ? '保存中...' : '保存更改'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* 修改密码 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              修改密码
            </CardTitle>
            <CardDescription>
              定期修改密码以保护账号安全
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">当前密码</Label>
                <Input
                  id="current-password"
                  type="password"
                  placeholder="请输入当前密码"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password">新密码</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="请输入新密码（至少6位）"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">确认新密码</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="请再次输入新密码"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                />
              </div>

              <Button type="submit" disabled={isLoading}>
                <Lock className="mr-2 h-4 w-4" />
                {isLoading ? '修改中...' : '修改密码'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* 账号信息 */}
        <Card>
          <CardHeader>
            <CardTitle>账号信息</CardTitle>
            <CardDescription>
              您的账号详细信息
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">账号ID</span>
              <span className="font-mono text-sm">{profile.id}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">角色</span>
              <span className="font-medium">{profile.role === 'admin' ? '管理员' : '普通用户'}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">注册时间</span>
              <span>{new Date(profile.created_at).toLocaleString('zh-CN')}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600">最后更新</span>
              <span>{new Date(profile.updated_at).toLocaleString('zh-CN')}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
