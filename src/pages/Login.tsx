import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { profileApi } from '@/db/api';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // 登录表单
  const [loginForm, setLoginForm] = useState({
    account: '',
    password: ''
  });

  // 密码登录（支持用户名/手机号）
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!loginForm.account || !loginForm.password) {
      toast.error('请填写完整信息');
      return;
    }

    setIsLoading(true);
    try {
      // 使用自定义验证
      const profile = await profileApi.validatePasswordLogin(loginForm.account, loginForm.password);
      
      if (!profile) {
        toast.error('账号或密码错误');
        return;
      }

      // 创建用户会话
      const userSession = {
        id: profile.id,
        phone: profile.phone,
        username: profile.username,
        user_metadata: {
          username: profile.username,
          phone: profile.phone
        },
        app_metadata: {},
        aud: 'authenticated',
        created_at: profile.created_at,
        updated_at: new Date().toISOString()
      };
      
      // 将用户信息存储到localStorage进行会话管理
      localStorage.setItem('authenticated_user', JSON.stringify(userSession));
      localStorage.setItem('is_password_login', 'true');
      
      // 触发自定义事件通知其他组件localStorage已更新
      window.dispatchEvent(new Event('localStorageChange'));
      
      toast.success('登录成功');
      
      // 导航到首页
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 100);
      
    } catch (error) {
      console.error('登录失败:', error);
      toast.error('登录失败，请检查账号和密码');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-900">
            班主任签到量化统计系统
          </CardTitle>
          <CardDescription>
            请登录以继续使用系统
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-account">账号</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="login-account"
                  type="text"
                  placeholder="用户名或手机号"
                  value={loginForm.account}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, account: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="login-password">密码</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="请输入密码"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                  className="pl-10 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? '登录中...' : '登录'}
            </Button>
            
            <div className="text-center text-sm text-gray-600">
              <p>支持用户名或手机号登录</p>
              <p className="mt-1 text-xs text-gray-500">新用户请联系管理员添加账号</p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
