import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { profileApi } from '@/db/api';
import type { Profile } from '@/types/types';

export default function UserManagement() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  
  // 新增用户表单
  const [createForm, setCreateForm] = useState({
    username: '',
    phone: '',
    password: '',
    role: 'user' as 'user' | 'admin'
  });

  // 编辑用户表单
  const [editForm, setEditForm] = useState({
    username: '',
    phone: '',
    password: '',
    role: 'user' as 'user' | 'admin'
  });

  // 检查当前用户权限
  useEffect(() => {
    const checkUserPermission = async () => {
      try {
        const storedUser = localStorage.getItem('authenticated_user');
        if (!storedUser) {
          toast.error('请先登录');
          navigate('/login');
          return;
        }

        const user = JSON.parse(storedUser);
        const profile = await profileApi.getProfileById(user.id);
        
        if (!profile) {
          toast.error('无法获取用户信息');
          navigate('/login');
          return;
        }

        if (profile.role !== 'admin') {
          toast.error('您没有权限访问此页面');
          navigate('/');
          return;
        }

        setCurrentUser(profile);
      } catch (error) {
        console.error('检查用户权限失败:', error);
        toast.error('检查用户权限失败');
        navigate('/login');
      }
    };

    checkUserPermission();
  }, [navigate]);

  // 加载用户列表
  useEffect(() => {
    if (currentUser) {
      loadUsers();
    }
  }, [currentUser]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const allUsers = await profileApi.getAllProfiles();
      setUsers(allUsers);
    } catch (error) {
      console.error('加载用户列表失败:', error);
      toast.error('加载用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 新增用户
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!createForm.username || !createForm.phone || !createForm.password) {
      toast.error('请填写完整信息');
      return;
    }

    // 验证手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(createForm.phone)) {
      toast.error('请输入正确的手机号格式');
      return;
    }

    // 验证密码长度
    if (createForm.password.length < 6) {
      toast.error('密码长度至少为6位');
      return;
    }

    setSubmitting(true);
    try {
      // 检查手机号是否已存在
      const existingUser = await profileApi.getProfileByPhone(createForm.phone);
      if (existingUser) {
        toast.error('该手机号已被使用');
        return;
      }

      // 检查用户名是否已存在
      const existingUsername = await profileApi.getProfileByUsername(createForm.username);
      if (existingUsername) {
        toast.error('该用户名已被使用');
        return;
      }

      const success = await profileApi.createProfile({
          username: createForm.username,
          phone: createForm.phone,
          password: createForm.password,
          role: createForm.role
        });

      if (!success) {
        toast.error('创建用户失败');
        return;
      }

      toast.success('用户创建成功');
      setIsCreateDialogOpen(false);
      setCreateForm({
        username: '',
        phone: '',
        password: '',
        role: 'user'
      });
      loadUsers();
    } catch (error) {
      console.error('创建用户失败:', error);
      toast.error('创建用户失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  // 编辑用户
  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingUser || !editForm.username || !editForm.phone) {
      toast.error('请填写完整信息');
      return;
    }

    // 验证手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(editForm.phone)) {
      toast.error('请输入正确的手机号格式');
      return;
    }

    // 如果修改了密码，验证密码长度
    if (editForm.password && editForm.password.length < 6) {
      toast.error('密码长度至少为6位');
      return;
    }

    // 如果要将管理员改为普通用户，检查是否是最后一个管理员
    if (editingUser.role === 'admin' && editForm.role === 'user') {
      const adminCount = users.filter(u => u.role === 'admin').length;
      if (adminCount <= 1) {
        toast.error('系统至少需要保留一位管理员，无法修改');
        return;
      }
    }

    setSubmitting(true);
    try {
      // 检查手机号是否被其他用户使用
      if (editForm.phone !== editingUser.phone) {
        const existingUser = await profileApi.getProfileByPhone(editForm.phone);
        if (existingUser && existingUser.id !== editingUser.id) {
          toast.error('该手机号已被其他用户使用');
          return;
        }
      }

      // 检查用户名是否被其他用户使用
      if (editForm.username !== editingUser.username) {
        const existingUsername = await profileApi.getProfileByUsername(editForm.username);
        if (existingUsername && existingUsername.id !== editingUser.id) {
          toast.error('该用户名已被其他用户使用');
          return;
        }
      }

      const updateData: any = {
        username: editForm.username,
        phone: editForm.phone,
        role: editForm.role
      };

      if (editForm.password) {
        updateData.password = editForm.password;
      }

      const success = await profileApi.updateProfile(editingUser.id, updateData);

      if (!success) {
        toast.error('更新用户失败');
        return;
      }

      toast.success('用户信息更新成功');
      setIsEditDialogOpen(false);
      setEditingUser(null);
      setEditForm({
        username: '',
        phone: '',
        password: '',
        role: 'user'
      });
      loadUsers();
    } catch (error) {
      console.error('更新用户失败:', error);
      toast.error('更新用户失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  // 删除用户
  const handleDeleteUser = async (userId: string) => {
    if (userId === currentUser?.id) {
      toast.error('不能删除自己的账号');
      return;
    }

    try {
      const success = await profileApi.deleteProfile(userId);

      if (!success) {
        toast.error('删除用户失败');
        return;
      }

      toast.success('用户删除成功');
      loadUsers();
    } catch (error) {
      console.error('删除用户失败:', error);
      toast.error('删除用户失败，请重试');
    }
  };

  // 打开编辑对话框
  const openEditDialog = (user: Profile) => {
    setEditingUser(user);
    setEditForm({
      username: user.username,
      phone: user.phone,
      password: '',
      role: user.role
    });
    setIsEditDialogOpen(true);
  };

  // 过滤用户列表
  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.phone.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">加载中...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">用户管理</h1>
        <p className="text-gray-600 mt-2">管理系统用户和权限</p>
      </div>

      {/* 操作栏 */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="搜索用户名或手机号..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  新增用户
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>新增用户</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="create-username">用户名</Label>
                    <Input
                      id="create-username"
                      placeholder="请输入用户名"
                      value={createForm.username}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, username: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-phone">手机号</Label>
                    <Input
                      id="create-phone"
                      placeholder="请输入手机号"
                      value={createForm.phone}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-password">密码</Label>
                    <Input
                      id="create-password"
                      type="password"
                      placeholder="请输入密码（至少6位）"
                      value={createForm.password}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, password: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-role">角色</Label>
                    <Select
                      value={createForm.role}
                      onValueChange={(value: 'user' | 'admin') => setCreateForm(prev => ({ ...prev, role: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择角色" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">普通用户</SelectItem>
                        <SelectItem value="admin">管理员</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      取消
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting ? '创建中...' : '创建'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* 用户列表 */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户名</TableHead>
                <TableHead>手机号</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-500">
                    暂无用户数据
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell>{user.phone}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {user.role === 'admin' ? '管理员' : '普通用户'}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(user.created_at).toLocaleString('zh-CN')}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(user)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={user.id === currentUser?.id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>确认删除</AlertDialogTitle>
                              <AlertDialogDescription>
                                确定要删除用户 "{user.username}" 吗？此操作无法撤销。
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>取消</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteUser(user.id)}>
                                删除
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 编辑用户对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑用户</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-username">用户名</Label>
              <Input
                id="edit-username"
                placeholder="请输入用户名"
                value={editForm.username}
                onChange={(e) => setEditForm(prev => ({ ...prev, username: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">手机号</Label>
              <Input
                id="edit-phone"
                placeholder="请输入手机号"
                value={editForm.phone}
                onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">密码</Label>
              <Input
                id="edit-password"
                type="password"
                placeholder="留空则不修改密码"
                value={editForm.password}
                onChange={(e) => setEditForm(prev => ({ ...prev, password: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">角色</Label>
              <Select
                value={editForm.role}
                onValueChange={(value: 'user' | 'admin') => setEditForm(prev => ({ ...prev, role: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择角色" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">普通用户</SelectItem>
                  <SelectItem value="admin">管理员</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? '保存中...' : '保存'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
