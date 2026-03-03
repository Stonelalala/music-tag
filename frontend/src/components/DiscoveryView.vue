<template>
  <div class="flex-1 flex flex-col min-w-0 bg-app-primary overflow-auto custom-scrollbar p-2 sm:p-4 md:p-6 space-y-4 md:space-y-6">

    <!-- Bento Card Wrapper -->
    <div class="bento-card flex-1 flex flex-col overflow-hidden">

      <!-- Header / Tab Bar (inside card) -->
      <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-4 border-b border-app bg-app-secondary/30">
        <div class="flex items-center gap-3 md:gap-6">
          <h2 class="text-base md:text-xl font-black text-app-primary flex items-center gap-2 tracking-tighter whitespace-nowrap">
            <div class="w-7 h-7 md:w-8 md:h-8 rounded-full bg-rose-500 flex items-center justify-center shadow-lg shadow-rose-500/20 shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m16 8-8 8"/><path d="M12 16H8v-4"/></svg>
            </div>
            {{ t('tab_discovery') }}
          </h2>
          
          <div class="flex bg-app-muted p-0.5 md:p-1 rounded-full border border-app">
            <button 
              @click="source = 'netease'" 
              :class="[source === 'netease' ? 'btn-app-accent shadow-md' : 'text-app-muted hover:text-app-primary']"
              class="px-3 md:px-5 py-1 md:py-1.5 rounded-full text-[10px] md:text-xs font-black transition-all duration-300 flex items-center gap-1.5"
            >
              <span v-if="source === 'netease'" class="w-1.5 h-1.5 rounded-full bg-white/80 hidden sm:block"></span>
              网易云
            </button>
            <button 
              @click="source = 'qq'" 
              :class="[source === 'qq' ? 'btn-app-accent shadow-md' : 'text-app-muted hover:text-app-primary']"
              class="px-3 md:px-5 py-1 md:py-1.5 rounded-full text-[10px] md:text-xs font-black transition-all duration-300 flex items-center gap-1.5"
            >
              <span v-if="source === 'qq'" class="w-1.5 h-1.5 rounded-full bg-white/80 hidden sm:block"></span>
              QQ
            </button>
          </div>
        </div>

        <button 
          @click="fetchRecommendations" 
          :disabled="loading"
          class="px-3 md:px-5 py-1.5 md:py-2 bg-app-card hover:bg-app-muted text-app-primary rounded-full text-[10px] md:text-xs font-black transition shadow-sm border border-app flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
        >
          <svg v-if="loading" class="animate-spin h-3 w-3 text-rose-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85.83 6.72 2.24L21 8"/><path d="M21 3v5h-5"/></svg>
          {{ t('refresh_btn') }}
        </button>
      </div>

      <!-- Content Area (inside card) -->
      <div class="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar">
      <!-- Loading State -->
      <div v-if="loading && !playlists.length" class="h-64 flex flex-col items-center justify-center gap-4 text-app-secondary">
        <span class="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></span>
        <p class="text-sm font-medium animate-pulse">{{ t('ui.edit.searching') }}</p>
      </div>

      <!-- Main Display -->
      <div v-else class="max-w-[1400px] mx-auto flex flex-col gap-6 md:gap-10">
        
        <!-- Daily 30 Section -->
        <section v-if="source === 'netease'" class="flex flex-col gap-4 md:gap-6">
          <h3 class="text-lg font-bold text-app-primary flex items-center gap-2 px-1">
             <span class="w-1.5 h-6 bg-rose-500 rounded-full"></span>
             每日推荐
          </h3>
          <div 
            @click="toggleDailySongs"
            class="group relative overflow-hidden rounded-2xl md:rounded-3xl bg-gradient-to-br from-rose-700 via-rose-600 to-amber-500 p-5 md:p-8 lg:p-10 cursor-pointer shadow-2xl hover:shadow-[0_20px_60px_-15px_rgba(225,29,72,0.3)] transition-all duration-500 hover:-translate-y-1"
          >
            <!-- Circular Gradient Overlay -->
            <div class="absolute right-0 bottom-0 w-[50%] h-[100%] bg-white/5 rounded-full blur-3xl transform translate-x-1/2 translate-y-1/2"></div>
            
            <div class="relative z-10 flex flex-row items-center gap-4 md:gap-8">
              <!-- Date Badge -->
              <div class="w-16 h-16 md:w-24 md:h-24 lg:w-32 lg:h-32 bg-white/15 backdrop-blur-xl rounded-2xl md:rounded-3xl flex items-center justify-center shadow-2xl border border-white/20 group-hover:rotate-3 transition-transform duration-500 shrink-0">
                <div class="text-center">
                  <span class="block text-2xl md:text-4xl font-black text-white leading-none">{{ new Date().getDate().toString().padStart(2, '0') }}</span>
                  <span class="text-[8px] md:text-[10px] font-black text-white/80 uppercase tracking-[0.15em] md:tracking-[0.2em] mt-1 md:mt-2 block">{{ new Intl.DateTimeFormat('zh-CN', { month: 'long' }).format(new Date()) }}</span>
                </div>
              </div>
              
              <div class="flex-1 text-left min-w-0">
                <h4 class="text-base md:text-xl lg:text-2xl font-black text-white mb-0.5 md:mb-1 truncate">{{ t('downloader.recommend_songs') }}</h4>
                <p class="text-rose-100/70 text-[10px] md:text-xs max-w-md leading-relaxed hidden sm:block">
                  基于您的听歌喜好，为您量身定制的 30 首每日惊喜。
                </p>
                <div class="mt-2 md:mt-4 flex items-center gap-3">
                  <span class="px-2 md:px-2.5 py-0.5 md:py-1 bg-white/10 rounded-full text-[8px] md:text-[9px] font-bold text-white uppercase tracking-wider backdrop-blur-md border border-white/10">30 首歌曲</span>
                  <span v-if="dailySongs.length > 0" class="text-[8px] md:text-[9px] font-bold text-rose-200 hidden sm:inline">点击展开/收起列表</span>
                </div>
              </div>

              <div class="flex flex-col items-center shrink-0">
                 <div class="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white text-rose-600 flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform duration-300">
                    <svg v-if="!isDailyExpanded" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                 </div>
              </div>
            </div>
          </div>

          <!-- Expanded Daily Songs List -->
          <transition 
            enter-active-class="transition duration-300 ease-out" 
            enter-from-class="transform -translate-y-4 opacity-0" 
            enter-to-class="transform translate-y-0 opacity-100"
            leave-active-class="transition duration-200 ease-in"
            leave-from-class="transform translate-y-0 opacity-100"
            leave-to-class="transform -translate-y-4 opacity-0"
          >
            <div v-if="isDailyExpanded" class="bento-card overflow-hidden !rounded-2xl">
               <div class="px-4 py-3 md:px-6 md:py-4 bg-app-muted/40 border-b border-app flex flex-wrap items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <span class="text-[10px] md:text-xs font-black text-rose-500 uppercase tracking-wider px-1.5 py-0.5 bg-rose-500/10 rounded border border-rose-500/20">歌曲列表</span>
                    <span class="text-[9px] md:text-[10px] text-app-secondary font-bold">{{ dailySongs.length }} 首</span>
                  </div>
                  <button 
                    @click="openDailyDownloader" 
                    class="px-3 md:px-4 py-1 md:py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-full text-[10px] md:text-xs font-black transition-all active:scale-95 shadow-lg shadow-rose-600/20 flex items-center gap-1.5"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                    采集全部
                  </button>
               </div>
               <div class="max-h-[400px] md:max-h-[500px] overflow-y-auto custom-scrollbar divide-y divide-app">
                  <div v-for="(song, idx) in dailySongs" :key="song.id" class="px-4 py-3 md:px-6 md:py-4 flex items-center gap-3 md:gap-4 hover:bg-app-muted/50 transition-all group">
                    <span class="w-6 text-[10px] font-mono text-app-muted group-hover:text-rose-500 transition-colors">{{ idx + 1 }}</span>
                    <div class="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl overflow-hidden bg-app-muted shadow-lg shrink-0">
                      <img v-if="song.coverUrl" :src="song.coverUrl" class="w-full h-full object-cover" />
                      <div v-else class="w-full h-full flex items-center justify-center text-app-muted">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                      </div>
                    </div>
                    <div class="flex-1 min-w-0">
                      <h5 class="text-sm font-bold text-app-primary truncate group-hover:text-rose-400 transition-colors">{{ song.title }}</h5>
                      <p class="text-[11px] text-app-secondary truncate">{{ song.artist }} • {{ song.album }}</p>
                    </div>
                    <button 
                      @click="downloadSingleSong(song)" 
                      class="opacity-0 group-hover:opacity-100 p-2.5 hover:bg-rose-500/20 text-app-secondary hover:text-rose-400 rounded-xl transition-all"
                      title="单独下载"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                    </button>
                  </div>
               </div>
            </div>
          </transition>
        </section>

        <!-- Playlists Grid Section -->
        <section class="flex flex-col gap-6">
          <div class="flex items-center justify-between px-1">
            <h3 class="text-lg font-bold text-app-primary flex items-center gap-2">
               <span class="w-1.5 h-6 bg-app-accent rounded-full"></span>
               {{ t('downloader.recommend_playlists') }}
            </h3>
          </div>

          <div v-if="!playlists.length && !loading" class="bento-card p-12 text-center text-app-secondary">
             <p class="mb-4">未检测到您的网易云个性化推荐列表</p>
             <p class="text-xs">请确保您在设置中正确填入了包含权限信息的 Cookie 凭证</p>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6 lg:gap-8">
            <div 
              v-for="playlist in playlists" 
              :key="playlist.id"
              class="group flex flex-col gap-3 cursor-pointer"
              @click="openPlaylist(playlist)"
            >
              <!-- Cover Container -->
              <div class="relative aspect-square overflow-hidden rounded-2xl bg-app-muted shadow-lg group-hover:shadow-2xl transition-all duration-300 transform group-hover:-translate-y-2 ring-1 ring-app">
                <img 
                  :src="playlist.coverUrl" 
                  class="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                  loading="lazy"
                />
                
                <!-- Platform Tag (Top Right) -->
                <div class="absolute right-3 top-3">
                   <span class="px-2.5 py-1 rounded-lg shadow-md bg-rose-600/80 backdrop-blur-md text-[8px] font-black text-white uppercase tracking-widest">
                     NETEASE
                   </span>
                </div>

                <!-- Track Count (Bottom Right) -->
                <div class="absolute right-3 bottom-3">
                   <div class="px-2.5 py-1 rounded-lg shadow-md bg-black/50 backdrop-blur-md text-[9px] font-bold text-white">
                     {{ playlist.trackCount }} 首
                   </div>
                </div>
              </div>

              <div class="flex flex-col gap-1 px-1 pt-1">
                <h5 class="text-sm font-bold text-app-primary line-clamp-2 leading-snug group-hover:text-app-accent transition-colors">
                  {{ playlist.name }}
                </h5>
                <p v-if="playlist.creator" class="text-[10px] text-app-muted truncate">{{ playlist.creator }}</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
    </div><!-- end bento-card -->

    <!-- Details View (Overlay or Modal) -->
    <NeteaseDownloader ref="downloaderRef" :is-open="isDownloaderOpen" @close="isDownloaderOpen = false" />

    <!-- Playlist Tracks Detail Overlay -->
    <transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="translate-y-full opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-full opacity-0"
    >
      <div v-if="selectedPlaylist" class="fixed inset-0 z-[110] p-2 sm:p-4 md:p-10 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" @click.self="selectedPlaylist = null">
        <div class="bg-app-primary border border-app w-full max-w-4xl h-[92vh] sm:h-[85vh] rounded-t-2xl sm:rounded-2xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
           <!-- Detail Header -->
           <div class="relative h-44 sm:h-56 md:h-72 shrink-0 overflow-hidden">
             <img :src="selectedPlaylist.coverUrl" class="w-full h-full object-cover blur-2xl opacity-30 absolute inset-0 scale-110" />
             <div class="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)] via-[var(--bg-primary)]/40 to-transparent"></div>
             
             <button @click="selectedPlaylist = null" class="absolute top-3 right-3 md:top-6 md:right-6 p-2 md:p-3 rounded-full bg-app-muted/80 hover:bg-app-muted text-app-primary transition-all z-20 backdrop-blur-md">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
             </button>

             <div class="absolute bottom-4 left-4 right-4 md:bottom-8 md:left-8 md:right-8 flex flex-row items-end gap-4 md:gap-8 z-10">
               <div class="w-20 h-20 sm:w-28 sm:h-28 md:w-36 md:h-36 rounded-xl md:rounded-2xl overflow-hidden shadow-2xl shrink-0 ring-2 ring-white/10">
                 <img :src="selectedPlaylist.coverUrl" class="w-full h-full object-cover" />
               </div>
               <div class="flex-1 flex flex-col gap-1.5 md:gap-3 text-left min-w-0">
                  <span class="px-2 py-0.5 rounded text-[8px] md:text-[10px] bg-rose-600/80 font-black text-white uppercase tracking-wider w-fit">{{ source.toUpperCase() }}</span>
                  <h2 class="text-base sm:text-xl md:text-2xl font-black text-app-primary tracking-tight line-clamp-2 leading-tight">{{ selectedPlaylist.name }}</h2>
                  <div class="flex flex-wrap items-center gap-2 md:gap-4">
                    <button 
                      @click="downloadEntirePlaylist" 
                      class="px-3 md:px-5 py-1.5 md:py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-full text-[10px] md:text-sm font-black transition-all active:scale-95 shadow-xl shadow-rose-600/30 flex items-center gap-1.5"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                      下载歌单
                    </button>
                    <span class="text-app-secondary text-[10px] md:text-sm font-bold">{{ playlistTracks.length }} 首</span>
                  </div>
               </div>
             </div>
           </div>

           <!-- Track List -->
           <div class="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-4 md:p-6 bg-app-primary">
              <div v-if="isLoadingPlaylist" class="py-20 flex flex-col items-center justify-center gap-4 text-app-muted">
                <span class="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500"></span>
                <p class="text-sm">正在加载音轨列表...</p>
              </div>
              <div v-else class="divide-y divide-app">
                 <div v-for="(track, idx) in playlistTracks" :key="track.id" class="px-2 py-3 md:px-4 md:py-4 flex items-center gap-3 md:gap-4 hover:bg-app-muted/50 transition-all group rounded-lg md:rounded-xl">
                    <span class="w-6 md:w-8 text-[10px] md:text-xs font-mono text-app-muted group-hover:text-rose-500 transition-colors">{{ idx + 1 }}</span>
                    <div class="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl overflow-hidden bg-app-muted shadow-lg shrink-0">
                      <img v-if="track.coverUrl" :src="track.coverUrl" class="w-full h-full object-cover" />
                    </div>
                    <div class="flex-1 min-w-0 flex flex-col text-left">
                      <h5 class="text-[13px] md:text-sm font-bold text-app-primary truncate group-hover:text-rose-400 transition-colors">{{ track.title }}</h5>
                      <p class="text-[10px] md:text-[11px] text-app-secondary truncate">{{ track.artist }} • {{ track.album }}</p>
                    </div>
                    <button 
                      @click="downloadSingleSong(track)" 
                      class="opacity-0 group-hover:opacity-100 p-3 bg-app-muted hover:bg-rose-500 text-app-secondary hover:text-white rounded-xl transition-all shadow-lg"
                      title="单独下载此曲"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                    </button>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import axios from 'axios';
import NeteaseDownloader from './NeteaseDownloader.vue';

const { t } = useI18n();

const source = ref<'netease' | 'qq'>('netease');
const loading = ref(false);
const playlists = ref<any[]>([]);
const dailySongs = ref<any[]>([]);
const isDailyExpanded = ref(false);
const isDownloaderOpen = ref(false);
const downloaderRef = ref<any>(null);

const selectedPlaylist = ref<any>(null);
const playlistTracks = ref<any[]>([]);
const isLoadingPlaylist = ref(false);

const fetchRecommendations = async () => {
    loading.value = true;
    playlists.value = [];
    
    try {
        const cookie = localStorage.getItem('NETEASE_COOKIE') || '';
        if (source.value === 'netease') {
            const res = await axios.get('/api/netease/recommend/playlists', {
                params: { cookie: cookie || undefined }
            });
            if (res.data.success) {
                playlists.value = res.data.data;
            }
        }
    } catch (e: any) {
        console.error('Fetch discovery failed', e);
    } finally {
        loading.value = false;
    }
};

const toggleDailySongs = async () => {
    if (isDailyExpanded.value) {
        isDailyExpanded.value = false;
        return;
    }

    if (dailySongs.value.length === 0) {
        loading.value = true;
        try {
            const cookie = localStorage.getItem('NETEASE_COOKIE') || '';
            const res = await axios.get('/api/netease/recommend/songs', {
                params: { cookie: cookie || undefined }
            });
            if (res.data.success) {
                dailySongs.value = res.data.data;
            }
        } catch (e: any) {
            console.error('Fetch daily songs failed', e);
        } finally {
            loading.value = false;
        }
    }
    isDailyExpanded.value = true;
};

const openDailyDownloader = () => {
    if (downloaderRef.value) {
        isDownloaderOpen.value = true;
        setTimeout(() => {
            downloaderRef.value.parseDailySongs();
        }, 300);
    }
};

const downloadSingleSong = (song: any) => {
    const url = `https://music.163.com/#/song?id=${song.id}`;
    if (downloaderRef.value) {
        isDownloaderOpen.value = true;
        setTimeout(() => {
            downloaderRef.value.inputUrl = url;
            downloaderRef.value.parseUrl();
        }, 300);
    }
};

const openPlaylist = async (playlist: any) => {
    selectedPlaylist.value = playlist;
    playlistTracks.value = [];
    isLoadingPlaylist.value = true;
    
    try {
        const res = await axios.get(`/api/netease/playlist/${playlist.id}`);
        if (res.data.success) {
            playlistTracks.value = res.data.data.tracks || [];
        }
    } catch (e) {
        console.error('Fetch playlist detail failed', e);
    } finally {
        isLoadingPlaylist.value = false;
    }
};

const downloadEntirePlaylist = () => {
    if (!selectedPlaylist.value) return;
    const url = `https://music.163.com/#/playlist?id=${selectedPlaylist.value.id}`;
    if (downloaderRef.value) {
        isDownloaderOpen.value = true;
        setTimeout(() => {
            downloaderRef.value.inputUrl = url;
            downloaderRef.value.parseUrl();
        }, 300);
    }
};

watch(source, () => {
    fetchRecommendations();
});

onMounted(() => {
    fetchRecommendations();
});

// Explicit handle logic or emit if needed
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.1);
}
</style>
