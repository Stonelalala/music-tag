<template>
  <div class="flex flex-col md:flex-row gap-4 mt-8 h-[600px] overflow-hidden">
    <!-- Left Sidebar: Folders -->
    <div class="w-full md:w-64 bg-slate-800 border border-slate-700 rounded-xl flex flex-col shadow-lg overflow-hidden flex-shrink-0 relative">
      <div class="p-4 border-b border-slate-700 font-semibold text-slate-200 bg-slate-900/20 flex gap-2 items-center">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-indigo-400"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>
        {{ t('ui.sidebar.title') }}
      </div>
      <div class="p-2 border-b border-slate-700/50 bg-slate-900/30 font-mono text-xs text-indigo-300 break-all select-all flex items-center">
        <span class="opacity-50 mr-1">/</span> {{ currentFolder || t('ui.sidebar.root') }}
      </div>
      
      <div class="flex-1 overflow-y-auto p-2">
        <ul class="space-y-1">
          <li v-if="currentFolder">
              <button @click="goUp" class="w-full text-left px-3 py-2 rounded text-sm text-slate-300 hover:bg-indigo-600/30 hover:text-indigo-200 transition flex items-center gap-2 group">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-50 group-hover:opacity-100"><path d="m15 18-6-6 6-6"/></svg>
              {{ t('ui.sidebar.back') }}
            </button>
          </li>
          <li v-for="folder in folders" :key="'sidebar_'+folder">
            <button @click="enterFolder(folder)" class="w-full text-left px-3 py-2 rounded text-sm text-slate-300 hover:bg-slate-700/50 transition flex items-center gap-2 group truncate" :title="folder">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-500 group-hover:text-indigo-400"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              <span class="truncate">{{ folder }}</span>
            </button>
          </li>
          
          <!-- Tracks Files in directory -->
          <li v-for="track in tracks" :key="'sidebar_track_'+track.id">
            <div class="w-full text-left px-3 py-1.5 rounded text-xs text-slate-400/80 flex items-center gap-2 truncate opacity-80" :title="track.filename">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-600 flex-shrink-0"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              <span class="truncate">{{ track.filename }}</span>
            </div>
          </li>

           <li v-if="folders.length === 0 && tracks.length === 0 && !currentFolder" class="px-3 py-4 text-xs text-center text-slate-500 opacity-60">
             {{ t('ui.sidebar.empty') }}
           </li>
        </ul>
      </div>
      <!-- Actions at the bottom of the sidebar -->
      <div class="p-3 border-t border-slate-700 bg-slate-900/50 flex flex-col gap-2">
         <button 
            @click="isOrganizeModalOpen = true" 
             class="w-full px-3 py-2 bg-sky-600/20 text-sky-400 hover:bg-sky-600 hover:text-white rounded border border-sky-600/30 transition flex items-center justify-center gap-2 text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
            {{ t('ui.sidebar.organize') }}
        </button>
         <button 
            @click="isDeduplicateModalOpen = true" 
             class="w-full px-3 py-2 bg-rose-600/10 text-rose-400 hover:bg-rose-600 hover:text-white rounded border border-rose-600/30 transition flex items-center justify-center gap-2 text-sm mt-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
            {{ t('ui.sidebar.dedupe') }}
        </button>
      </div>
    </div>

    <!-- Right Main Area: Track List -->
    <div class="flex-1 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-lg flex flex-col min-w-0">
      
      <!-- Toolbar -->
      <div class="p-4 border-b border-slate-700 flex flex-wrap justify-between items-center bg-slate-900/20 gap-3">
        <h2 class="text-lg font-semibold text-slate-200 flex items-center gap-2">
          {{ t('ui.tracks.title') }}
          <span class="text-xs font-normal text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full">{{ t('ui.tracks.total_label', { count: total }) }}</span>
        </h2>
        
        <div>
          <button 
            @click="promptBatchRename" 
            :disabled="renaming || tracks.length === 0"
             class="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded shadow transition flex items-center gap-2 text-sm disabled:opacity-50">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a9.97 9.97 0 0 0 7.07-2.93L22 16"/><path d="M22 16h-6"/><path d="M22 16V10"/><path d="M12 2a9.97 9.97 0 0 0-7.07 2.93L2 8"/><path d="M2 8h6"/><path d="M2 8v6"/></svg>
            {{ renaming ? t('ui.tracks.renaming') : t('ui.tracks.rename_btn') }}
          </button>
        </div>
      </div>
      
      <!-- Table Container -->
      <div class="flex-1 overflow-auto">
        <table class="w-full text-left text-sm text-slate-300 whitespace-nowrap">
          <thead class="text-xs text-slate-400 uppercase bg-slate-900/80 sticky top-0 z-10 backdrop-blur-sm">
            <tr>
              <th class="px-6 py-3 w-10">#</th>
              <th class="px-6 py-3">{{ $t('col_title') }}</th>
              <th class="px-6 py-3">{{ $t('col_artist') }}</th>
              <th class="px-6 py-3">{{ $t('col_album') }}</th>
              <th class="px-6 py-3">{{ $t('col_status') }}</th>
              <th class="px-6 py-3">{{ $t('col_actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(track, index) in tracks" :key="track.id" class="border-b border-slate-700/50 hover:bg-slate-700/30 transition group">
              <td class="px-6 py-4 font-mono text-xs text-slate-500">{{ index + 1 }}</td>
              
              <!-- Title with Cover -->
              <td class="px-6 py-4">
                  <div class="flex items-center gap-3">
                      <div class="w-10 h-10 bg-slate-900 rounded overflow-hidden flex-shrink-0 border border-slate-700">
                          <img :src="`/api/tracks/${track.id}/cover`" @error="onImageError" class="w-full h-full object-cover" />
                      </div>
                      <div class="flex flex-col overflow-hidden">
                          <div class="flex items-center gap-2">
                              <span class="font-medium text-slate-200 truncate max-w-xs" :title="track.title">{{ track.title || track.filename }}</span>
                              <span v-if="track.hasLyrics" class="text-[10px] bg-emerald-900/40 text-emerald-400 px-1 rounded border border-emerald-700/50 flex-shrink-0 select-none">词</span>
                          </div>
                          <span class="text-xs text-slate-500 font-mono mt-0.5 uppercase">{{ track.extension.replace('.', '') }}</span>
                      </div>
                  </div>
              </td>
              
              <td class="px-6 py-4 max-w-[150px] truncate" :title="track.artist">{{ track.artist || '-' }}</td>
              <td class="px-6 py-4 max-w-[150px] truncate" :title="track.album">{{ track.album || '-' }}</td>
              
              <td class="px-6 py-4">
                <span v-if="track.scrape_status === 0" class="px-2 py-1 bg-amber-500/10 text-amber-400 rounded-full border border-amber-500/20 text-[10px]">{{ $t('status_0') || 'Pending' }}</span>
                <span v-else-if="track.scrape_status === 1" class="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 text-[10px]">{{ $t('status_1') || 'Success' }}</span>
                <span v-else-if="track.scrape_status === 2" class="px-2 py-1 bg-rose-500/10 text-rose-400 rounded-full border border-rose-500/20 text-[10px]">{{ $t('status_2') || 'Failed' }}</span>
                <span v-else class="px-2 py-1 bg-slate-500/10 text-slate-400 rounded-full border border-slate-500/20 text-[10px]">{{ $t('status_3') || 'Ignored' }}</span>
              </td>
              <td class="px-6 py-4 flex items-center gap-2">
                <button @click="$emit('play', track, tracks)" class="w-8 h-8 flex items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-slate-900 transition cursor-pointer" :title="$t('play_now')">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                </button>
                <button @click="$emit('edit', track)" class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-700/50 text-indigo-400 hover:bg-indigo-600 hover:text-white transition cursor-pointer">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                </button>
              </td>
            </tr>
            
            <tr v-if="tracks.length === 0">
              <td colspan="6" class="px-6 py-20 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
                 <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="opacity-20"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                   {{ t('ui.tracks.no_audio') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    
    <OrganizeModal 
      :is-open="isOrganizeModalOpen" 
      @close="isOrganizeModalOpen = false"
      @organized="refresh" 
    />
    
    <DeduplicateModal 
      :is-open="isDeduplicateModalOpen"
      @close="isDeduplicateModalOpen = false"
      @deleted="refresh"
    />
    
    <!-- Confirm Modal -->
    <div v-if="isConfirmOpen" class="fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-sm bg-slate-900/60 transition-all">
        <div class="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl p-6 max-w-sm w-full">
            <h3 class="text-lg font-medium text-slate-200 mb-2">{{ $t('ui.tracks.confirm_rename_title') }}</h3>
            <p class="text-sm text-slate-400 mb-6">{{ $t('ui.tracks.confirm_rename_desc') }}</p>
            <div class="flex justify-end gap-3">
                <button @click="isConfirmOpen = false" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm text-slate-200 transition">{{ $t('ui.tracks.confirm_cancel') }}</button>
                <button @click="executeBatchRename" class="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded text-sm transition font-medium shadow-md shadow-rose-900/20">{{ $t('ui.tracks.confirm_continue') }}</button>
            </div>
        </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import axios from 'axios';
import OrganizeModal from './OrganizeModal.vue';
import DeduplicateModal from './DeduplicateModal.vue';
import { useToast } from '../composables/useToast';

const { showToast } = useToast();
const isOrganizeModalOpen = ref(false);
const isDeduplicateModalOpen = ref(false);
const isConfirmOpen = ref(false);

const tracks = ref<any[]>([]);
const folders = ref<string[]>([]);
const currentFolder = ref('');
const total = ref(0);

const emit = defineEmits(['edit', 'play']);
const { t } = useI18n();

const fetchTracks = async (folderPath = '') => {
  try {
    const res = await axios.get(`/api/tracks?folder=${encodeURIComponent(folderPath)}`);
    if (res.data.success) {
      tracks.value = res.data.data.tracks;
      folders.value = res.data.data.folders;
      currentFolder.value = folderPath;
      total.value = tracks.value.length;
    }
  } catch (e) {
    console.error(e);
  }
};

const onImageError = (e: Event) => {
    if (e.target) {
        (e.target as HTMLElement).style.display = 'none';
    }
};

const enterFolder = (f: string) => {
    const newPath = currentFolder.value ? `${currentFolder.value}/${f}` : f;
    fetchTracks(newPath);
};

const goUp = () => {
    if (!currentFolder.value) return;
    const parts = currentFolder.value.split('/');
    parts.pop();
    fetchTracks(parts.join('/'));
};

const refresh = () => fetchTracks(currentFolder.value);

const renaming = ref(false);

const promptBatchRename = () => {
    if (!currentFolder.value && tracks.value.length === 0) return;
    isConfirmOpen.value = true;
};

const executeBatchRename = async () => {
    isConfirmOpen.value = false;
    renaming.value = true;
    try {
        const res = await axios.post('/api/tracks/batch-rename', { folder: currentFolder.value });
        if (res.data.success) {
            showToast(res.data.message);
            refresh();
        }
    } catch (e) {
        console.error(e);
        showToast('Batch rename failed.');
    } finally {
        renaming.value = false;
    }
};

defineExpose({
    refresh
});

onMounted(() => {
  fetchTracks();
});
</script>
