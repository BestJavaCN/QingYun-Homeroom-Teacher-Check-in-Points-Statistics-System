import Dashboard from './pages/Dashboard';
import ClassManagement from './pages/ClassManagement';
import CheckInStatistics from './pages/CheckInStatistics';
import UserProfile from './pages/UserProfile';
import UserManagement from './pages/UserManagement';
import type { ReactNode } from 'react';

interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
}

const routes: RouteConfig[] = [
  {
    name: '系统首页',
    path: '/',
    element: <Dashboard />
  },
  {
    name: '班级管理',
    path: '/class-management',
    element: <ClassManagement />
  },
  {
    name: '签到统计',
    path: '/check-in-statistics',
    element: <CheckInStatistics />
  },
  {
    name: '用户管理',
    path: '/user-management',
    element: <UserManagement />
  },
  {
    name: '个人资料',
    path: '/user-profile',
    element: <UserProfile />,
    visible: false
  }
];

export default routes;