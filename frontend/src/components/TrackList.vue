<template>
  <div class="flex-1 flex flex-col min-w-0 bg-app-primary overflow-auto custom-scrollbar p-3 md:p-4 space-y-4">
      


      <!-- Main Table Card -->
      <div class="flex-1 flex flex-col min-h-[500px] overflow-hidden">
        <!-- Table Header Toolbar -->
        <div class="px-6 py-4 border-app border-b flex items-center justify-between bg-app-secondary/30">
            <!-- Explorer Breadcrumb -->
            <div class="flex items-center gap-2">
                <div class="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-app-accent cursor-pointer hover:opacity-80" @click="emit('fetch-tracks', '')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    <span>{{ t('ui.tracks.root') }}</span>
                </div>
                <template v-if="currentFolder">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="opacity-20"><path d="m9 18 6-6-6-6"/></svg>
                    <span class="text-[11px] font-bold text-app-primary bg-app-accent/10 px-2 py-0.5 rounded border border-app-accent/20 max-w-[200px] truncate">{{ currentFolder }}</span>
                </template>
            </div>

            <!-- Header Actions -->
            <div class="flex items-center gap-3">
                <div class="flex items-center bg-app-muted/30 rounded-lg p-1 border border-app">
                  <button @click="isOrganizeModalOpen = true" class="p-2 hover:bg-app-muted rounded-md text-app-secondary transition-all" :title="t('ui.sidebar.organize')">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
                  </button>
                  <button @click="isDeduplicateModalOpen = true" class="p-2 hover:bg-app-muted rounded-md text-app-secondary transition-all" :title="t('ui.sidebar.dedupe')">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                  </button>
                </div>
                
                <button 
                  @click="promptBatchRename" 
                  :disabled="renaming || tracks.length === 0"
                  class="px-4 py-2 btn-app-accent rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg disabled:opacity-50 active:scale-95"
                >
                  <svg v-if="!renaming" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22a9.97 9.97 0 0 0 7.07-2.93L22 16"/><path d="M22 16h-6"/><path d="M22 16V10"/><path d="M12 2a9.97 9.97 0 0 0-7.07 2.93L2 8"/><path d="M2 8h6"/><path d="M2 8v6"/></svg>
                  <div v-else class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span class="hidden sm:inline">{{ renaming ? t('ui.tracks.renaming') : t('ui.tracks.rename_btn') }}</span>
                </button>
            </div>
        </div>

        <!-- Desktop Table View -->
        <div class="flex-1 overflow-auto custom-scrollbar">
            <table class="w-full text-left text-xs text-app-secondary whitespace-nowrap border-separate border-spacing-0">
              <thead class="text-[10px] text-app-muted uppercase font-black tracking-widest bg-app-sidebar/50 sticky top-0 z-10 border-b border-app backdrop-blur-md">
                <tr>
                  <th class="px-6 py-5 w-12 text-center text-app-accent font-black">#</th>
                  <th class="px-3 py-5 text-[11px]">{{ $t('col_title') }} & {{ $t('col_artist') }}</th>
                  <th class="px-3 py-5 text-[11px] hidden md:table-cell uppercase">{{ t('col_album') }}</th>
                  <th class="px-3 py-5 text-[11px] hidden lg:table-cell text-center uppercase">{{ t('col_size') }}</th>
                  <th class="px-3 py-5 text-[11px] hidden sm:table-cell uppercase">{{ $t('col_status') }}</th>
                  <th class="px-3 py-5 w-24 text-right pr-8 uppercase">{{ $t('col_actions') }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-app/10">
                <tr v-for="(track, index) in paginatedTracks" :key="track.id" @click="emit('play', track, tracks)" class="hover:bg-app-accent/5 transition-all duration-300 group cursor-pointer border-b border-app/5 last:border-0">
                  <td class="px-6 py-5 font-mono text-[10px] text-app-muted text-center group-hover:text-app-accent transition-colors">{{ (currentPage - 1) * itemsPerPage + index + 1 }}</td>
                  <td class="px-3 py-3">
                      <div class="flex items-center gap-4">
                          <div class="w-14 h-14 bg-app-muted rounded-xl overflow-hidden flex-shrink-0 border border-app shadow-2xl group-hover:scale-105 transition-transform relative">
                              <img loading="lazy" :src="`/api/tracks/${track.id}/cover${token ? '?auth=' + token : ''}`" @error="onImageError" class="w-full h-full object-cover" />
                              <div class="absolute inset-0 bg-app-accent/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" class="text-white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                              </div>
                          </div>
                          <div class="flex flex-col min-w-0">
                              <span class="font-bold text-app-primary text-[13px] group-hover:text-app-accent transition-colors truncate max-w-[150px] sm:max-w-xs md:max-w-md">{{ track.title }}</span>
                              <span class="text-[11px] text-app-muted font-semibold mt-1 truncate">{{ track.artist }}</span>
                          </div>
                      </div>
                  </td>
                  <td class="px-3 py-5 hidden md:table-cell">
                      <span class="text-xs text-app-secondary font-medium italic opacity-70">{{ track.album }}</span>
                  </td>
                  <td class="px-3 py-5 hidden lg:table-cell text-center">
                      <span class="font-mono text-[10px] text-app-muted px-2 py-1 rounded bg-app-muted/20 border border-app border-white/5">{{ formatSize(track.size) }}</span>
                  </td>
                  <td class="px-3 py-5 hidden sm:table-cell">
                      <div class="flex items-center">
                          <span v-if="track.scrape_status === 1" class="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase tracking-tighter">
                              {{ t('ui.tracks.matched') }}
                          </span>
                          <span v-else-if="track.scrape_status === 2" class="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-500/10 text-rose-500 border border-rose-500/20 uppercase tracking-tighter">
                              {{ t('ui.tracks.error') }}
                          </span>
                          <span v-else class="px-2 py-0.5 rounded-full text-[9px] font-black bg-app-muted/50 text-app-muted border border-app uppercase tracking-tighter">
                              {{ t('ui.tracks.pending') }}
                          </span>
                      </div>
                  </td>
                  <td class="px-3 py-5 text-right pr-6" @click.stop>
                      <button @click="emit('edit', track)" class="p-2.5 rounded-xl bg-app-muted/30 border border-app hover:bg-app-accent/20 hover:text-app-accent hover:border-app-accent/30 transition-all active:scale-95 group/btn">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="opacity-60 group-hover/btn:opacity-100"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                      </button>
                  </td>
                </tr>
              </tbody>
            </table>
            
            <!-- Pagination Controls -->
            <div v-if="totalPages > 1" class="px-6 py-4 flex items-center justify-between border-t border-app bg-app-primary/50 sticky bottom-0 backdrop-blur-md z-10">
                <span class="text-[11px] text-app-muted font-bold tracking-widest uppercase">
                    Page {{ currentPage }} / {{ totalPages }} (Total {{ tracks.length }})
                </span>
                <div class="flex items-center gap-2">
                    <button 
                        @click="currentPage--" 
                        :disabled="currentPage === 1"
                        class="px-3 py-1.5 rounded-lg bg-app-muted/50 hover:bg-app-accent hover:text-white border border-app text-xs font-bold transition-colors disabled:opacity-30 disabled:pointer-events-none"
                    >
                        Prev
                    </button>
                    <button 
                        @click="currentPage++" 
                        :disabled="currentPage === totalPages"
                        class="px-3 py-1.5 rounded-lg bg-app-muted/50 hover:bg-app-accent hover:text-white border border-app text-xs font-bold transition-colors disabled:opacity-30 disabled:pointer-events-none"
                    >
                        Next
                    </button>
                </div>
            </div>
            
            <!-- Empty State -->
            <div v-if="tracks.length === 0" class="py-32 text-center flex flex-col items-center gap-6">
                <div class="relative">
                  <div class="absolute -inset-4 bg-indigo-500/10 blur-2xl rounded-full animate-pulse"></div>
                  <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-slate-800 relative z-10"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                </div>
                <div class="space-y-1">
                  <p class="text-slate-300 font-bold text-base">{{ t('ui.tracks.no_audio') }}</p>
                  <p class="text-slate-500 text-sm italic">{{ t('ui.tracks.no_audio_hint') }}</p>
                </div>
            </div>
        </div>
      </div>

    <!-- Modals -->
    <OrganizeModal 
      :is-open="isOrganizeModalOpen" 
      @close="isOrganizeModalOpen = false"
      @organized="emit('refresh')" 
    />
    
    <DeduplicateModal 
      :is-open="isDeduplicateModalOpen"
      @close="isDeduplicateModalOpen = false"
      @deleted="emit('refresh')"
    />
    
    <div v-if="isConfirmOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-xl bg-black/70 transition-all">
        <div class="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-8 max-w-sm w-full animate-in zoom-in-95 fade-in duration-200">
            <h3 class="text-xl font-bold text-white mb-3 tracking-tight">{{ t('ui.tracks.confirm_rename_title') }}</h3>
            <p class="text-slate-400 text-sm leading-relaxed mb-8">{{ t('ui.tracks.confirm_rename_desc') }}</p>
            <div class="flex gap-4">
                <button @click="isConfirmOpen = false" class="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm text-white transition font-bold">{{ t('ui.tracks.confirm_cancel') }}</button>
                <button @click="executeBatchRename" class="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm transition font-bold shadow-lg shadow-indigo-900/40">{{ t('ui.tracks.confirm_continue') }}</button>
            </div>
        </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import axios from 'axios';
import OrganizeModal from './OrganizeModal.vue';
import DeduplicateModal from './DeduplicateModal.vue';
import { useToast } from '../composables/useToast';
import { useAuth } from '../composables/useAuth';

const props = defineProps<{
  status: any | null,
  tracks: any[],
  folders: string[],
  currentFolder: string
}>();

const emit = defineEmits(['edit', 'play', 'refresh', 'enter-folder', 'fetch-tracks']);

const { token } = useAuth();
const { t } = useI18n();
const { showToast } = useToast();

const isOrganizeModalOpen = ref(false);
const isDeduplicateModalOpen = ref(false);
const isConfirmOpen = ref(false);

// Pagination logic
const currentPage = ref(1);
const itemsPerPage = 50;

// Reset page when switching folder 
watch(() => props.currentFolder, () => {
    currentPage.value = 1;
});

// Since we fetch the whole folder, perform frontend pagination for performance constraints
const totalPages = computed(() => Math.ceil(props.tracks.length / itemsPerPage));

const paginatedTracks = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage;
    return props.tracks.slice(start, start + itemsPerPage);
});

const formatSize = (bytes: number) => {
    if (!bytes) return '-';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const onImageError = (e: Event) => {
    if (e.target) {
        (e.target as HTMLElement).style.display = 'none';
        ((e.target as HTMLElement).parentElement as HTMLElement).classList.add('flex', 'items-center', 'justify-center', 'bg-slate-800');
        ((e.target as HTMLElement).parentElement as HTMLElement).innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-slate-600"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
    }
};

const renaming = ref(false);
const promptBatchRename = () => {
    isConfirmOpen.value = true;
};

const executeBatchRename = async () => {
    isConfirmOpen.value = false;
    try {
        const res = await axios.post('/api/batch-rename', {
            folder: props.currentFolder
        });
        if (res.data.success) {
            showToast(t('msg_task_started')); // Task started
            emit('refresh');
        }
    } catch (e: any) {
        showToast(e.response?.data?.error || t('msg_save_fail'));
    }
};
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #475569;
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
