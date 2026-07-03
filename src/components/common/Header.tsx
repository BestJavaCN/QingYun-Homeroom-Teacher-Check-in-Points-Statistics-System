import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, User, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { profileApi } from '@/db/api';
import type { Profile } from '@/types/types';
import routes from '../../routes';

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const location = useLocation();
  const navigation = routes.filter(route => route.visible !== false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profileData = await profileApi.getCurrentProfile();
        if (!profileData) {
          const users = profileApi.getAllProfiles();
          if (users.length > 0) {
            localStorage.setItem('authenticated_user', JSON.stringify(users[0]));
            setProfile(users[0]);
          }
        } else {
          setProfile(profileData);
        }
      } catch (error) {
        console.error('获取用户profile失败:', error);
      }
    };

    loadProfile();
  }, []);

  const displayName = profile?.username || profile?.phone || '用户';

  return (
    <header className="bg-white shadow-md sticky top-0 z-10">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center">
              <img
                className="h-8 w-auto"
                src={`https://miaoda-site-img.cdn.bcebos.com/placeholder/code_logo_default.png`}
                alt="系统Logo"
              />
              <span className="ml-2 text-xl font-bold text-blue-600">班主任签到量化统计系统</span>
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-8">
            {navigation.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3 py-2 text-base font-medium rounded-md ${
                  location.pathname === item.path
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                } transition duration-300`}
              >
                {item.name}
              </Link>
            ))}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center space-x-2">
                  <User className="h-4 w-4" />
                  <span>{displayName}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to="/user-profile" className="flex items-center">
                    <User className="mr-2 h-4 w-4" />
                    个人资料
                  </Link>
                </DropdownMenuItem>
                {(profile?.role === 'admin') && (
                  <DropdownMenuItem asChild>
                    <Link to="/user-management" className="flex items-center">
                      <Settings className="mr-2 h-4 w-4" />
                      用户管理
                    </Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="md:hidden flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-gray-50">
              {navigation.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`block px-3 py-2 text-base font-medium rounded-md ${
                    location.pathname === item.path
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                  } transition duration-300`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
              <Link
                to="/user-profile"
                className="block px-3 py-2 text-base font-medium rounded-md text-gray-700 hover:text-blue-600 hover:bg-gray-50 transition duration-300"
                onClick={() => setIsMenuOpen(false)}
              >
                <User className="inline mr-2 h-4 w-4" />
                个人资料
              </Link>
              {(profile?.role === 'admin') && (
                <Link
                  to="/user-management"
                  className="block px-3 py-2 text-base font-medium rounded-md text-gray-700 hover:text-blue-600 hover:bg-gray-50 transition duration-300"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Settings className="inline mr-2 h-4 w-4" />
                  用户管理
                </Link>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
};

export default Header;