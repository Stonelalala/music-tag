<template>
  <div class="flex flex-col md:flex-row gap-0 md:gap-4 h-full w-full overflow-hidden relative">
    
    <!-- Column 1: Navigation Sidebar (Obsidian Style) -->
    <aside 
      class="fixed inset-y-0 left-0 w-64 bg-app-sidebar border-r border-app transform transition-transform duration-300 ease-in-out z-[100] md:relative md:translate-x-0 flex flex-col"
      :class="isSidebarOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <!-- App Identity / Header -->
      <div class="px-6 py-10 flex items-center gap-3">
        <div class="w-10 h-10 bg-app-accent rounded-xl flex items-center justify-center shadow-lg shadow-app-accent/20">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class="text-white"><path d="M12 2v20"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="M22 12h-4"/><path d="M5.93 19.07 10.17 14.83"/><path d="m13.83 10.17 4.24-4.24"/><path d="M2 12h4"/></svg>
        </div>
        <div>
          <h1 class="text-lg font-black tracking-tighter text-app-primary leading-tight">NAS Music</h1>
          <p class="text-[9px] font-bold text-app-muted uppercase tracking-widest">{{ t('ui.tracks.pro_dashboard') }}</p>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto custom-scrollbar px-3 space-y-8 py-2">
        <!-- Section: Library -->
        <div>
          <h3 class="px-4 text-[10px] font-black text-app-muted uppercase tracking-widest mb-4">{{ t('ui.sidebar.library') }}</h3>
          <ul class="space-y-1">
            <li v-for="item in [{id:'overview', icon:'layout-grid', label:t('tab_dashboard')}]" :key="item.id">
              <button @click="fetchTracks('')" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group" :class="!currentFolder ? 'bg-app-accent/10 text-app-accent shadow-sm' : 'text-app-muted hover:bg-app-accent/10 hover:text-app-primary'">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="opacity-70"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
                <span class="text-xs font-bold leading-none">{{ item.label }}</span>
              </button>
            </li>
          </ul>
        </div>

        <!-- Section: Folders -->
        <div>
          <h3 class="px-4 text-[10px] font-black text-app-muted uppercase tracking-widest mb-4">{{ t('ui.sidebar.folders') }}</h3>
          <ul class="space-y-1">
            <li v-if="currentFolder" class="px-1 mb-2">
                <button @click="goUp" class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-app-accent hover:bg-app-accent/10 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m15 18-6-6 6-6"/></svg>
                    <span class="text-[11px] font-bold">{{ t('ui.sidebar.back') }}</span>
                </button>
            </li>
            
            <li v-for="folder in folders" :key="'sidebar_f_'+folder">
              <button 
                @click="enterFolder(folder)"
                class="w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-colors text-app-muted hover:bg-app-accent/10 hover:text-app-primary group"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-app-muted group-hover:text-app-primary transition-colors opacity-60"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
                <span class="text-xs font-bold truncate max-w-[150px]">{{ folder }}</span>
              </button>
            </li>

            <li v-if="folders.length === 0 && !currentFolder && tracks.length === 0" class="px-4 py-4 text-[10px] items-start text-app-muted italic opacity-60 bg-app-muted/10 rounded-xl">
                {{ t('ui.sidebar.empty') }}
            </li>
          </ul>
        </div>

        <!-- Section: Music Files in Current Folder -->
        <div v-if="tracks.length > 0">
          <h3 class="px-4 text-[10px] font-black text-app-muted uppercase tracking-widest mb-4">{{ t('ui.sidebar.files') || '音乐文件' }}</h3>
          <ul class="space-y-0.5">
            <li v-for="track in tracks" :key="'sidebar_t_'+track.id">
              <button 
                @click="emit('play', track, tracks)"
                class="w-full text-left px-3 py-2 rounded-xl flex items-center gap-3 transition-colors text-app-muted hover:bg-app-accent/10 hover:text-app-primary group"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-app-accent/60 group-hover:text-app-accent transition-colors shrink-0"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                <div class="flex flex-col min-w-0">
                  <span class="text-[11px] font-bold truncate max-w-[150px]">{{ track.title || track.filename }}</span>
                  <span class="text-[9px] text-app-muted truncate max-w-[150px]">{{ track.artist }}</span>
                </div>
              </button>
            </li>
          </ul>
        </div>
      </div>

      <!-- User Profile Card -->
      <div class="p-4 border-t border-app">
          <div class="bg-app-muted/20 rounded-2xl p-4 flex items-center gap-3 border border-app shadow-inner">
              <div class="w-10 h-10 rounded-full overflow-hidden bg-app-muted border border-app shadow-sm">
                  <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Admin" class="w-full h-full object-cover" />
              </div>
              <div class="flex-1 min-w-0">
                  <p class="text-[11px] font-black text-app-primary truncate">Admin NAS</p>
                  <p class="text-[9px] font-bold text-app-muted uppercase tracking-widest">{{ t('ui.tracks.pro_plan') }}</p>
              </div>
              <button class="text-app-muted hover:text-app-primary transition-colors pr-1">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1V15a2 2 0 0 1-2-2 2 2 0 0 1 2-2v-.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2v.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              </button>
          </div>
      </div>
    </aside>


    <!-- Mobile Overlay Backdrop -->
    <div 
      v-if="isSidebarOpen" 
      @click="isSidebarOpen = false" 
      class="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
    ></div>

    <!-- Column 2: Music Library List Area -->
    <div class="flex-1 flex flex-col min-w-0 bg-app-primary overflow-auto custom-scrollbar p-6 space-y-6">
      
      <!-- Bento Header Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 shrink-0">
        <!-- Main Info Card -->
        <div class="lg:col-span-2 bento-card p-8 flex flex-col justify-between relative overflow-hidden group">
            <div class="absolute -right-10 -top-10 w-40 h-40 bg-app-accent/10 rounded-full blur-3xl group-hover:bg-app-accent/20 transition-colors"></div>
            <div class="relative z-10">
                <h1 class="text-3xl md:text-4xl font-black text-app-primary tracking-tighter mb-4">{{ t('ui.tracks.hi_res_library') }}</h1>
                <p class="text-app-secondary text-sm max-w-md leading-relaxed">
                    {{ t('ui.tracks.sync_desc', { count: status?.dbStatus.total || 0 }) }}
                </p>
            </div>
            <div class="flex items-center gap-3 mt-8">
                <div class="flex -space-x-3">
                    <div v-for="i in 3" :key="i" class="w-10 h-10 rounded-full border-2 border-app bg-app-muted flex items-center justify-center text-[10px] font-bold overflow-hidden shadow-lg">
                        <img v-if="tracks[i-1]" :src="`/api/tracks/${tracks[i-1].id}/cover`" class="w-full h-full object-cover" />
                        <span v-else>?</span>
                    </div>
                </div>
                <span class="text-[10px] font-bold text-app-muted uppercase tracking-widest ml-2">{{ t('ui.tracks.recently_scanned') }}</span>
            </div>
        </div>

        <!-- Status & Actions Card -->
        <div class="bento-card p-6 flex flex-col h-full justify-between">
            <div class="flex justify-between items-start">
                <span class="text-[10px] font-black uppercase tracking-[0.2em] text-app-muted">{{ t('ui.tracks.overall_stats') }}</span>
                <span class="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase flex items-center gap-1">
                    <span class="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span> {{ t('ui.tracks.live') }}
                </span>
            </div>
            <div class="space-y-4 mt-4">
                <div class="flex justify-between items-end border-b border-app/30 pb-2">
                    <span class="text-xs text-app-secondary font-medium">{{ t('ui.tracks.synced_ok') }}</span>
                    <span class="text-xl font-black text-emerald-500">{{ status?.dbStatus.success || 0 }}</span>
                </div>
                <div class="flex justify-between items-end">
                    <span class="text-xs text-app-secondary font-medium">{{ t('ui.tracks.need_fix') }}</span>
                    <span class="text-xl font-black text-rose-500">{{ status?.dbStatus.failed || 0 }}</span>
                </div>
            </div>
            <button @click="emit('refresh')" class="mt-6 w-full py-2.5 bg-app-muted hover:bg-app-accent hover:text-white rounded-xl text-xs font-bold text-app-primary flex items-center justify-center gap-2 transition-all active:scale-[0.98] border border-app shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="opacity-60"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                {{ t('ui.tracks.rescan_lib') }}
            </button>
        </div>
      </div>

      <!-- Main Table Card -->
      <div class="bento-card flex-1 flex flex-col min-h-[500px] overflow-hidden">
        <!-- Table Header Toolbar -->
        <div class="px-6 py-4 border-app border-b flex items-center justify-between bg-app-secondary/30">
            <!-- Explorer Breadcrumb -->
            <div class="flex items-center gap-2">
                <div class="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-app-accent cursor-pointer hover:opacity-80" @click="fetchTracks('')">
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
            <tr v-for="(track, index) in tracks" :key="track.id" @click="emit('play', track, tracks)" class="hover:bg-app-accent/5 transition-all duration-300 group cursor-pointer border-b border-app/5 last:border-0">
              <td class="px-6 py-5 font-mono text-[10px] text-app-muted text-center group-hover:text-app-accent transition-colors">{{ index + 1 }}</td>
              <td class="px-3 py-3">
                  <div class="flex items-center gap-4">
                      <div class="w-14 h-14 bg-app-muted rounded-xl overflow-hidden flex-shrink-0 border border-app shadow-2xl group-hover:scale-105 transition-transform relative">
                          <img :src="`/api/tracks/${track.id}/cover`" @error="onImageError" class="w-full h-full object-cover" />
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
    </div>

    <!-- Modals -->
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
    
    <div v-if="isConfirmOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-xl bg-black/70 transition-all">
        <div class="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-8 max-w-sm w-full animate-in zoom-in-95 fade-in duration-200">
            <h3 class="text-xl font-bold text-white mb-3 tracking-tight">{{ $t('ui.tracks.confirm_rename_title') }}</h3>
            <p class="text-slate-400 text-sm leading-relaxed mb-8">{{ $t('ui.tracks.confirm_rename_desc') }}</p>
            <div class="flex gap-4">
                <button @click="isConfirmOpen = false" class="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm text-white transition font-bold">{{ $t('ui.tracks.confirm_cancel') }}</button>
                <button @click="executeBatchRename" class="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm transition font-bold shadow-lg shadow-indigo-900/40">{{ $t('ui.tracks.confirm_continue') }}</button>
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

const props = defineProps<{
  status: any | null
}>();

const emit = defineEmits(['edit', 'play', 'refresh']);
const { t } = useI18n();

const { showToast } = useToast();
const isOrganizeModalOpen = ref(false);
const isDeduplicateModalOpen = ref(false);
const isConfirmOpen = ref(false);
const isSidebarOpen = ref(false);

const tracks = ref<any[]>([]);
const folders = ref<string[]>([]);
const currentFolder = ref('');
const total = ref(0);
const currentStatusFilter = ref<number | null>(null);

const formatSize = (bytes: number) => {
    if (!bytes) return '-';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const fetchTracks = async (folderPath = '', statusFilter: number | null = null) => {
  try {
    currentStatusFilter.value = statusFilter;
    let url = `/api/tracks?folder=${encodeURIComponent(folderPath)}`;
    if (statusFilter !== null) {
        url += `&status=${statusFilter}`;
    }
    const res = await axios.get(url);
    if (res.data.success) {
      tracks.value = res.data.data.tracks;
      folders.value = res.data.data.folders;
      currentFolder.value = folderPath;
      total.value = tracks.value.length;
      // On mobile, keep sidebar open for easier deep-folder navigation as requested
      // it will only close when user clicks the backdrop or close button
      /*
      if (window.innerWidth < 768) {
        isSidebarOpen.value = false;
      }
      */
    }
  } catch (e) {
    console.error(e);
  }
};

const onImageError = (e: Event) => {
    if (e.target) {
        (e.target as HTMLElement).style.display = 'none';
        ((e.target as HTMLElement).parentElement as HTMLElement).classList.add('flex', 'items-center', 'justify-center', 'bg-slate-800');
        ((e.target as HTMLElement).parentElement as HTMLElement).innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-slate-600"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
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

const refresh = () => {
  fetchTracks(currentFolder.value, currentStatusFilter.value);
};

const renaming = ref(false);
const promptBatchRename = () => {
    isConfirmOpen.value = true;
};

const executeBatchRename = async () => {
    isConfirmOpen.value = false;
    renaming.value = true;
    try {
        const res = await axios.post('/api/batch-rename', {
            folder: currentFolder.value
        });
        if (res.data.success) {
            showToast(t('ui.tracks.rename_success'));
            refresh();
        }
    } catch (e: any) {
        showToast(e.response?.data?.error || t('msg_save_fail'));
    } finally {
        renaming.value = false;
    }
};

onMounted(() => {
  fetchTracks();
});

const openSidebar = () => {
    isSidebarOpen.value = true;
};

defineExpose({
    refresh,
    openSidebar
});
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
