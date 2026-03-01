import { ref } from 'vue';

export const toastMsg = ref('');

export function useToast() {
    const showToast = (msg: string) => {
        toastMsg.value = msg;
        setTimeout(() => { toastMsg.value = ''; }, 3500);
    };

    return {
        toastMsg,
        showToast
    };
}
