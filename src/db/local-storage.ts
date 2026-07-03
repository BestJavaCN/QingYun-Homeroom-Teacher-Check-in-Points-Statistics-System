import * as XLSX from 'xlsx';
import type { Profile, Class, ClassFormData, CheckInSummary, CheckInType, DateRestrictions } from '@/types/types';

// 通过 window.require 获取 Node.js 模块（Electron nodeIntegration: true 时可用）
// 不能使用 ES6 import，因为 Vite 构建会将 fs/path 外部化为空对象
const getModules = () => {
  if (typeof window !== 'undefined' && (window as any).require) {
    return {
      fs: (window as any).require('fs'),
      path: (window as any).require('path'),
      electron: (window as any).require('electron'),
    };
  }
  return { fs: null, path: null, electron: null };
};

const getUserDataPath = (): string => {
  const { path, electron } = getModules();
  if (electron) {
    try {
      const { app } = electron;
      return app.getPath('userData');
    } catch {
      // fallthrough
    }
  }
  if (path) {
    return path.join(__dirname, '../../data');
  }
  return '../../data';
};

const getDataFilePath = (fileName: string): string => {
  const { fs, path } = getModules();
  const dataDir = getUserDataPath();
  if (fs && path) {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    return path.join(dataDir, fileName);
  }
  return `${dataDir}/${fileName}`;
};

export const localStorageApi = {
  getUsers: (): Profile[] => {
    const { fs } = getModules();
    if (!fs) return [];
    const filePath = getDataFilePath('users.json');
    if (fs.existsSync(filePath)) {
      try {
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
      } catch {
        return [];
      }
    }
    const defaultUsers: Profile[] = [
      {
        id: '1',
        phone: '12345678900',
        username: 'admin',
        password: 'admin123',
        role: 'admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    fs.writeFileSync(filePath, JSON.stringify(defaultUsers, null, 2), 'utf-8');
    return defaultUsers;
  },

  saveUsers: (users: Profile[]): boolean => {
    try {
      const { fs } = getModules();
      if (!fs) return false;
      const filePath = getDataFilePath('users.json');
      fs.writeFileSync(filePath, JSON.stringify(users, null, 2), 'utf-8');
      return true;
    } catch {
      return false;
    }
  },

  createUser: (userData: { username: string; phone: string; password: string; role: 'user' | 'admin' }): boolean => {
    const users = localStorageApi.getUsers();
    if (users.some(u => u.phone === userData.phone || u.username === userData.username)) {
      return false;
    }
    const newUser: Profile = {
      id: crypto.randomUUID(),
      phone: userData.phone,
      username: userData.username,
      password: userData.password,
      role: userData.role,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    users.push(newUser);
    return localStorageApi.saveUsers(users);
  },

  updateUser: (id: string, updates: Partial<Profile>): boolean => {
    const users = localStorageApi.getUsers();
    const index = users.findIndex(u => u.id === id);
    if (index === -1) return false;
    users[index] = { ...users[index], ...updates, updated_at: new Date().toISOString() };
    return localStorageApi.saveUsers(users);
  },

  deleteUser: (id: string): boolean => {
    const users = localStorageApi.getUsers();
    const filtered = users.filter(u => u.id !== id);
    return localStorageApi.saveUsers(filtered);
  },

  validateLogin: (account: string, password: string): Profile | null => {
    const users = localStorageApi.getUsers();
    const user = users.find(
      u => (u.phone === account || u.username === account) && u.password === password
    );
    return user || null;
  },

  getClasses: (): Class[] => {
    const { fs } = getModules();
    if (!fs) return [];
    const filePath = getDataFilePath('classes.json');
    if (fs.existsSync(filePath)) {
      try {
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
      } catch {
        return [];
      }
    }
    return [];
  },

  saveClasses: (classes: Class[]): boolean => {
    try {
      const { fs } = getModules();
      if (!fs) return false;
      const filePath = getDataFilePath('classes.json');
      fs.writeFileSync(filePath, JSON.stringify(classes, null, 2), 'utf-8');
      return true;
    } catch {
      return false;
    }
  },

  createClass: (classData: ClassFormData): boolean => {
    const classes = localStorageApi.getClasses();
    if (classes.some(c => c.class_name === classData.class_name)) {
      return false;
    }
    const newClass: Class = {
      id: crypto.randomUUID(),
      class_name: classData.class_name,
      teacher_name: classData.teacher_name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    classes.push(newClass);
    return localStorageApi.saveClasses(classes);
  },

  updateClass: (id: string, classData: ClassFormData): boolean => {
    const classes = localStorageApi.getClasses();
    const index = classes.findIndex(c => c.id === id);
    if (index === -1) return false;
    classes[index] = { ...classes[index], ...classData, updated_at: new Date().toISOString() };
    return localStorageApi.saveClasses(classes);
  },

  deleteClass: (id: string): boolean => {
    const classes = localStorageApi.getClasses();
    const filtered = classes.filter(c => c.id !== id);
    return localStorageApi.saveClasses(filtered);
  },

  createClassesBatch: (classes: ClassFormData[]): boolean => {
    const existingClasses = localStorageApi.getClasses();
    classes.forEach(c => {
      if (!existingClasses.some(existing => existing.class_name === c.class_name)) {
        const newClass: Class = {
          id: crypto.randomUUID(),
          class_name: c.class_name,
          teacher_name: c.teacher_name,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        existingClasses.push(newClass);
      }
    });
    return localStorageApi.saveClasses(existingClasses);
  },

  getCheckInData: (type: CheckInType): CheckInSummary[] => {
    const { fs, path } = getModules();
    if (!fs || !path) return [];
    const fileName = `${type}.xlsx`;
    const filePath = getDataFilePath(path.join('checkin', fileName));
    if (fs.existsSync(filePath)) {
      try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);
        return data as CheckInSummary[];
      } catch {
        return [];
      }
    }
    return [];
  },

  saveCheckInData: (type: CheckInType, data: CheckInSummary[]): boolean => {
    try {
      const { fs, path } = getModules();
      if (!fs || !path) return false;
      const fileName = `${type}.xlsx`;
      const filePath = getDataFilePath(path.join('checkin', fileName));
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'checkin');
      XLSX.writeFile(workbook, filePath);
      return true;
    } catch {
      return false;
    }
  },

  getDateRestrictions: (): DateRestrictions => {
    const { fs } = getModules();
    if (!fs) return {
      lunch_break: [],
      evening_break: [],
      morning_evening_study: [],
      weekend_day: [],
    };
    const filePath = getDataFilePath('config.json');
    if (fs.existsSync(filePath)) {
      try {
        const data = fs.readFileSync(filePath, 'utf-8');
        const config = JSON.parse(data);
        return config.dateRestrictions || {
          lunch_break: [],
          evening_break: [],
          morning_evening_study: [],
          weekend_day: [],
        };
      } catch {
        return {
          lunch_break: [],
          evening_break: [],
          morning_evening_study: [],
          weekend_day: [],
        };
      }
    }
    return {
      lunch_break: [],
      evening_break: [],
      morning_evening_study: [],
      weekend_day: [],
    };
  },

  saveDateRestrictions: (restrictions: DateRestrictions): boolean => {
    try {
      const { fs } = getModules();
      if (!fs) return false;
      const filePath = getDataFilePath('config.json');
      const existing = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf-8')) : {};
      existing.dateRestrictions = restrictions;
      fs.writeFileSync(filePath, JSON.stringify(existing, null, 2), 'utf-8');
      return true;
    } catch {
      return false;
    }
  },
};
