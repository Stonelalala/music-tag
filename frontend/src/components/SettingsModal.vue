<template>
  <div>
    <!-- Backdrop -->
    <transition
      enter-active-class="transition-opacity ease-linear duration-300"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity ease-linear duration-300"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-show="isOpen" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] transition-opacity" @click="$emit('close')"></div>
    </transition>

    <!-- Modal Panel -->
    <transition
      enter-active-class="transition ease-out duration-300 transform"
      enter-from-class="scale-95 opacity-0"
      enter-to-class="scale-100 opacity-100"
      leave-active-class="transition ease-in duration-200 transform"
      leave-from-class="scale-100 opacity-100"
      leave-to-class="scale-95 opacity-0"
    >
      <div v-show="isOpen" class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-slate-900 border border-slate-700 z-[101] shadow-2xl rounded-2xl overflow-hidden flex flex-col">
        
        <!-- Header -->
        <div class="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 class="text-lg font-bold text-slate-100 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-indigo-400"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
            {{ $t('settings_btn') }}
          </h2>
          <button @click="$emit('close')" class="text-slate-400 hover:text-slate-100 transition p-2 hover:bg-slate-700/50 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <!-- Content -->
        <div class="p-6 flex flex-col gap-6 overflow-y-auto max-h-[70vh]">
          
          <!-- Netease Cookie Section -->
          <div class="flex flex-col gap-3">
             <div class="flex items-center justify-between">
                <label class="text-sm font-bold text-slate-200">网易云个人 Cookie (VIP 权限)</label>
                <span class="text-[10px] text-emerald-400 font-mono" v-if="config.neteaseCookie">已配置</span>
             </div>
             <p class="text-xs text-slate-500 leading-relaxed">用于解锁网易云无损 (Lossless) 和 Hi-Res 音质下载权限。请填入包含 MUSIC_U 的完整 Cookie 字符串。</p>
             <textarea 
                v-model="config.neteaseCookie"
                placeholder="在此粘贴 Netease Cookie..."
                class="w-full h-24 bg-slate-800 border border-slate-700 rounded-xl p-3 text-slate-300 text-xs focus:outline-none focus:border-indigo-500 font-mono resize-none"
             ></textarea>
          </div>

          <!-- QQ Music Cookie Section -->
          <div class="flex flex-col gap-3">
             <div class="flex items-center justify-between">
                <label class="text-sm font-bold text-slate-200">QQ 音乐个人 Cookie (VIP 权限)</label>
                <span class="text-[10px] text-emerald-400 font-mono" v-if="config.qqCookie">已配置</span>
             </div>
             <p class="text-xs text-slate-500 leading-relaxed">用于解锁 QQ 音乐高音质下载。目前建议使用 Meting 代理中转，若有独立解析需求可在此填入。</p>
             <textarea 
                v-model="config.qqCookie"
                placeholder="在此粘贴 QQ Music Cookie..."
                class="w-full h-20 bg-slate-800 border border-slate-700 rounded-xl p-3 text-slate-300 text-xs focus:outline-none focus:border-indigo-500 font-mono resize-none"
             ></textarea>
          </div>

        </div>

        <!-- Footer -->
        <div class="p-4 bg-slate-800/50 border-t border-slate-800 flex justify-end gap-3">
           <button @click="$emit('close')" class="px-4 py-2 text-sm text-slate-400 hover:text-slate-100 transition">
              取消
           </button>
           <button @click="saveConfig" :disabled="isSaving" class="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2">
              <span v-if="isSaving" class="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full"></span>
              {{ isSaving ? '正在保存...' : '保存更改' }}
           </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import axios from 'axios';
import { useToast } from '../composables/useToast';

const props = defineProps({
  isOpen: { type: Boolean, default: false }
});

const emit = defineEmits(['close']);
const { showToast } = useToast();

const config = ref({
   neteaseCookie: '',
   qqCookie: ''
});

const isSaving = ref(false);

const loadConfig = async () => {
   try {
      const res = await axios.get('/api/settings/config');
      if (res.data.success) {
         config.value = { ...config.value, ...res.data.data };
      }
   } catch (e) {
      console.error('Failed to load config');
   }
};

const saveConfig = async () => {
   try {
      isSaving.value = true;
      const res = await axios.post('/api/settings/config', config.value);
      if (res.data.success) {
         showToast('配置已保存 (可能需要重启服务生效)');
         // 同步到本地存储以便 Downloader 直接使用
         if (config.value.neteaseCookie) {
             localStorage.setItem('NETEASE_COOKIE', config.value.neteaseCookie);
         }
         emit('close');
      }
   } catch (e) {
      showToast('保存失败');
   } finally {
      isSaving.value = false;
   }
};

onMounted(() => {
   loadConfig();
   // Fallback: sync from localstorage if empty
   if (!config.value.neteaseCookie) {
       config.value.neteaseCookie = localStorage.getItem('NETEASE_COOKIE') || '';
   }
});

watch(() => props.isOpen, (newVal) => {
   if (newVal) loadConfig();
});

</script>
