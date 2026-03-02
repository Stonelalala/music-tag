<template>
  <div class="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
    <!-- Header -->
    <header class="bg-slate-800 border-b border-slate-700 py-4 px-6 fixed top-0 w-full z-40 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <div>
          <h1 class="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">{{ $t('title') }}</h1>
          <p class="text-xs text-slate-400">{{ $t('subtitle') }}</p>
        </div>
      </div>
      <div class="flex items-center gap-4">
        
        <!-- Language Switcher -->
        <button @click="toggleLang" class="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 transition border border-slate-600">
           {{ $t('lang_toggle') }}
        </button>

        <!-- Theme Picker -->
        <div class="relative group/theme">
          <button class="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 transition border border-slate-600 flex items-center gap-1">
             <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
             {{ $t('theme_toggle') }}
          </button>
          <div class="absolute right-0 mt-2 w-32 bg-slate-800 border border-slate-700 rounded shadow-xl opacity-0 invisible group-hover/theme:opacity-100 group-hover/theme:visible transition-all z-50">
             <div class="p-1 flex flex-col gap-1">
                <button v-for="tname in themes" :key="tname" @click="currentTheme = tname" 
                   class="text-left px-2 py-1.5 text-[11px] rounded transition flex items-center gap-2"
                   :class="currentTheme === tname ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700'">
                   <span class="w-2 h-2 rounded-full" :class="getThemeColor(tname)"></span>
                   {{ $t(`theme_${tname}`) }}
                </button>
             </div>
          </div>
        </div>

        <button @click="refreshStatus" class="p-2 text-slate-400 hover:text-slate-100 transition cursor-pointer" :title="$t('refresh_btn')">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        </button>
        <div class="relative group">
            <button class="bg-indigo-600 group-hover:bg-indigo-500 transition px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2" :disabled="!!status && status.dbStatus.pending === 0">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                {{ $t('scraper_title') }}
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ml-1"><path d="m6 9 6 6 6-6"/></svg>
            </button>
            <div class="absolute right-0 mt-2 w-[22rem] bg-slate-800 border border-slate-700 rounded-lg shadow-xl shadow-black/50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 transform origin-top-right scale-95 group-hover:scale-100">
                <div class="p-4 border-b border-slate-700">
                    <p class="text-xs text-slate-400 leading-relaxed">{{ $t('scraper_desc') }}</p>
                    <p v-if="status" class="text-[10px] text-slate-500 mt-2 font-mono truncate" :title="status.musicDir">{{ $t('watched_dir') }}: {{ status.musicDir }}</p>
                </div>
                <div class="p-2 flex flex-col gap-1">
                    <button @click="triggerScan" class="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded flex items-center gap-2 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                        {{ $t('scan_btn') }}
                    </button>
                    <button @click="triggerScrape" :disabled="!!status && status.dbStatus.pending === 0" class="w-full text-left px-3 py-2 text-sm text-emerald-400 hover:bg-emerald-500/10 rounded flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                        {{ $t('scrape_btn') }}
                    </button>
                    <!-- Divider -->
                    <div class="h-px bg-slate-700 mx-2 my-1"></div>
                    <button @click="isNeteaseOpen = true" class="w-full text-left px-3 py-2 text-sm text-rose-400 hover:bg-rose-500/10 rounded flex items-center gap-2 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        {{ $t('downloader.title') }}
                    </button>
                    <button @click="isSettingsOpen = true" class="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded flex items-center gap-2 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                        {{ $t('settings_btn') }}
                    </button>
                </div>
            </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 mt-20 p-6 md:p-8 max-w-[1400px] mx-auto w-full" :class="nowPlayingTrack ? 'pb-24' : ''">
        <!-- Status Cards -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8" v-if="status">
            <div class="bg-slate-800/50 border border-slate-700 p-5 rounded-xl flex flex-col items-center text-center">
                <span class="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">{{ $t('db_total') }}</span>
                <span class="text-3xl font-bold text-slate-100">{{ status.dbStatus.total }}</span>
            </div>
            <div class="bg-emerald-500/5 border border-emerald-500/20 p-5 rounded-xl flex flex-col items-center text-center">
                <span class="text-emerald-400/80 text-xs font-semibold uppercase tracking-wider mb-1">{{ $t('db_success') }}</span>
                <span class="text-3xl font-bold text-emerald-400">{{ status.dbStatus.success }}</span>
            </div>
            <div class="bg-amber-500/5 border border-amber-500/20 p-5 rounded-xl flex flex-col items-center text-center">
                <span class="text-amber-400/80 text-xs font-semibold uppercase tracking-wider mb-1">{{ $t('db_pending') }}</span>
                <span class="text-3xl font-bold text-amber-400">{{ status.dbStatus.pending }}</span>
            </div>
            <div class="bg-rose-500/5 border border-rose-500/20 p-5 rounded-xl flex flex-col items-center text-center">
                <span class="text-rose-400/80 text-xs font-semibold uppercase tracking-wider mb-1">{{ $t('db_failed') }}</span>
                <span class="text-3xl font-bold text-rose-400">{{ status.dbStatus.failed }}</span>
            </div>
        </div>
        
        <div v-else class="text-center py-12 text-slate-500">
            {{ $t('connecting') }}
        </div>

        <!-- Toast messages are integrated below -->
        <div v-if="toastMsg" class="fixed top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-cyan-400 text-sm px-5 py-3 rounded-full border border-slate-600 shadow-2xl z-[9999] animate-bounce whitespace-nowrap">
            {{ toastMsg }}
        </div>

        <TrackList 
            ref="trackListRef" 
            @edit="openEditDrawer" 
            @play="(track, list) => playTrack(track, list)"
        />
    </main>
    
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
