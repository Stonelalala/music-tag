<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="close"></div>
    
    <!-- Modal -->
    <div class="relative w-full max-w-6xl bg-slate-800 h-full max-h-[90vh] shadow-2xl shadow-black rounded-xl border border-slate-700 flex flex-col md:flex-row overflow-hidden transform transition-all">
      
      <!-- Left Column: Form Edit -->
      <div class="w-full md:w-[400px] flex flex-col border-r border-slate-700 bg-slate-800 shrink-0 relative">
        <div class="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900/40">
          <h3 class="text-lg font-semibold">{{ $t('edit_drawer_title') || '元数据编辑' }}</h3>
        </div>
        
        <div class="p-6 flex-1 overflow-y-auto">
          <div class="space-y-4">
              
            <div class="p-4 bg-slate-900/50 rounded flex gap-4 items-center mb-6">
                <div 
                  class="w-20 h-20 bg-slate-800 rounded-md flex items-center justify-center text-slate-500 overflow-hidden shadow-inner flex-shrink-0 border border-slate-700 relative group cursor-pointer"
                  @click="triggerUpload"
                >
                    <!-- Load cover if available, with cache buster -->
                    <img :src="`/api/tracks/${track?.id}/cover?t=${coverTimestamp}`" @error="handleImageError" v-if="track && (!imageError || coverTimestamp > 0)" class="w-full h-full object-cover transition duration-300 group-hover:brightness-50" />
                    <span v-else class="transition duration-300 group-hover:opacity-0">🎵</span>
                    
                    <!-- Upload Overlay -->
                    <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-300">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                    </div>
  
                    <input type="file" ref="fileInput" class="hidden" accept="image/jpeg, image/png" @change="onFileChange" />
                </div>
                <div class="overflow-hidden">
                    <div class="text-sm font-medium text-slate-200 truncate">{{ track?.filename || '...' }}</div>
                    <div class="text-xs text-slate-500 mt-1 uppercase tracking-wider">{{ track?.extension || 'UNKNOWN' }}</div>
                    <div class="text-[10px] text-slate-600 mt-1 mt-2">ID: {{ track?.id }}</div>
                </div>
            </div>
  
            <div>
              <label class="block text-xs text-slate-400 mb-1">{{ $t('lbl_title') }}</label>
              <input v-model="form.title" type="text" class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
            </div>
            
            <div>
              <label class="block text-xs text-slate-400 mb-1">{{ $t('lbl_artist') }}</label>
              <input v-model="form.artist" type="text" class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
            </div>
            
            <div>
              <label class="block text-xs text-slate-400 mb-1">{{ $t('lbl_album') }}</label>
              <input v-model="form.album" type="text" class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
            </div>
            
            <div>
              <label class="block text-xs text-slate-400 mb-1 flex justify-between">
                  <span>Lyrics (同步歌词)</span>
                  <button @click="autoFetchLyrics" v-if="form.title && form.artist" class="text-[10px] text-indigo-400 hover:text-indigo-300 underline">外网补全歌词</button>
              </label>
              <textarea v-model="form.lyrics" rows="6" class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 font-mono"></textarea>
            </div>
          </div>
        </div>
        
        <div class="p-6 border-t border-slate-700 bg-slate-900/40 flex gap-3">
          <button @click="close" class="flex-1 py-2 rounded border border-slate-600 text-slate-300 hover:bg-slate-700 transition text-sm font-medium">
            {{ $t('btn_cancel') }}
          </button>
          <button @click="save" :disabled="saving" class="flex-1 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition text-sm font-medium disabled:opacity-50">
            {{ saving ? '...' : $t('btn_save') }}
          </button>
        </div>
      </div>

      <!-- Right Column: Metadata Search -->
      <div class="flex-1 flex flex-col bg-slate-900/60 relative">
          <!-- Close Modal Area -->
          <button @click="close" class="absolute top-4 right-4 text-slate-400 hover:text-white p-2 text-xl rounded hover:bg-slate-700/50 z-10 transition leading-none">
              ✕
          </button>
          
          <!-- Search Header -->
          <div class="p-6 border-b border-slate-700/80 flex flex-col gap-4">
              <h3 class="text-base font-medium text-slate-200">在线元数据刮削检索 (Metadata Search)</h3>
              
              <div class="flex items-center gap-3 w-full max-w-2xl">
                  <label class="text-sm text-slate-400 whitespace-nowrap">标签源:</label>
                  <select v-model="searchSource" class="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none">
                      <option value="qq">QQ音乐</option>
                      <option value="netease">网易云音乐</option>
                      <option value="itunes">iTunes Global</option>
                  </select>
                  
                  <div class="flex-1 relative">
                      <input v-model="searchQuery" @keyup.enter="doSearch" type="text" class="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none" placeholder="输入关键字，如: 爱跳舞的小怪兽..." />
                  </div>
                  
                  <button @click="doSearch" :disabled="isSearching" class="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded text-sm transition font-medium flex gap-2 items-center disabled:opacity-50">
                     <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                     检索
                  </button>
              </div>
          </div>
          
          <!-- Search Results List -->
          <div class="flex-1 overflow-y-auto p-2 sm:p-4">
             <div v-if="isSearching" class="flex justify-center items-center h-40 text-slate-500 gap-3">
                 <svg class="animate-spin h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                 <span>正在跨国检索元数据库...</span>
             </div>
             <table v-else-if="searchResults.length > 0" class="w-full text-left text-sm text-slate-300">
                 <thead class="text-xs text-slate-500 uppercase border-b border-slate-700/50">
                     <tr>
                         <th class="py-3 px-4 font-normal">封面 / 标题 / 艺术家</th>
                         <th class="py-3 px-4 font-normal">专辑</th>
                         <th class="py-3 px-4 font-normal text-center w-28">操作</th>
                     </tr>
                 </thead>
                 <tbody>
                     <tr v-for="res in searchResults" :key="res.id" class="border-b border-slate-800/80 hover:bg-slate-800 transition group">
                         <td class="py-3 px-4">
                             <div class="flex items-center gap-4">
                                 <!-- Cover Preview box -->
                                 <div class="w-12 h-12 bg-slate-900 rounded border border-slate-700 overflow-hidden flex-shrink-0 flex items-center justify-center text-slate-600">
                                      <img v-if="res.coverUrl" :src="'/api/proxy-image?url='+encodeURIComponent(res.coverUrl)" class="w-full h-full object-cover" />
                                      <span v-else>♪</span>
                                 </div>
                                 <div class="flex flex-col">
                                     <span class="font-medium text-slate-100 text-[15px] mb-0.5">{{ res.title }}</span>
                                     <span class="text-xs text-slate-400">{{ res.artist }}</span>
                                 </div>
                             </div>
                         </td>
                         <td class="py-3 px-4">
                             <div class="flex flex-col">
                                 <span class="text-slate-300">{{ res.album || '-' }}</span>
                                 <span class="text-xs text-slate-500 mt-1 font-mono" v-if="res.year">{{ res.year }}</span>
                             </div>
                         </td>
                         <td class="py-3 px-4 text-center">
                             <button @click="applyMetadata(res)" class="px-4 py-1.5 bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded border border-emerald-600/30 text-xs transition font-medium opacity-80 group-hover:opacity-100 shadow">
                                 应用刮削
                             </button>
                         </td>
                     </tr>
                 </tbody>
             </table>
             <div v-else-if="hasSearched" class="text-center py-20 text-slate-500 text-sm">
                 未找到结果 (No relevant metadata found in {{ searchSource }})
             </div>
             <div v-else class="text-center py-20 text-slate-600/40 text-sm flex flex-col items-center gap-3">
                 <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="m21 21-6-6m6-6v6a2 2 0 0 1-2 2h-6m-6-6h.01M4 15h.01M4 9h.01M9 4h.01M15 4h.01"/></svg>
                 在上方输入搜索词并点击检索按钮获取刮削数据
             </div>
          </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import axios from 'axios';
import { useI18n } from 'vue-i18n';
import { useToast } from '../composables/useToast';

const { t } = useI18n({ useScope: 'global' });
const { showToast } = useToast();

const props = defineProps<{
  isOpen: boolean;
  track: any;
}>();

const emit = defineEmits(['close', 'saved']);

const form = ref({
  title: '',
  artist: '',
  album: '',
  lyrics: ''
});

const saving = ref(false);
const imageError = ref(false);
const coverTimestamp = ref(0);
const fileInput = ref<HTMLInputElement | null>(null);

// Search State
const searchSource = ref('netease');
const searchQuery = ref('');
const searchResults = ref<any[]>([]);
const isSearching = ref(false);
const hasSearched = ref(false);

const handleImageError = () => {
    if (coverTimestamp.value === 0) {
        imageError.value = true;
    }
};

const triggerUpload = () => {
    fileInput.value?.click();
};

const fetchLyrics = async (id: string) => {
    try {
        const res = await axios.get(`/api/tracks/${id}/lyrics`);
        if (res.data.success) {
            form.value.lyrics = res.data.lyrics || '';
        }
    } catch (e) {
        console.error('Failed to fetch lyrics', e);
    }
};

// Search Logic
const doSearch = async () => {
    if (!searchQuery.value.trim()) return;
    isSearching.value = true;
    hasSearched.value = false;
    
    try {
        const res = await axios.get(`/api/search-metadata?q=${encodeURIComponent(searchQuery.value)}&source=${searchSource.value}`);
        if (res.data.success) {
            searchResults.value = res.data.results;
        }
    } catch (e) {
        console.error(e);
        showToast('检索失败 (Search Failed). Check backend logs.');
    } finally {
        isSearching.value = false;
        hasSearched.value = true;
    }
};

const applyMetadata = (resData: any) => {
    form.value.title = resData.title || '';
    form.value.artist = resData.artist || '';
    form.value.album = resData.album || '';
    // Optional: we don't automatically override manual lyrics here, but we could add a warning or confirm.
    showToast('信息已填充！请检查并点击下方"保存信息"进行物理写入。');
};

const autoFetchLyrics = async () => {
    // This could just auto fetch lyrics from LRCLIB using current title/artist
    showToast('此功能即将实现 (Background Engine integration pending)');
};

const onFileChange = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
        const file = target.files[0];
        if (!props.track?.id) return;
        
        const formData = new FormData();
        formData.append('cover', file);
        
        try {
            const res = await axios.post(`/api/tracks/${props.track.id}/cover`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            if (res.data.success) {
                // Force reload image
                imageError.value = false;
                coverTimestamp.value = Date.now();
                emit('saved'); // Notify parent update list
            }
        } catch (e) {
            console.error('Failed to upload cover:', e);
            showToast('Failed to upload cover art.');
        } finally {
            // Reset input
            target.value = '';
        }
    }
};

watch(() => props.track, (newTrack) => {
  if (newTrack) {
    form.value = {
      title: newTrack.title || '',
      artist: newTrack.artist || '',
      album: newTrack.album || '',
      lyrics: ''
    };
    imageError.value = false;
    coverTimestamp.value = 0;
    
    // reset search context
    searchQuery.value = newTrack.title ? `${newTrack.title} ${newTrack.artist !== 'Unknown Artist' ? newTrack.artist : ''}`.trim() : newTrack.filename;
    searchResults.value = [];
    hasSearched.value = false;
    
    fetchLyrics(newTrack.id);
  }
});

const close = () => {
  emit('close');
};

const save = async () => {
  if (!props.track) return;
  saving.value = true;
  try {
    const res = await axios.post(`/api/tracks/${props.track.id}`, form.value);
    if (res.data.success) {
      emit('saved');
      close();
    }
  } catch (e) {
    console.error(e);
    showToast('Failed to save.');
  } finally {
    saving.value = false;
  }
};
</script>
