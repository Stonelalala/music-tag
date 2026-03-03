import { ref } from 'vue';
import axios from 'axios';

const token = ref(localStorage.getItem('AUTH_TOKEN'));
const user = ref<any>(JSON.parse(localStorage.getItem('AUTH_USER') || 'null'));
const isAuthenticated = ref(!!token.value);

const setupAxios = () => {
    if (token.value) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token.value}`;
    } else {
        delete axios.defaults.headers.common['Authorization'];
    }
};

// Initialize axios with token from localStorage
setupAxios();

export function useAuth() {
    const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const res = await axios.post('/api/auth/login', { username, password });
            if (res.data.success) {
                token.value = res.data.token;
                user.value = res.data.user;
                isAuthenticated.value = true;
                if (token.value) localStorage.setItem('AUTH_TOKEN', token.value);
                localStorage.setItem('AUTH_USER', JSON.stringify(user.value));
                setupAxios();
                return { success: true };
            }
            return { success: false, error: 'Login failed' };
        } catch (e: any) {
            return { success: false, error: e.response?.data?.error || 'Login failed' };
        }
    };

    const logout = () => {
        token.value = null;
        user.value = null;
        isAuthenticated.value = false;
        localStorage.removeItem('AUTH_TOKEN');
        localStorage.removeItem('AUTH_USER');
    };


    // Global interceptor to handle 401
    axios.interceptors.response.use(
        response => response,
        error => {
            if (error.response?.status === 401) {
                logout();
            }
            return Promise.reject(error);
        }
    );

    return {
        token,
        user,
        isAuthenticated,
        login,
        logout
    };
}
