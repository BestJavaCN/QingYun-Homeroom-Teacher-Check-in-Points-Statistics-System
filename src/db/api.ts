import { localStorageApi } from './local-storage';
import type { Profile, Class, ClassFormData } from '@/types/types';

export const profileApi = {
  async getCurrentProfile(): Promise<Profile | null> {
    const storedUser = localStorage.getItem('authenticated_user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        const users = localStorageApi.getUsers();
        return users.find(u => u.id === parsedUser.id) || null;
      } catch {
        return null;
      }
    }
    return null;
  },

  async getProfileByPhone(phone: string): Promise<Profile | null> {
    const users = localStorageApi.getUsers();
    return users.find(u => u.phone === phone) || null;
  },

  async getProfileByUsername(username: string): Promise<Profile | null> {
    const users = localStorageApi.getUsers();
    return users.find(u => u.username === username) || null;
  },

  async getProfileById(id: string): Promise<Profile | null> {
    const users = localStorageApi.getUsers();
    return users.find(u => u.id === id) || null;
  },

  async validatePasswordLogin(account: string, password: string): Promise<Profile | null> {
    return localStorageApi.validateLogin(account, password);
  },

  async getAllProfiles(): Promise<Profile[]> {
    return localStorageApi.getUsers();
  },

  async getUserStats(): Promise<{ totalUsers: number; adminUsers: number; regularUsers: number; users: Profile[] }> {
    const users = localStorageApi.getUsers();
    return {
      totalUsers: users.length,
      adminUsers: users.filter(p => p.role === 'admin').length,
      regularUsers: users.filter(p => p.role === 'user').length,
      users,
    };
  },

  async updateProfile(id: string, updates: Partial<Profile>): Promise<boolean> {
    return localStorageApi.updateUser(id, updates);
  },

  async updateUserRole(id: string, role: 'user' | 'admin'): Promise<boolean> {
    return localStorageApi.updateUser(id, { role });
  },

  async createProfileDirect(profileData: {
    username: string;
    phone: string;
    password: string;
    role: 'user' | 'admin';
  }): Promise<boolean> {
    return localStorageApi.createUser(profileData);
  },

  async createProfile(profileData: {
    username: string;
    phone: string;
    password: string;
    role: 'user' | 'admin';
  }): Promise<boolean> {
    return localStorageApi.createUser(profileData);
  },

  async deleteProfile(id: string): Promise<boolean> {
    return localStorageApi.deleteUser(id);
  },

  async syncAuthUserToProfiles(phone: string, username?: string, role: 'user' | 'admin' = 'user'): Promise<Profile | null> {
    const user = localStorageApi.getUsers().find(u => u.phone === phone);
    if (user) return user;
    const created = localStorageApi.createUser({
      username: username || `用户${phone.slice(-4)}`,
      phone,
      password: '',
      role,
    });
    return created ? localStorageApi.getUsers().find(u => u.phone === phone) || null : null;
  },
};

export const classApi = {
  async getAllClasses(): Promise<Class[]> {
    return localStorageApi.getClasses();
  },

  async createClass(classData: ClassFormData): Promise<boolean> {
    return localStorageApi.createClass(classData);
  },

  async updateClass(id: string, classData: ClassFormData): Promise<boolean> {
    return localStorageApi.updateClass(id, classData);
  },

  async deleteClass(id: string): Promise<boolean> {
    return localStorageApi.deleteClass(id);
  },

  async createClassesBatch(classes: ClassFormData[]): Promise<boolean> {
    return localStorageApi.createClassesBatch(classes);
  },

  async checkTeacherExists(teacherName: string): Promise<boolean> {
    const classes = localStorageApi.getClasses();
    return classes.some(c => c.teacher_name === teacherName);
  },

  async getClassesByTeacher(teacherName: string): Promise<Class[]> {
    const classes = localStorageApi.getClasses();
    return classes.filter(c => c.teacher_name === teacherName);
  },
};