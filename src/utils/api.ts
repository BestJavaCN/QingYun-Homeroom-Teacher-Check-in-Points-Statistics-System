import axios from 'axios';

const APP_ID = import.meta.env.VITE_APP_ID;

const apiClient = axios.create({
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
    "X-App-Id": APP_ID,
  },
});

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error("API 请求错误:", error);
    if (error.response?.data?.status === 999) {
      throw new Error(error.response.data.msg);
    }
    return Promise.reject(error);
  }
);

const api = {
  // 发送短信验证码
  sendSmsCode: (phone: string, sessionId: string) =>
    apiClient.post('/api/miaoda/runtime/apicenter/source/proxy/hch5WXYwg5jJEnjQw5nYCR', {
      phone,
      sessionId
    }),

  // 验证短信验证码
  verifySmsCode: (phone: string, phoneCode: string, sessionId: string) =>
    apiClient.post('/api/miaoda/runtime/apicenter/source/proxy/7mph9XQDXoJXmSvGCAhBEi', {
      phone,
      phoneCode,
      sessionId
    }),
};

export default api;