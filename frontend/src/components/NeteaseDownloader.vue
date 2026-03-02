<template>
  <div>
    <!-- Backdrop / 蒙版 -->
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

    <!-- Drawer Panel / 抽屉侧边栏 -->
    <transition
      enter-active-class="transition ease-in-out duration-300 transform"
      enter-from-class="translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition ease-in-out duration-300 transform"
      leave-from-class="translate-x-0"
      leave-to-class="translate-x-full"
    >
      <div v-show="isOpen" class="fixed right-0 top-0 h-full w-full w-full md:w-[480px] lg:w-[600px] bg-slate-900 border-l border-slate-700 z-[101] shadow-2xl overflow-y-auto flex flex-col">
        
        <!-- Header -->
        <div class="px-6 py-4 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900/90 backdrop-blur z-10">
          <h2 class="text-lg font-bold text-slate-100 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-rose-500"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            {{ t('downloader.title') }}
          </h2>
          <button @click="$emit('close')" class="text-slate-400 hover:text-slate-100 transition p-2 hover:bg-slate-700/50 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <!-- Scrollable Content -->
        <div class="p-6 flex-1 flex flex-col gap-6">
          <div class="flex flex-col gap-4">
            <!-- URL Input -->
            <div class="flex flex-col gap-2">
              <label class="text-sm font-semibold text-slate-400 uppercase tracking-wider">{{ t('downloader.url_placeholder') }}</label>
              <div class="flex gap-2">
                <input 
                  v-model="inputUrl" 
                  type="text" 
                  :placeholder="t('downloader.url_placeholder')"
                  class="flex-1 bg-slate-800 border border-slate-700 rounded p-3 text-slate-100 text-sm focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                  @keyup.enter="parseUrl"
                  :disabled="isDownloading"
                />
                <button 
                  @click="parseUrl" 
                  :disabled="isParsing || !inputUrl || isDownloading"
                  class="px-5 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-bold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <span v-if="isParsing" class="animate-spin text-lg block w-4 h-4 rounded-full border-2 border-t-slate-100 border-slate-100/20"></span>
                  {{ t('downloader.parse_btn') }}
                </button>
              </div>
            </div>
            
            <!-- Quality & Config Row -->
            <div class="flex flex-col gap-2">
              <label class="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>{{ t('downloader.quality_label') }}</span>
                <button @click="showCookieConfig = !showCookieConfig" class="text-xs text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  {{ t('downloader.cookie_label') }}
                </button>
              </label>
              <select v-model="selectedLevel" :disabled="isParsing || isDownloading" class="bg-slate-800 border border-slate-700 rounded p-3 text-slate-100 text-sm focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 w-full appearance-none">
                <option value="standard">{{ t('downloader.level_standard') }}</option>
                <option value="exhigh">{{ t('downloader.level_exhigh') }}</option>
                <option value="lossless">{{ t('downloader.level_lossless') }}</option>
                <option value="hires">{{ t('downloader.level_hires') }}</option>
              </select>
            </div>
            
            <!-- Cookie Input Area (Collapsible) -->
            <div v-show="showCookieConfig" class="flex flex-col gap-2 bg-slate-800/50 p-3 rounded border border-slate-700">
              <label class="text-xs font-semibold text-slate-400">
                {{ t('downloader.cookie_label') }} 
                <span class="text-[10px] text-slate-500 font-normal ml-2">{{ t('downloader.cookie_hint') }}</span>
              </label>
              <textarea 
                v-model="cookieData" 
                placeholder="在此粘贴包含 MUSIC_U 一整大段的 Cookie 文本..." 
                class="w-full h-16 bg-slate-800 border border-slate-700 rounded p-2 text-slate-300 text-xs focus:outline-none focus:border-indigo-600 font-mono resize-none shadow-inner"
                @input="saveCookie"
              ></textarea>
            </div>
          </div>

          <!-- 解析结果面板 -->
          <div v-if="parsedData" class="flex flex-col gap-4 border border-slate-800 bg-slate-800/20 p-4 rounded-xl">
             <div v-if="parsedData.type === 'song'" class="flex items-center gap-4">
                <img v-if="parsedData.data[0].coverUrl" :src="parsedData.data[0].coverUrl" class="w-16 h-16 rounded shadow-lg object-cover" />
                <div class="flex-1 min-w-0">
                   <h3 class="text-slate-100 font-bold truncate">{{ parsedData.data[0].title }}</h3>
                   <p class="text-slate-400 text-sm truncate">{{ parsedData.data[0].artist }}</p>
                </div>
                <div class="flex flex-col items-end">
                  <span v-if="parsedData.data[0].downloadable" class="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{{ t('downloader.tag_downloadable') }}</span>
                  <span v-else class="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">{{ t('downloader.tag_restricted') }}</span>
                </div>
             </div>

             <div v-else-if="parsedData.type === 'playlist'" class="flex items-center gap-4">
                <img v-if="parsedData.coverUrl" :src="parsedData.coverUrl" class="w-16 h-16 rounded shadow-lg object-cover" />
                <div class="flex-1 min-w-0">
                   <h3 class="text-slate-100 font-bold truncate">{{ parsedData.name }}</h3>
                   <p class="text-slate-400 text-sm truncate">{{ t('downloader.info_playlist_parsed', { count: parsedData.trackIds?.length || 0 }) }}</p>
                </div>
                <div class="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-indigo-600/10 text-indigo-400 border border-indigo-600/20">{{ t('downloader.tag_playlist') }}</div>
             </div>

             <div class="flex border-t border-slate-700/50 pt-4 mt-2 justify-end gap-3">
               
               <!-- Playlist / Batch Queue Controls -->
               <template v-if="isDownloading && parsedData.type === 'playlist'">
                   <button 
                      @click="isPaused = !isPaused" 
                      class="px-4 py-2.5 rounded font-bold text-sm transition flex items-center gap-2"
                      :class="isPaused ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'"
                   >
                      <svg v-if="isPaused" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                      {{ isPaused ? t('downloader.resume_queue') : t('downloader.pause_queue') }}
                   </button>
                   <button 
                      v-if="isDownloading"
                      @click="isCancelled = true" 
                      class="px-4 py-2.5 bg-rose-900/40 border border-rose-800 hover:bg-rose-900/60 text-white rounded font-bold text-sm transition flex items-center gap-2"
                   >
                      {{ t('downloader.cancel') }}
                   </button>
               </template>

               <button 
                  v-if="!isDownloading"
                  @click="startDownload" 
                  :disabled="parsedData.type === 'song' && !parsedData.data[0].downloadable"
                  class="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-slate-50 rounded font-bold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-rose-600/20"
                >
                  {{ t('downloader.start_download') }}
               </button>
             </div>
          </div>

          <!-- 下载进度与日志 -->
          <div v-if="logs.length > 0" class="flex-1 border border-slate-700 bg-slate-800 rounded-xl overflow-hidden flex flex-col min-h-[200px] shadow-inner">
             <div class="bg-slate-800 px-3 py-2 text-xs text-slate-400 font-mono tracking-wider flex justify-between">
             <span>{{ t('downloader.exec_log') }}</span>
           </div>
             <div ref="logContainer" class="p-3 text-[11px] font-mono text-emerald-500/80 leading-relaxed overflow-y-auto flex-1 h-0 flex flex-col gap-1">
                <div v-for="(log, idx) in logs" :key="idx" :class="{'text-rose-400': log.includes('ERR'), 'text-amber-300': log.includes('WARN')}">
                   > {{ log }}
                </div>
             </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import axios from 'axios';

const props = defineProps({
  isOpen: { type: Boolean, default: false }
});

const emit = defineEmits(['close', 'downloaded']);

const { t } = useI18n();

const inputUrl = ref('');
const selectedLevel = ref('exhigh'); // default Exhigh-320k
const showCookieConfig = ref(false);
const cookieData = ref('');

const isParsing = ref(false);
const parsedData = ref<any>(null);

const isDownloading = ref(false);
const isPaused = ref(false);
const isCancelled = ref(false);
const logs = ref<string[]>([]);
const logContainer = ref<any>(null);

onMounted(() => {
    const savedCookie = localStorage.getItem('NETEASE_COOKIE');
    if (savedCookie) {
        cookieData.value = savedCookie;
    }
});

const saveCookie = () => {
    localStorage.setItem('NETEASE_COOKIE', cookieData.value);
};

const addLog = (msg: string) => {
   logs.value.push(`${new Date().toLocaleTimeString()} - ${msg}`);
   nextTick(() => {
     if (logContainer.value) {
       logContainer.value.scrollTop = logContainer.value.scrollHeight;
     }
   });
}

const parseUrl = async () => {
    if (!inputUrl.value) return;
    try {
        isParsing.value = true;
        parsedData.value = null;
        logs.value = [];
        
        const endPoint = inputUrl.value.includes('qq.com') ? '/api/qq/parse' : '/api/netease/parse';
        const res = await axios.post(endPoint, { 
            url: inputUrl.value, 
            level: selectedLevel.value,
            cookie: cookieData.value 
        });
        if (res.data.success) {
            parsedData.value = res.data;
            if (res.data.type === 'playlist') {
                addLog(t('downloader.info_playlist_parsed', { count: res.data.trackIds?.length }));
            } else {
                addLog(t('downloader.info_song_status', { status: res.data.data[0].downloadable ? t('downloader.tag_downloadable') : t('downloader.tag_restricted') }));
            }
        }
    } catch (e: any) {
        addLog(`${t('db_failed')}: ${e.response?.data?.error || e.message}`);
    } finally {
        isParsing.value = false;
    }
}

const downloadSingle = async (id: number | string): Promise<boolean> => {
    try {
        addLog(`...正在请求直链并下载音频轨道 ID:${id} [${selectedLevel.value}]`);
        const endPoint = inputUrl.value.includes('qq.com') ? '/api/qq/download' : '/api/netease/download';
        const res = await axios.post(endPoint, { 
            id, 
            level: selectedLevel.value,
            cookie: cookieData.value
        });
        if (res.data.success) {
            addLog(`✅ 刮削封装完成: ${res.data.filepath}`);
            return true;
        } else {
            addLog(`ERR: 下载故障 - ${res.data.error}`);
            return false;
        }
    } catch (e: any) {
        addLog(t('downloader.log_refused', { error: e.response?.data?.error || e.message }));
        return false;
    }
}

const startDownload = async () => {
    if (!parsedData.value) return;
    
    isDownloading.value = true;
    isPaused.value = false;
    isCancelled.value = false;
    
    try {
        if (parsedData.value.type === 'song') {
            const sl = parsedData.value.data[0];
            await downloadSingle(sl.neteaseId || sl.qqId);
        } else if (parsedData.value.type === 'playlist') {
            const ids = parsedData.value.trackIds || [];
            addLog(t('downloader.warn_batch_start', { count: ids.length }));
            
            let successCount = 0;
            let failedCount = 0;

            for (let i = 0; i < ids.length; i++) {
                if (isCancelled.value) {
                    addLog(t('downloader.log_interrupted'));
                    break;
                }

                while (isPaused.value) {
                    await new Promise(r => setTimeout(r, 500));
                    if (isCancelled.value) break;
                }
                if (isCancelled.value) break;

                addLog(t('downloader.log_preparing', { current: i + 1, total: ids.length, id: ids[i] }));
                const ok = await downloadSingle(ids[i]);
                if (ok) successCount++;
                else failedCount++;
                
                await new Promise(r => setTimeout(r, 1500)); // Rate limit 1.5s
            }
            if (!isCancelled.value) {
                 addLog(t('downloader.log_finished', { success: successCount, failed: failedCount }));
            }
        }
        
        emit('downloaded');
    } finally {
        isDownloading.value = false;
        isPaused.value = false;
        isCancelled.value = false;
    }
}

watch(() => props.isOpen, (newVal) => {
    if (!newVal) {
        // Reset state after drawer closed
        setTimeout(() => {
            inputUrl.value = '';
            parsedData.value = null;
            logs.value = [];
            isParsing.value = false;
        }, 300);
    }
});
</script>
