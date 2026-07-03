import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from 'miaoda-auth-react';

interface CustomRequireAuthProps {
  children: React.ReactNode;
  whiteList?: string[];
}

const CustomRequireAuth: React.FC<CustomRequireAuthProps> = ({ 
  children, 
  whiteList = [] 
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [localUser, setLocalUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 检查localStorage中的用户信息
  useEffect(() => {
    const checkLocalUser = () => {
      const storedUser = localStorage.getItem('authenticated_user');
      
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setLocalUser(parsedUser);
        } catch (error) {
          console.error('解析本地用户信息失败:', error);
          localStorage.removeItem('authenticated_user');
          localStorage.removeItem('is_password_login');
          setLocalUser(null);
        }
      } else {
        setLocalUser(null);
      }
      setIsLoading(false);
    };

    // 立即检查一次
    checkLocalUser();
    
    // 监听localStorage变化
    window.addEventListener('storage', checkLocalUser);
    
    // 也监听自定义事件，用于同一页面内的localStorage变化
    const handleLocalStorageChange = () => {
      checkLocalUser();
    };
    
    window.addEventListener('localStorageChange', handleLocalStorageChange);
    
    return () => {
      window.removeEventListener('storage', checkLocalUser);
      window.removeEventListener('localStorageChange', handleLocalStorageChange);
    };
  }, []);

  // 检查当前路径是否在白名单中
  const isWhitelisted = whiteList.some(path => {
    if (path === location.pathname) return true;
    // 支持通配符匹配
    if (path.endsWith('*')) {
      const basePath = path.slice(0, -1);
      return location.pathname.startsWith(basePath);
    }
    return false;
  });

  // 获取当前用户（优先使用miaoda-auth-react的用户，然后是localStorage用户）
  const currentUser = user || localUser;

  // 如果还在加载中，显示加载状态
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  // 如果当前路径在白名单中，直接渲染子组件
  if (isWhitelisted) {
    return <>{children}</>;
  }

  // 如果没有用户且不在白名单中，重定向到登录页
  if (!currentUser) {
    navigate('/login', { replace: true });
    return null;
  }

  // 有用户，渲染子组件
  return <>{children}</>;
};

export default CustomRequireAuth;