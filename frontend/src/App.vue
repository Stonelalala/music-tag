<template>
  <div class="h-screen bg-app-primary text-app-primary flex flex-col font-sans overflow-hidden">
    <!-- Header (Fixed Height, No Scroll) -->
    <header class="bg-app-sidebar border-b border-app h-14 px-4 md:px-6 flex-shrink-0 flex items-center justify-between shadow-xl z-50">
      <div class="flex items-center gap-2">
        <!-- Mobile Menu Trigger -->
        <button 
          @click="trackListRef?.openSidebar()" 
          class="md:hidden w-10 h-10 rounded-xl bg-app-accent/10 text-app-accent flex items-center justify-center shrink-0 active:scale-90 transition-transform"
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>

        <!-- Desktop Identity -->
        <div class="hidden md:flex items-center gap-3">
          <div class="w-8 h-8 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          </div>
          <div class="hidden sm:block">
            <h1 class="text-sm md:text-xl font-bold bg-gradient-to-r from-emerald-500 to-cyan-500 bg-clip-text text-transparent truncate">{{ t('title') }}</h1>
            <p class="text-[10px] md:text-xs text-app-muted truncate">{{ t('subtitle') }}</p>
          </div>
        </div>

        <!-- Mobile Title (Compact) -->
        <h1 class="md:hidden text-base font-black tracking-tighter text-app-primary uppercase">{{ t('title').substring(0, 4) }}</h1>
      </div>

      <div class="flex items-center gap-2 md:gap-4">
        <button @click="toggleLang" class="hidden md:block text-xs px-2 py-1 bg-app-muted hover:bg-app-secondary rounded text-app-primary border border-app">
           {{ t('lang_toggle') }}
        </button>

        <button @click="refreshStatus" class="p-2 text-app-muted hover:text-app-primary transition">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        </button>

        <div class="relative group">
            <button class="btn-app-accent transition px-3 md:px-4 py-2 rounded-md font-bold text-sm flex items-center gap-2 shadow-lg" :disabled="!!status && status.dbStatus.pending === 0">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                <span class="hidden sm:inline">{{ t('scraper_title') }}</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ml-1"><path d="m6 9 6 6 6-6"/></svg>
            </button>
            <div class="absolute right-0 mt-2 w-[85vw] sm:w-[22rem] bg-app-sidebar border border-app rounded-lg shadow-xl shadow-black/50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[60] transform origin-top-right scale-95 group-hover:scale-100">
                <div class="p-4 border-b border-app">
                    <p class="text-xs text-app-secondary">{{ t('scraper_desc') }}</p>
                    <p v-if="status" class="text-[10px] text-app-muted mt-2 font-mono truncate">{{ t('watched_dir') }}: {{ status.musicDir }}</p>
                </div>
                <div class="p-2 flex flex-col gap-1">
                    <button @click="triggerScan" class="w-full text-left px-3 py-2 text-sm hover:bg-app-muted rounded flex items-center gap-2 transition text-app-primary">
                        {{ t('scan_btn') }}
                    </button>
                    <button @click="triggerScrape" :disabled="!!status && status.dbStatus.pending === 0" class="w-full text-left px-3 py-2 text-sm text-emerald-400 hover:bg-emerald-500/10 rounded flex items-center gap-2 disabled:opacity-40 transition">
                        {{ t('scrape_btn') }}
                    </button>
                    <div class="h-px bg-slate-700 mx-2 my-1"></div>
                    <button @click="isNeteaseOpen = true" class="w-full text-left px-3 py-2 text-sm text-rose-400 hover:bg-rose-500/10 rounded flex items-center gap-2 transition">
                        {{ t('downloader.title') }}
                    </button>
                    <button @click="isSettingsOpen = true" class="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded flex items-center gap-2 transition text-slate-300">
                        {{ t('settings_btn') }}
                    </button>
                    <div class="md:hidden h-px bg-slate-700 mx-2 my-1"></div>
                    <button @click="toggleLang" class="md:hidden w-full text-left px-3 py-2 text-sm text-slate-400 hover:bg-slate-700 rounded transition">
                        {{ t('lang_toggle') }}
                    </button>
                    <!-- Theme Selector -->
                    <div class="h-px bg-slate-700 mx-2 my-1"></div>
                    <div class="px-3 py-2">
                        <p class="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-2">{{ t('theme_toggle') }}</p>
                        <div class="grid grid-cols-4 gap-2">
                           <button 
                             v-for="tname in themes" 
                             :key="tname" 
                             @click="currentTheme = tname"
                             class="w-full h-6 rounded border transition relative"
                             :class="[currentTheme === tname ? 'border-indigo-400 ring-1 ring-indigo-400' : 'border-slate-700', getThemeColor(tname)]"
                           ></button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </header>

    <!-- Main Content Area (Flexible, No Internal Page Scroll) -->
    <main class="flex-1 overflow-hidden relative">
        <div class="h-full w-full p-2 md:p-3 max-w-full mx-auto flex flex-col">
            <template v-if="status">
                <TrackList 
                    ref="trackListRef" 
                    :status="status"
                    @edit="openEditDrawer" 
                    @play="(track, list) => playTrack(track, list)"
                    @refresh="triggerScan"
                />
            </template>
            <div v-else class="text-center py-20 text-slate-500 flex flex-col items-center justify-center flex-1">
                <div class="animate-pulse flex flex-col items-center gap-4">
                   <div class="w-12 h-12 rounded-full border-4 border-slate-700 border-t-indigo-500 animate-spin"></div>
                   {{ t('connecting') }}
                </div>
            </div>
        </div>
        <!-- Toast messages -->
        <div v-if="toastMsg" class="fixed top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-cyan-400 text-sm px-5 py-3 rounded-full border border-slate-600 shadow-2xl z-[9999] animate-bounce whitespace-nowrap">
            {{ toastMsg }}
        </div>
    </main>

    <!-- Global Components -->
    <MusicPlayer 
        :track="nowPlayingTrack" 
        :playlist="playlist"
        :currentIndex="currentIndex"
        :key="nowPlayingTrack?.id || 'none'" 
        @close="nowPlayingTrack = null" 
        @next="playNext" 
        @prev="playPrev" 
        @select="playAt"
    />
    <TrackDetail :is-open="isDrawerOpen" :track="selectedTrack" @close="closeEditDrawer" @saved="onTrackSaved" />
    <NeteaseDownloader :is-open="isNeteaseOpen" @close="isNeteaseOpen = false" @downloaded="onTrackSaved" />
    <SettingsModal :is-open="isSettingsOpen" @close="isSettingsOpen = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import axios from 'axios';
import { useI18n } from 'vue-i18n';
import TrackList from './components/TrackList.vue';
import TrackDetail from './components/TrackDetail.vue';
import NeteaseDownloader from './components/NeteaseDownloader.vue';
import SettingsModal from './components/SettingsModal.vue';
import MusicPlayer from './components/MusicPlayer.vue';
import { toastMsg, useToast } from './composables/useToast';
import { watch } from 'vue';

const { t, locale } = useI18n({ useScope: 'global' });
const { showToast: globalShowToast } = useToast();

// Theme state
const themes = ['midnight', 'ocean', 'rose', 'forest', 'amber', 'frost', 'sakura', 'mint'];
const currentTheme = ref(localStorage.getItem('APP_THEME') || 'midnight');

const getThemeColor = (name: string) => {
    switch(name) {
        case 'midnight': return 'bg-slate-500';
        case 'ocean': return 'bg-cyan-500';
        case 'rose': return 'bg-rose-500';
        case 'forest': return 'bg-emerald-500';
        case 'amber': return 'bg-amber-500';
        case 'frost': return 'bg-blue-400';
        case 'sakura': return 'bg-rose-300';
        case 'mint': return 'bg-emerald-300';
        default: return 'bg-slate-500';
    }
}

watch(currentTheme, (newTheme) => {
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('APP_THEME', newTheme);
}, { immediate: true });

interface DashboardStatus {
    success: boolean;
    dbStatus: {
        total: number;
        pending: number;
        success: number;
        failed: number;
    },
    musicDir: string;
}

const status = ref<DashboardStatus | null>(null);
let pollInterval: any = null;

// Track Detail Drawer State
const isDrawerOpen = ref(false);
const selectedTrack = ref<any>(null);
const trackListRef = ref<any>(null);

// Player State
const nowPlayingTrack = ref<any>(null);
const playlist = ref<any[]>([]);
const currentIndex = ref(-1);

const playTrack = (track: any, list: any[] = []) => {
    // If it's already playing the same track, do nothing
    if (nowPlayingTrack.value?.id === track.id) return;
    
    // Update playlist if a new list is provided (e.g. current folder)
    if (list.length > 0) {
        playlist.value = list;
        currentIndex.value = list.findIndex(t => t.id === track.id);
    } else if (playlist.value.length === 0) {
        // Fallback for single play
        playlist.value = [track];
        currentIndex.value = 0;
    }

    nowPlayingTrack.value = null;
    setTimeout(() => {
        nowPlayingTrack.value = track;
    }, 50);
};

const playNext = () => {
    if (playlist.value.length === 0) return;
    currentIndex.value = (currentIndex.value + 1) % playlist.value.length;
    nowPlayingTrack.value = null;
    setTimeout(() => {
        nowPlayingTrack.value = playlist.value[currentIndex.value];
    }, 50);
};

const playPrev = () => {
    if (playlist.value.length === 0) return;
    currentIndex.value = (currentIndex.value - 1 + playlist.value.length) % playlist.value.length;
    nowPlayingTrack.value = null;
    setTimeout(() => {
        nowPlayingTrack.value = playlist.value[currentIndex.value];
    }, 50);
};

const playAt = (index: number) => {
    if (index < 0 || index >= playlist.value.length) return;
    currentIndex.value = index;
    nowPlayingTrack.value = null;
    setTimeout(() => {
        nowPlayingTrack.value = playlist.value[currentIndex.value];
    }, 50);
};

// Netease Drawer State
const isNeteaseOpen = ref(false);
const isSettingsOpen = ref(false);

const openEditDrawer = (track: any) => {
    selectedTrack.value = track;
    isDrawerOpen.value = true;
};

const closeEditDrawer = () => {
    isDrawerOpen.value = false;
    setTimeout(() => { selectedTrack.value = null; }, 300); // clear after animation
};

const onTrackSaved = () => {
    showToast('msg_save_ok');
    if (trackListRef.value) {
        trackListRef.value.refresh();
    }
};

const toggleLang = () => {
    locale.value = locale.value === 'en' ? 'zh' : 'en';
};

const showToast = (msgKey: string) => {
    globalShowToast(t(msgKey));
};

const refreshStatus = async () => {
    try {
        const res = await axios.get('/api/status');
        if (res.data.success) {
            status.value = res.data;
        }
    } catch (e) {
        console.error("Failed to connect to backend", e);
    }
};

const triggerScan = async () => {
    try {
        await axios.post('/api/trigger-scan');
        showToast('msg_scan_ok');
        refreshStatus();
        if (trackListRef.value) trackListRef.value.refresh();
    } catch (e) {
        showToast('msg_scan_fail');
    }
};

const triggerScrape = async () => {
    try {
        await axios.post('/api/trigger-scrape');
        showToast('msg_scrape_ok');
        refreshStatus();
        if (trackListRef.value) trackListRef.value.refresh();
    } catch (e) {
        showToast('msg_scrape_fail');
    }
};

onMounted(() => {
    refreshStatus();
    // Auto refresh every 3 seconds to see progress
    pollInterval = setInterval(() => {
        refreshStatus();
        if (trackListRef.value && status.value?.dbStatus.pending && status.value.dbStatus.pending > 0) {
           trackListRef.value.refresh();
        }
    }, 3000);
});

onUnmounted(() => {
    if (pollInterval) clearInterval(pollInterval);
});
</script>
