<template>
  <div class="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
    <!-- Header -->
    <header class="bg-slate-800 border-b border-slate-700 py-4 px-6 fixed top-0 w-full z-10 flex items-center justify-between">
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

        <button @click="refreshStatus" class="p-2 text-slate-400 hover:text-white transition cursor-pointer" :title="$t('refresh_btn')">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        </button>
        <div class="relative group">
            <button class="bg-indigo-600 group-hover:bg-indigo-500 transition px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2" :disabled="!!status && status.dbStatus.pending === 0">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                全自动刮削引擎
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ml-1"><path d="m6 9 6 6 6-6"/></svg>
            </button>
            <div class="absolute right-0 mt-2 w-[22rem] bg-slate-800 border border-slate-700 rounded-lg shadow-xl shadow-black/50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 transform origin-top-right scale-95 group-hover:scale-100">
                <div class="p-4 border-b border-slate-700">
                    <p class="text-xs text-slate-400 leading-relaxed">{{ $t('scraper_desc') }}</p>
                    <p v-if="status" class="text-[10px] text-slate-500 mt-2 font-mono truncate" :title="status.musicDir">监听目录: {{ status.musicDir }}</p>
                </div>
                <div class="p-2 flex flex-col gap-1">
                    <button @click="triggerScan" class="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded flex items-center gap-2 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                        强制扫描磁盘增量
                    </button>
                    <button @click="triggerScrape" :disabled="!!status && status.dbStatus.pending === 0" class="w-full text-left px-3 py-2 text-sm text-emerald-400 hover:bg-emerald-500/10 rounded flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                        立刻启动刮削引擎
                    </button>
                    <button disabled class="w-full text-left px-3 py-2 text-sm text-slate-500 cursor-not-allowed rounded">
                        数据源与引擎设置 (敬请期待)
                    </button>
                </div>
            </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 mt-20 p-6 md:p-8 max-w-[1400px] mx-auto w-full">
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

        <TrackList ref="trackListRef" @edit="openEditDrawer" />
    </main>
    
    <TrackDetail :is-open="isDrawerOpen" :track="selectedTrack" @close="closeEditDrawer" @saved="onTrackSaved" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import axios from 'axios';
import { useI18n } from 'vue-i18n';
import TrackList from './components/TrackList.vue';
import TrackDetail from './components/TrackDetail.vue';
import { toastMsg, useToast } from './composables/useToast';

const { t, locale } = useI18n({ useScope: 'global' });
const { showToast: globalShowToast } = useToast();

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
