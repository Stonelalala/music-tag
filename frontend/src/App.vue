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

  <div v-else class="h-screen bg-app-primary text-app-primary flex flex-col font-sans overflow-hidden relative selection:bg-app-accent/30 transition-colors duration-700">
    <!-- Premium Background Blobs -->
    <div class="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div class="bg-blob -top-[20%] -left-[10%] opacity-20"></div>
        <div class="bg-blob -bottom-[20%] -right-[10%] opacity-10 [animation-delay:-5s] scale-125"></div>
        <div class="absolute inset-0 bg-theme-gradient opacity-80"></div>
    </div>

    <!-- Header (Fixed Height, No Scroll) -->
    <header class="relative z-50 bg-app-sidebar/40 backdrop-blur-2xl border-b border-app h-16 px-4 md:px-8 flex-shrink-0 flex items-center justify-between">
      <div class="flex items-center gap-4">
        <!-- Mobile Menu Trigger -->
        <button 
          @click="isSidebarOpen = true" 
          class="md:hidden w-11 h-11 rounded-2xl bg-app-muted text-app-secondary flex items-center justify-center shrink-0 active:scale-90 transition-transform border border-app"
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>

        <!-- Desktop Identity -->
        <div class="hidden md:flex items-center gap-4">
          <div class="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          </div>
          <div class="hidden lg:block">
            <h1 class="text-xl font-black bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent tracking-tighter">{{ t('title') }}</h1>
            <p class="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{{ t('subtitle') }}</p>
          </div>
        </div>

        <!-- Mobile Title (Compact) -->
        <h1 class="md:hidden text-lg font-black tracking-tighter text-white uppercase">{{ t('title').substring(0, 4) }}</h1>
      </div>

      <div class="flex items-center gap-3">
        <button @click="toggleLang" class="hidden sm:flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-300 transition-all active:scale-95">
           <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
           {{ locale.toUpperCase() }}
        </button>
        
        <div v-if="status" class="hidden xl:flex items-center gap-6 bg-white/5 px-6 py-2 rounded-full border border-white/10 shadow-inner">
            <div class="flex items-center gap-2.5">
                <span class="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)] animate-pulse"></span>
                <span class="text-[10px] font-black text-slate-300 uppercase tracking-widest">{{ t('ui.tracks.synced_ok') }} <span class="text-emerald-400 ml-1">{{ status.dbStatus.success }}</span></span>
            </div>
            <div class="w-px h-3 bg-white/10"></div>
            <div class="flex items-center gap-2.5">
                <span class="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.5)]"></span>
                <span class="text-[10px] font-black text-slate-300 uppercase tracking-widest">{{ t('ui.tracks.need_fix') }} <span class="text-rose-400 ml-1">{{ status.dbStatus.failed }}</span></span>
            </div>
        </div>

        <button @click="refreshStatus" class="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-all active:rotate-180 duration-700">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        </button>
      </div>
    </header>

    
    <div class="flex flex-1 overflow-hidden relative">
      <!-- Global Sidebar -->
      <aside 
        class="fixed inset-y-0 left-0 w-72 bg-app-sidebar/60 backdrop-blur-3xl border-r border-app transform transition-transform duration-500 cubic-bezier(0.16, 1, 0.3, 1) z-[100] md:relative md:translate-x-0 flex flex-col shrink-0"
        :class="isSidebarOpen ? 'translate-x-0' : '-translate-x-full'"
      >
        <!-- Logo Area -->
        <div class="px-8 py-6 flex items-center justify-end md:hidden">
          <!-- Mobile Close -->
          <button @click="isSidebarOpen = false" class="md:hidden w-10 h-10 flex items-center justify-center text-slate-500 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-10 custom-scrollbar">
          <!-- Navigation -->
          <div class="space-y-4">
            <h3 class="px-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Core</h3>
            <ul class="space-y-2">
              <li v-for="nav in [
                { id: 'library', icon: 'M3 3h7v7H3zm11 0h7v7h-7zm0 11h7v7h-7zm-11 0h7v7H3z', label: t('tab_tracks'), color: 'emerald' },
                { id: 'discovery', icon: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm4 6-8 8m4 0h-4v-4', label: t('tab_discovery'), color: 'rose' },
                { id: 'tasks', icon: 'M12 2v20m5-5-5 5-5-5m0-10 5-5 5 5', label: t('tasks.title'), color: 'emerald' }
              ]" :key="nav.id">
                <button 
                  @click="switchToTab(nav.id)" 
                  class="w-full flex items-center gap-4 px-5 py-4 rounded-[20px] transition-all duration-500 group relative overflow-hidden"
                  :class="currentTab === nav.id ? `bg-${nav.color}-500 text-[#020617]` : 'text-app-muted hover:bg-app-accent/10 hover:text-app-primary'"
                >
                  <div v-if="currentTab === nav.id" class="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="relative z-10 shrink-0"><path :d="nav.icon"/></svg>
                  <span class="text-sm font-black relative z-10 text-left leading-tight transition-transform duration-500 overflow-hidden line-clamp-2">{{ nav.label }}</span>
                  <div v-if="nav.id === 'tasks' && activeTaskCount > 0" class="ml-auto px-2 py-0.5 rounded-md bg-[#020617]/20 text-[#020617] text-[9px] font-black uppercase tracking-wider relative z-10 shrink-0">{{ activeTaskCount }}</div>
                </button>
              </li>
            </ul>
          </div>

          <!-- Dynamic Folders -->
          <div v-if="currentTab === 'library'" class="space-y-4">
            <div class="flex items-center justify-between px-4">
              <h3 class="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">{{ t('ui.sidebar.folders') }}</h3>
              <button v-if="currentFolder" @click="goUp" class="text-[10px] font-black text-emerald-500 hover:text-emerald-400 transition-colors uppercase tracking-[0.2em] underline underline-offset-4 decoration-2">
                {{ t('ui.sidebar.back') }}
              </button>
            </div>
            
            <ul class="space-y-1">
              <li v-for="folder in folders" :key="'global_f_'+folder">
                <button 
                  @click="enterFolder(folder)"
                  class="w-full text-left px-4 py-3 rounded-2xl flex items-center gap-4 transition-all duration-300 text-app-muted hover:bg-app-accent/10 hover:text-app-primary group active:scale-95"
                >
                  <div class="w-8 h-8 rounded-xl bg-app-muted/50 flex items-center justify-center border border-app group-hover:border-app-accent/30 group-hover:text-app-accent transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
                  </div>
                  <span class="text-[13px] font-bold truncate">{{ folder }}</span>
                </button>
              </li>
              <li v-if="folders.length === 0 && !currentFolder" class="px-6 py-12 text-center text-[10px] text-slate-600 font-black uppercase tracking-[0.2em] border-2 border-dashed border-white/5 rounded-3xl mx-2">
                 {{ t('ui.sidebar.empty') }}
              </li>
            </ul>
          </div>
        </div>

        <!-- Sidebar Footer -->
        <div class="p-6 border-t border-app bg-app-sidebar/40 backdrop-blur-3xl relative">
            <!-- Subtle gradient inside footer -->
            <div class="absolute -right-10 -bottom-10 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl"></div>
            
            <div class="flex items-center gap-3 relative z-10">
                <!-- Settings Popover -->
                <div class="relative group flex-1">
                    <button class="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-app-primary bg-app-muted hover:bg-app-accent hover:text-[#020617] transition-all duration-500 font-black border border-app hover:border-app-accent">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                        <span class="text-sm truncate uppercase tracking-widest">{{ t('settings_btn') }}</span>
                    </button>
                    
                    <!-- Advanced Toolbox Popover -->
                    <div class="absolute bottom-full left-0 mb-4 w-72 bg-app-sidebar border border-app rounded-[32px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-500 transform translate-y-4 group-hover:translate-y-0 z-[110] p-4 backdrop-blur-3xl overflow-hidden shadow-xl">
                        <div class="flex items-center gap-3 px-2 mb-4">
                             <div class="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 border border-emerald-500/20">
                                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                             </div>
                             <p class="text-[10px] font-black text-app-primary uppercase tracking-[0.2em] leading-tight text-left">{{ t('scraper_title') }}</p>
                        </div>
                        
                        <div class="space-y-1">
                            <button @click="triggerScan" class="w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-[11px] font-bold text-emerald-400 transition-all hover:bg-white/5 active:scale-95 group/item">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="group-hover/item:scale-120 transition-transform shrink-0"><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M3 21v-5h5M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5"/></svg>
                                <span class="text-left leading-tight uppercase tracking-widest">{{ t('scan_btn') }}</span>
                            </button>
                            <button @click="triggerScrape" :disabled="!!status && status.dbStatus.pending === 0" class="w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-[11px] font-bold text-emerald-400 transition-all hover:bg-white/5 active:scale-95 disabled:opacity-30 group/item">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="group-hover/item:scale-120 transition-transform shrink-0"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                                <span class="text-left leading-tight uppercase tracking-widest">{{ t('scrape_btn') }}</span>
                            </button>
                            <button @click="triggerResetScrape" :disabled="!!status && status.dbStatus.success === 0" class="w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-[11px] font-bold text-amber-400 transition-all hover:bg-white/5 active:scale-95 disabled:opacity-30 group/item">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="group-hover/item:scale-120 transition-transform shrink-0"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                                <span class="text-left leading-tight uppercase tracking-widest">{{ t('reset_scrape_btn') }}</span>
                            </button>
                            <button @click="isNeteaseOpen = true" class="w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-[11px] font-bold text-rose-400 transition-all hover:bg-white/5 active:scale-95 group/item">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="group-hover/item:scale-120 transition-transform shrink-0"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                                <span class="text-left leading-tight uppercase tracking-widest">{{ t('downloader.title') }}</span>
                            </button>
                            <button @click="isSettingsOpen = true" class="w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-[11px] font-bold text-blue-400 transition-all hover:bg-white/5 active:scale-95 group/item">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="group-hover/item:scale-120 transition-transform shrink-0"><circle cx="12" cy="12" r="3"/><path d="M12 2v2"/><path d="M12 20v2M2 12h2M20 12h2"/></svg>
                                <span class="text-left leading-tight uppercase tracking-widest">{{ t('settings_btn') }}</span>
                            </button>
                        </div>

                        <div class="mt-5 pt-5 border-t border-app">
                             <p class="text-[9px] font-black text-app-muted uppercase tracking-[0.2em] mb-4 px-2 text-left">{{ t('theme_toggle') }}</p>
                            <div class="grid grid-cols-4 gap-3 p-1">
                                <button v-for="tname in themes" :key="tname" @click="currentTheme = tname"
                                    class="aspect-square rounded-xl border-2 transition-all hover:scale-110 active:scale-90 relative"
                                    :class="[currentTheme === tname ? 'border-app-accent ring-4 ring-app-accent/20' : 'border-app', getThemeColor(tname)]"
                                >
                                    <div v-if="currentTheme === tname" class="absolute inset-0 flex items-center justify-center text-white">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><polyline points="20 6 9 17 4 12"/></svg>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Logout Button -->
                <button @click="logout" class="w-14 h-14 flex items-center justify-center rounded-2xl text-rose-500 bg-rose-500/10 hover:bg-rose-500 hover:text-white transition-all duration-500 border border-rose-500/20 active:scale-90" :title="t('logout_btn')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                </button>
            </div>
        </div>
      </aside>


      <!-- Mobile Backdrop -->
      <transition enter-active-class="transition-opacity duration-500" enter-from-class="opacity-0" enter-to-class="opacity-100" leave-active-class="transition-opacity duration-300" leave-from-class="opacity-100" leave-to-class="opacity-0">
        <div v-if="isSidebarOpen" @click="isSidebarOpen = false" class="fixed inset-0 bg-app-primary/80 backdrop-blur-xl z-[90] md:hidden"></div>
      </transition>

      <main class="flex-1 overflow-hidden relative p-6">
          <div class="h-full w-full max-w-full mx-auto flex flex-col overflow-hidden relative z-10 bento-card shadow-2xl">
              <transition name="page" mode="out-in">
                  <template v-if="status" :key="currentTab">
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
                      <template v-else-if="currentTab === 'tasks'">
                          <TasksView />
                      </template>
                  </template>
                  <div v-else class="text-center h-full flex flex-col items-center justify-center flex-1">
                      <div class="animate-pulse flex flex-col items-center gap-6">
                         <div class="w-16 h-16 rounded-full border-[6px] border-white/5 border-t-emerald-500 animate-spin shadow-2xl shadow-emerald-500/20"></div>
                         <p class="text-xs font-black uppercase tracking-[0.3em] text-slate-400">{{ t('connecting') }}</p>
                      </div>
                  </div>
              </transition>
          </div>
          
          <!-- Toast Notification -->
          <transition enter-active-class="transition duration-500 ease-out" enter-from-class="translate-y-20 opacity-0" enter-to-class="translate-y-0 opacity-100" leave-active-class="transition duration-300 ease-in" leave-from-class="translate-y-0 opacity-100" leave-to-class="translate-y-10 opacity-0">
            <div v-if="toastMsg" class="fixed bottom-12 left-1/2 -translate-x-1/2 bg-app-sidebar text-emerald-500 text-xs font-black px-8 py-4 rounded-[20px] border border-emerald-500/20 z-[9999] flex items-center gap-3 backdrop-blur-3xl uppercase tracking-widest whitespace-nowrap shadow-xl">
                <div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                {{ toastMsg }}
            </div>
          </transition>
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
import TasksView from './components/TasksView.vue';
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
const currentTab = ref('library'); // 'library' | 'discovery' | 'tasks'
const isSidebarOpen = ref(false);
const activeTaskCount = ref(0);

const fetchActiveTaskCount = async () => {
    try {
        const res = await axios.get('/api/tasks');
        if (res.data.success) {
            activeTaskCount.value = res.data.data.filter((t: any) => t.status === 'running' || t.status === 'pending').length;
        }
    } catch (e) {}
};

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
const currentTheme = ref(localStorage.getItem('APP_THEME') || 'frost');

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
        currentTab.value = 'tasks';
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
        currentTab.value = 'tasks';
        refreshStatus();
        fetchTracks(currentFolder.value);
    } catch (e) {
        showToast('msg_scrape_fail');
    }
};

const triggerResetScrape = async () => {
    if (!confirm(t('tasks.cleanup_confirm'))) return; // Reusing cleanup confirm for simplicity or we could add a new one
    try {
        const res = await axios.post('/api/reset-scrape-status');
        if (res.data.success) {
            showToast('msg_reset_scrape_ok');
            refreshStatus();
            fetchTracks(currentFolder.value);
        }
    } catch (e) {
        showToast('msg_scrape_fail');
    }
};

onMounted(() => {
    if (isAuthenticated.value) {
        refreshStatus();
        fetchTracks();
        fetchActiveTaskCount();
    }
    // Auto refresh every 3 seconds to see progress
    pollInterval = setInterval(() => {
        if (!isAuthenticated.value) return;
        refreshStatus();
        fetchActiveTaskCount();
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
