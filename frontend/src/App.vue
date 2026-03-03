<template>
  <!-- Login Page (Always Dark Theme for high contrast) -->
  <div v-if="!isAuthenticated" class="h-screen w-screen bg-[#020617] flex items-center justify-center p-4 selection:bg-emerald-500/30">
    <!-- Animated background glow -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <div class="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px]"></div>
        <div class="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]"></div>
    </div>

    <div class="w-full max-w-md bg-[#0f172a] border border-white/5 rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] p-10 space-y-8 relative z-10">
      <div class="text-center space-y-3">
        <div class="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/5 transition-transform hover:scale-105 duration-500">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        </div>
        <h1 class="text-3xl font-black text-white tracking-tight">{{ t('login.title') || '用户登录' }}</h1>
        <p class="text-slate-400 font-medium">{{ t('login.subtitle') || '请验证您的身份以管理音乐库' }}</p>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-6">
        <div class="space-y-2">
          <label class="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">{{ t('login.username') || '用户名' }}</label>
          <div class="relative group">
              <input 
                v-model="loginForm.username" 
                type="text" 
                class="w-full bg-[#1e293b] border border-white/10 rounded-2xl px-5 py-4 text-white font-bold placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:bg-[#0f172a] transition-all duration-300"
                style="color: white !important;"
                placeholder="admin"
              />
          </div>
        </div>
        <div class="space-y-2">
          <label class="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">{{ t('login.password') || '密码' }}</label>
          <div class="relative group">
              <input 
                v-model="loginForm.password" 
                type="password" 
                class="w-full bg-[#1e293b] border border-white/10 rounded-2xl px-5 py-4 text-white font-bold placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:bg-[#0f172a] transition-all duration-300"
                style="color: white !important;"
                placeholder="••••••••"
              />
          </div>
        </div>

        <div v-if="loginError" class="text-rose-400 text-xs text-center font-bold bg-rose-500/10 py-3 rounded-xl border border-rose-500/20 animate-in fade-in zoom-in-95">
          {{ loginError }}
        </div>

        <button 
          type="submit" 
          :disabled="isLoggingIn"
          class="w-full bg-emerald-500 hover:bg-emerald-400 text-[#020617] font-black py-4 rounded-2xl shadow-xl shadow-emerald-500/10 active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
        >
          <div class="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <span v-if="!isLoggingIn" class="relative z-10">{{ t('login.submit') || '立 刻 入 库' }}</span>
          <span v-else class="flex items-center justify-center gap-3 relative z-10">
            <div class="w-5 h-5 border-3 border-slate-950/30 border-t-slate-950 rounded-full animate-spin"></div>
            {{ t('login.logging_in') || '验证中...' }}
          </span>
        </button>
      </form>

      <div class="text-center pt-6 border-t border-white/5">
        <button @click="toggleLang" class="text-slate-500 hover:text-white text-xs font-bold transition-colors uppercase tracking-widest">
          {{ t('lang_toggle') === '中文' ? 'English' : '中文' }} / LOCALES
        </button>
      </div>
    </div>
  </div>

  <div v-else class="h-screen bg-app-primary text-app-primary flex flex-col font-sans overflow-hidden">
    <!-- Header (Fixed Height, No Scroll) -->
    <header class="bg-app-sidebar border-b border-app h-14 px-4 md:px-6 flex-shrink-0 flex items-center justify-between shadow-xl z-50">
      <div class="flex items-center gap-2">
        <!-- Mobile Menu Trigger -->
        <button 
          @click="isSidebarOpen = true" 
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
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
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
                    <div class="h-px bg-slate-700 mx-2 my-1"></div>
                    <button @click="logout" class="w-full text-left px-3 py-2 text-sm text-rose-400 hover:bg-rose-500/10 rounded flex items-center gap-2 transition">
                         <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                         {{ t('logout_btn') }}
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
    
    <div class="flex flex-1 overflow-hidden relative">
      <!-- Global Sidebar (Moved from TrackList) -->
      <aside 
        class="fixed inset-y-0 left-0 w-64 bg-app-sidebar border-r border-app transform transition-transform duration-300 ease-in-out z-[100] md:relative md:translate-x-0 flex flex-col shrink-0"
        :class="isSidebarOpen ? 'translate-x-0' : '-translate-x-full'"
      >
        <!-- Logo / Brand Section -->
        <div class="px-6 py-8 flex items-center justify-between border-b border-app mb-4">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
            </div>
            <h1 class="text-lg font-black text-app-primary">{{ t('title').substring(0, 4) }}</h1>
          </div>
          <!-- Mobile Close Button -->
          <button @click="isSidebarOpen = false" class="md:hidden p-2 text-app-muted hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-8 scrollbar-hide">
          <!-- Main Navigation -->
          <div>
            <h3 class="px-4 text-[10px] font-black text-app-muted uppercase tracking-widest mb-4">Navigation</h3>
            <ul class="space-y-1">
              <li>
                <button 
                  @click="switchToTab('library')" 
                  class="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group lg:hover:bg-app-accent/10"
                  :class="currentTab === 'library' ? 'bg-app-accent text-white shadow-lg shadow-app-accent/20' : 'text-app-secondary'"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
                  <span class="text-sm font-bold">{{ t('tab_tracks') }}</span>
                </button>
              </li>
              <li>
                <button 
                  @click="switchToTab('discovery')" 
                  class="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group lg:hover:bg-rose-500/10"
                  :class="currentTab === 'discovery' ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/20' : 'text-app-secondary'"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="m16 8-8 8"/><path d="M12 16H8v-4"/></svg>
                  <span class="text-sm font-bold">{{ t('tab_discovery') }}</span>
                </button>
              </li>
            </ul>
          </div>

          <!-- Dynamic Folders Section (Only shown for library) -->
          <div v-if="currentTab === 'library'">
            <div class="flex items-center justify-between px-4 mb-4">
              <h3 class="text-[10px] font-black text-app-muted uppercase tracking-widest">{{ t('ui.sidebar.folders') }}</h3>
              <button v-if="currentFolder" @click="goUp" class="text-[10px] font-bold text-app-accent hover:underline">
                {{ t('ui.sidebar.back') }}
              </button>
            </div>
            
            <ul class="space-y-0.5">
              <li v-for="folder in folders" :key="'global_f_'+folder">
                <button 
                  @click="enterFolder(folder)"
                  class="w-full text-left px-4 py-2.5 rounded-xl flex items-center gap-3 transition-colors text-app-muted hover:bg-app-accent/10 hover:text-app-primary group"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="opacity-40 group-hover:opacity-100 transition-opacity"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
                  <span class="text-[13px] font-medium truncate">{{ folder }}</span>
                </button>
              </li>
              <li v-if="folders.length === 0 && !currentFolder" class="px-4 py-6 text-center text-xs text-app-muted italic border-2 border-dashed border-app rounded-2xl">
                 {{ t('ui.sidebar.empty') }}
              </li>
            </ul>
          </div>
        </div>

        <!-- Footer Actions in Sidebar -->
        <div class="p-4 border-t border-app space-y-2">
            <button @click="isSettingsOpen = true" class="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-app-secondary hover:bg-app-muted transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
              <span class="text-xs font-bold">{{ t('settings_btn') }}</span>
            </button>
            <button @click="logout" class="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              <span class="text-xs font-bold">{{ t('logout_btn') }}</span>
            </button>
        </div>
      </aside>

      <!-- Mobile Overlay Backdrop -->
      <transition enter-active-class="transition-opacity duration-300" enter-from-class="opacity-0" enter-to-class="opacity-100" leave-active-class="transition-opacity duration-200" leave-from-class="opacity-100" leave-to-class="opacity-0">
        <div v-if="isSidebarOpen" @click="isSidebarOpen = false" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] md:hidden"></div>
      </transition>

      <!-- Main Content Area -->
      <main class="flex-1 overflow-hidden relative">
          <div class="h-full w-full p-2 md:p-4 max-w-full mx-auto flex flex-col overflow-auto custom-scrollbar">
              <template v-if="status">
                  <template v-if="currentTab === 'library'">
                      <TrackList 
                          :status="status"
                          :tracks="tracks"
                          :folders="folders"
                          :current-folder="currentFolder"
                          @edit="openEditDrawer" 
                          @play="(track, list) => playTrack(track, list)"
                          @refresh="triggerScan"
                          @enter-folder="enterFolder"
                          @fetch-tracks="fetchTracks"
                      />
                  </template>
                  <template v-else-if="currentTab === 'discovery'">
                      <DiscoveryView />
                  </template>
              </template>
              <div v-else class="text-center py-20 text-slate-500 flex flex-col items-center justify-center flex-1">
                  <div class="animate-pulse flex flex-col items-center gap-4">
                     <div class="w-12 h-12 rounded-full border-4 border-slate-700 border-t-emerald-500 animate-spin"></div>
                     {{ t('connecting') }}
                  </div>
              </div>
          </div>
          <!-- Toast messages -->
          <div v-if="toastMsg" class="fixed top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-cyan-400 text-sm px-5 py-3 rounded-full border border-slate-600 shadow-2xl z-[9999] animate-bounce whitespace-nowrap">
              {{ toastMsg }}
          </div>
      </main>
    </div>

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
import DiscoveryView from './components/DiscoveryView.vue';
import { toastMsg, useToast } from './composables/useToast';
import { useAuth } from './composables/useAuth';
import { watch, reactive } from 'vue';

const { t, locale } = useI18n({ useScope: 'global' });
const { showToast: globalShowToast } = useToast();
const { isAuthenticated, login, logout, token } = useAuth();

// Login State
const loginForm = reactive({ username: '', password: '' });
const isLoggingIn = ref(false);
const loginError = ref('');

const handleLogin = async () => {
    if (!loginForm.username || !loginForm.password) return;
    isLoggingIn.value = true;
    loginError.value = '';
    const result = await login(loginForm.username, loginForm.password);
    isLoggingIn.value = false;
    if (result.success) {
        refreshStatus();
    } else {
        loginError.value = result.error || 'Unknown error';
    }
};

// App Tabbing
const currentTab = ref('library'); // 'library' | 'discovery'
const isSidebarOpen = ref(false);

const tracks = ref<any[]>([]);
const folders = ref<string[]>([]);
const currentFolder = ref('');

const fetchTracks = async (folderPath = '') => {
  try {
    const res = await axios.get(`/api/tracks?folder=${encodeURIComponent(folderPath)}`);
    if (res.data.success) {
      tracks.value = res.data.data.tracks;
      folders.value = res.data.data.folders;
      currentFolder.value = folderPath;
    }
  } catch (e) {
    console.error(e);
  }
};

const enterFolder = (f: string) => {
    const newPath = currentFolder.value ? `${currentFolder.value}/${f}` : f;
    fetchTracks(newPath);
    if (window.innerWidth < 768) isSidebarOpen.value = false;
};

const goUp = () => {
    if (!currentFolder.value) return;
    const parts = currentFolder.value.split('/');
    parts.pop();
    fetchTracks(parts.join('/'));
};

const switchToTab = (tab: string) => {
    currentTab.value = tab;
    if (window.innerWidth < 768) isSidebarOpen.value = false;
};

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
        // Append auth token to media URLs for the player
        const trackWithAuth = { ...track };
        if (token.value) {
            trackWithAuth._streamUrl = `/api/tracks/${track.id}/stream?auth=${token.value}`;
            trackWithAuth._coverUrl = `/api/tracks/${track.id}/cover?auth=${token.value}`;
        }
        nowPlayingTrack.value = trackWithAuth;
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
    fetchTracks(currentFolder.value);
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
        fetchTracks(currentFolder.value);
    } catch (e) {
        showToast('msg_scan_fail');
    }
};

const triggerScrape = async () => {
    try {
        await axios.post('/api/trigger-scrape');
        showToast('msg_scrape_ok');
        refreshStatus();
        fetchTracks(currentFolder.value);
    } catch (e) {
        showToast('msg_scrape_fail');
    }
};

onMounted(() => {
    if (isAuthenticated.value) {
        refreshStatus();
        fetchTracks();
    }
    // Auto refresh every 3 seconds to see progress
    pollInterval = setInterval(() => {
        if (!isAuthenticated.value) return;
        refreshStatus();
        // If in library, check if we need to refresh list
        if (currentTab.value === 'library' && status.value?.dbStatus.pending && status.value.dbStatus.pending > 0) {
           fetchTracks(currentFolder.value);
        }
    }, 3000);
});

onUnmounted(() => {
    if (pollInterval) clearInterval(pollInterval);
});
</script>
