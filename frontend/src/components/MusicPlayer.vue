<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue';
import { useI18n } from 'vue-i18n';

interface Track {
    id: string | number;
    title: string;
    artist: string;
    album: string;
    filepath: string;
}

interface LyricLine {
    time: number;
    text: string;
}

const props = defineProps<{
    track: Track | null;
    playlist?: Track[];
    currentIndex?: number;
}>();

const emit = defineEmits(['close', 'next', 'prev', 'select']);
const { t } = useI18n();

const isMobile = ref(window.innerWidth < 768);
window.addEventListener('resize', () => {
    isMobile.value = window.innerWidth < 768;
});

const audio = ref<HTMLAudioElement | null>(null);
const isPlaying = ref(false);
const currentTime = ref(0);
const duration = ref(0);
const volume = ref(Number(localStorage.getItem('APP_VOLUME')) || 0.7);
const showLyrics = ref(false);
const showPlaylist = ref(false);
const isMuted = ref(false);
const isFullscreen = ref(false);

const lyricsLines = ref<LyricLine[]>([]);
const lyricsContainer = ref<HTMLElement | null>(null);
const fullscreenLyricsContainer = ref<HTMLElement | null>(null);

const parseLyrics = (raw: string) => {
    const lines = raw.split(/\r?\n/);
    const result: LyricLine[] = [];
    const timeRegex = /\[(\d{2}):(\d{2})(\.|:)(\d{2,3})\]/g;

    lines.forEach(line => {
        let match;
        const text = line.replace(timeRegex, '').trim();
        if (!text) return;

        timeRegex.lastIndex = 0;
        while ((match = timeRegex.exec(line)) !== null) {
            const m = parseInt(match[1]);
            const s = parseInt(match[2]);
            const ms = parseInt(match[4]);
            const time = m * 60 + s + (ms > 99 ? ms / 1000 : ms / 100);
            result.push({ time, text });
        }
    });

    return result.sort((a, b) => a.time - b.time);
};

const currentLyricIndex = computed(() => {
    if (lyricsLines.value.length === 0) return -1;
    for (let i = lyricsLines.value.length - 1; i >= 0; i--) {
        if (currentTime.value >= lyricsLines.value[i].time) {
            return i;
        }
    }
    return -1;
});

watch(currentLyricIndex, (newIdx) => {
    if (newIdx === -1) return;
    nextTick(() => {
        const target = isFullscreen.value ? fullscreenLyricsContainer.value : lyricsContainer.value;
        if (!target) return;

        const activeLine = target.querySelector('.active-lyric') as HTMLElement;
        if (activeLine) {
            const containerHeight = target.offsetHeight;
            const lineOffset = activeLine.offsetTop;
            const lineHeight = activeLine.offsetHeight;
            
            target.scrollTo({
                top: lineOffset - containerHeight / 2 + lineHeight / 2,
                behavior: 'smooth'
            });
        }
    });
});

const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds === Infinity) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const togglePlay = () => {
    if (!audio.value) return;
    if (isPlaying.value) {
        audio.value.pause();
        isPlaying.value = false;
    } else {
        audio.value.play().then(() => {
            isPlaying.value = true;
        }).catch(e => console.error("Play failed:", e));
    }
};

const onTimeUpdate = () => {
    if (audio.value) {
        currentTime.value = audio.value.currentTime;
    }
};

const onLoadedMetadata = () => {
    if (audio.value) {
        duration.value = audio.value.duration;
    }
};

const onEnded = () => {
    emit('next');
};

const onError = () => {
    isPlaying.value = false;
};

const seek = (e: Event) => {
    const val = (e.target as HTMLInputElement).value;
    if (audio.value) {
        audio.value.currentTime = Number(val);
        currentTime.value = Number(val);
    }
};

const updateVolume = (e: Event) => {
    const val = (e.target as HTMLInputElement).value;
    volume.value = Number(val);
    if (audio.value) {
        audio.value.volume = volume.value;
    }
    localStorage.setItem('APP_VOLUME', val);
};

const fetchLyrics = async () => {
    if (!props.track) return;
    try {
        const res = await fetch(`/api/tracks/${props.track.id}/lyrics`);
        const json = await res.json();
        if (json.success && json.lyrics) {
            lyricsLines.value = parseLyrics(json.lyrics);
        } else {
            lyricsLines.value = [{ time: 0, text: t('player_lyrics_notfound') }];
        }
    } catch {
        lyricsLines.value = [{ time: 0, text: t('player_lyrics_error') }];
    }
};

const loadAndPlay = async (track: Track) => {
    await nextTick();
    if (!audio.value) return;
    
    try {
        const streamUrl = `/api/tracks/${track.id}/stream`;
        audio.value.pause();
        audio.value.src = streamUrl;
        audio.value.load();
        
        duration.value = 0;
        currentTime.value = 0;
        isPlaying.value = true;

        audio.value.play().then(() => {
            console.log("MusicPlayer: Play success");
        }).catch(() => {
            isPlaying.value = false;
        });

        fetchLyrics();
    } catch (err) {
        console.error("MusicPlayer: Setup failed:", err);
    }
};

watch(() => props.track, (newTrack) => {
    if (newTrack) {
        loadAndPlay(newTrack);
    } else {
        isPlaying.value = false;
        if (audio.value) {
            audio.value.pause();
            audio.value.src = '';
        }
    }
}, { immediate: true });

onMounted(() => {
    if (audio.value) {
        audio.value.volume = volume.value;
    }
});

onUnmounted(() => {
    if (audio.value) {
        audio.value.pause();
        audio.value.src = '';
    }
});
</script>

<template>
  <div v-if="track">
    <!-- Fullscreen Immersive Mode -->
    <transition name="slide-up">
      <div v-if="isFullscreen" class="fixed inset-0 z-[100] flex flex-col items-center justify-center p-8 md:p-12 overflow-hidden"
           style="background: linear-gradient(to bottom, var(--bg-primary), var(--bg-secondary));">
        
        <div class="absolute inset-0 opacity-20 pointer-events-none overflow-hidden">
            <div class="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full blur-[120px] animate-pulse" :style="{ backgroundColor: 'var(--accent-color)' }"></div>
            <div class="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full blur-[120px] animate-pulse" :style="{ backgroundColor: 'var(--accent-button)', animationDelay: '2s' }"></div>
        </div>

        <button @click="isFullscreen = false" class="absolute top-8 right-8 p-3 rounded-full hover:bg-white/10 transition-all z-[110] group" style="color: var(--text-primary);">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="group-hover:rotate-90 transition-transform duration-300"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>

        <div class="relative z-10 w-full max-w-7xl h-full flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16">
            <!-- Left Side: Dynamic Vinyl Cover -->
            <div class="hidden md:flex flex-col items-center flex-1 animate-fade-in">
                <div class="w-[340px] h-[340px] lg:w-[460px] lg:h-[460px] rounded-full overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.6)] border-[12px] border-white/5 relative group">
                    <img :src="`/api/tracks/${track.id}/cover`" class="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" :class="{ 'animate-spin-slow': isPlaying }" />
                    <div class="absolute inset-0 bg-gradient-to-tr from-black/40 via-transparent to-white/10"></div>
                    <!-- Center Hole -->
                    <div class="absolute inset-[42%] rounded-full bg-app-sidebar border-[6px] border-white/10 shadow-inner flex items-center justify-center">
                        <div class="w-4 h-4 rounded-full bg-white/20"></div>
                    </div>
                </div>
                <div class="mt-12 text-center max-w-lg">
                    <h1 class="text-4xl lg:text-5xl font-black mb-4 tracking-tighter text-app-primary leading-tight">{{ track.title }}</h1>
                    <div class="flex items-center justify-center gap-3">
                        <span class="px-2 py-1 rounded bg-app-accent/20 text-app-accent text-[10px] font-black uppercase tracking-widest">Hi-Res</span>
                        <p class="text-xl lg:text-2xl font-bold opacity-60 text-app-secondary">{{ track.artist }}</p>
                    </div>
                </div>
            </div>

            <!-- Mobile: Static Cover and Title -->
            <div class="md:hidden flex flex-col items-center gap-6 text-center mt-8">
                <div class="w-64 h-64 rounded-3xl shadow-2xl overflow-hidden border border-white/10">
                    <img :src="`/api/tracks/${track.id}/cover`" class="w-full h-full object-cover" />
                </div>
                <div>
                   <h1 class="text-3xl font-black tracking-tight text-app-primary">{{ track.title }}</h1>
                   <p class="text-lg font-bold opacity-60 text-app-secondary mt-1">{{ track.artist }}</p>
                </div>
            </div>

            <!-- Middle/Right: Lyrics -->
            <div class="flex-1 h-full w-full flex flex-col justify-center relative">
                <div ref="fullscreenLyricsContainer" class="h-[40vh] md:h-[60vh] overflow-y-auto px-4 custom-scrollbar scroll-smooth">
                    <div class="flex flex-col items-center py-[20vh] md:py-[25vh]">
                        <p v-for="(line, index) in lyricsLines" :key="index"
                           class="lyric-line text-base md:text-xl font-bold text-center mb-6 transition-all duration-300"
                           :class="{ 'active-lyric scale-110 opacity-100': index === currentLyricIndex, 'opacity-30': index !== currentLyricIndex }"
                           :style="{ color: index === currentLyricIndex ? 'var(--accent-color)' : 'var(--text-primary)' }">
                            {{ line.text }}
                        </p>
                    </div>
                </div>
            </div>

            <!-- Fullscreen Playlist Sidebar (Peek on larger screens) -->
            <transition name="slide-left">
                <div v-if="showPlaylist && !isMobile" class="w-80 h-[70vh] bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 p-6 overlow-hidden flex flex-col">
                    <h3 class="text-sm font-bold mb-4 uppercase tracking-widest opacity-50">{{ t('ui.tracks.playlist_title') }}</h3>
                    <div class="flex-1 overflow-y-auto custom-scrollbar pr-2">
                        <div v-for="(item, idx) in playlist" :key="item.id" 
                             @click="emit('select', idx)"
                             class="flex items-center gap-3 p-2 rounded-lg cursor-pointer transition mb-1"
                             :class="idx === currentIndex ? 'bg-cyan-500/20 text-cyan-400' : 'hover:bg-white/5 text-white/60'">
                            <img :src="`/api/tracks/${item.id}/cover`" class="w-8 h-8 rounded object-cover" />
                            <div class="flex-1 min-w-0">
                                <p class="text-xs font-bold truncate">{{ item.title }}</p>
                                <p class="text-[10px] opacity-50 truncate">{{ item.artist }}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </transition>
        </div>

        <!-- Bottom Controls -->
        <div class="absolute bottom-12 w-full max-w-4xl px-8 z-20">
            <div class="flex flex-col gap-4">
                <div class="flex items-center gap-4">
                    <span class="text-xs font-mono opacity-50">{{ formatTime(currentTime) }}</span>
                    <div class="flex-1 h-1.5 relative group cursor-pointer">
                        <input type="range" :min="0" :max="duration || 100" :value="currentTime" @input="seek" class="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer" />
                        <div class="absolute inset-0 bg-white/10 rounded-full overflow-hidden">
                            <div class="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 shadow-[0_0_15px_rgba(52,211,153,0.5)]" :style="{ width: `${(currentTime/(duration || 1))*100}%` }"></div>
                        </div>
                    </div>
                    <span class="text-xs font-mono opacity-50">{{ formatTime(duration) }}</span>
                </div>
                <div class="flex justify-center items-center gap-10">
                   <button @click="emit('prev')" class="text-white/60 hover:text-white transition transform active:scale-90">
                       <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6L19 18V6z"/></svg>
                   </button>
                   <button @click="togglePlay" class="w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-xl hover:scale-110 active:scale-90 bg-cyan-400 text-slate-900">
                     <svg v-if="!isPlaying" xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                     <svg v-else xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="6" height="16" /><rect x="14" y="4" width="6" height="16" /></svg>
                   </button>
                   <button @click="emit('next')" class="text-white/60 hover:text-white transition transform active:scale-90">
                       <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
                   </button>
                </div>
            </div>
        </div>
      </div>
    </transition>

    <!-- Floating Music Panels (Lyrics & Playlist) -->
    <transition name="slide-up">
        <div v-if="showPlaylist && !isFullscreen" 
             class="fixed bottom-[110px] left-0 right-0 mx-auto w-[92%] max-w-md h-[400px] bento-card border-white/10 z-[75] flex flex-col overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)]">
            <div class="p-5 border-b border-app/30 flex justify-between items-center bg-app-secondary/50 backdrop-blur-md">
                <span class="text-xs font-black uppercase tracking-widest text-app-accent">{{ t('ui.tracks.playlist_title') }}</span>
                <button @click="showPlaylist = false" class="text-app-muted hover:text-rose-400 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
            </div>
            <div class="flex-1 overflow-y-auto p-3 custom-scrollbar bg-app-primary/20">
                <div v-for="(item, idx) in playlist" :key="item.id" 
                     @click="emit('select', idx)"
                     class="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all mb-2 group"
                     :class="idx === currentIndex ? 'bg-app-accent/20 border border-app-accent/30' : 'hover:bg-white/5 border border-transparent'">
                    <img :src="`/api/tracks/${item.id}/cover`" class="w-10 h-10 rounded-lg object-cover shadow-md group-hover:scale-105 transition-transform" />
                    <div class="flex-1 min-w-0">
                        <p class="text-xs font-bold truncate transition-colors" :class="idx === currentIndex ? 'text-emerald-400' : 'text-white'">{{ item.title }}</p>
                        <p class="text-[10px] font-semibold opacity-60 truncate text-white/70">{{ item.artist }}</p>
                    </div>
                </div>
            </div>
        </div>
    </transition>

    <transition name="fade">
        <div v-if="showLyrics && !isFullscreen" 
             class="fixed bottom-[110px] left-0 right-0 mx-auto w-[92%] max-w-2xl h-[320px] bento-card border-white/10 z-[75] flex flex-col overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)]">
            <div ref="lyricsContainer" class="h-full overflow-y-auto px-8 py-10 custom-scrollbar scroll-smooth">
               <div class="flex flex-col items-center">
                    <p v-for="(line, index) in lyricsLines" :key="index"
                       class="lyric-line text-base text-center mb-6 transition-all duration-500 cursor-default"
                       :class="{ 'active-lyric font-black scale-110 opacity-100': index === currentLyricIndex, 'opacity-20 font-bold hover:opacity-50': index !== currentLyricIndex }"
                       :style="{ color: index === currentLyricIndex ? 'var(--accent-color)' : 'var(--text-primary)' }">
                        {{ line.text }}
                    </p>
               </div>
            </div>
            <button @click="showLyrics = false" class="absolute top-4 right-4 text-white/40 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
        </div>
    </transition>

    <!-- Floating Music Controller (Glass Pill) -->
    <div class="fixed bottom-8 left-0 right-0 mx-auto w-[92%] max-w-4xl z-[80] group px-4">
        <div class="glass-pill px-6 py-4 flex items-center justify-between gap-6 relative overflow-hidden border border-white/10 shadow-[0_32px_80px_-20px_rgba(0,0,0,0.8)] bg-black/60 backdrop-blur-3xl">
            <!-- Aurora Accent Glow -->
            <div class="absolute -left-10 -top-10 w-32 h-32 bg-app-accent/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            
            <audio ref="audio" @timeupdate="onTimeUpdate" @loadedmetadata="onLoadedMetadata" @ended="onEnded" @error="onError" preload="auto"></audio>

            <!-- Song Info Peek -->
            <div class="flex items-center gap-4 flex-1 min-w-0 cursor-pointer" @click="isFullscreen = true">
                <div class="w-12 h-12 rounded-xl overflow-hidden shadow-lg border border-white/10 shrink-0 relative group/cover">
                    <img :src="`/api/tracks/${track.id}/cover`" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    <div class="absolute inset-0 bg-black/40 opacity-0 group-hover/cover:opacity-100 transition-opacity flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-white"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
                    </div>
                </div>
                <div class="flex flex-col min-w-0">
                    <h3 class="font-black text-sm tracking-tight text-white leading-tight truncate">{{ track.title }}</h3>
                    <p class="text-[11px] font-bold text-emerald-400 select-none truncate">{{ track.artist }}</p>
                </div>
            </div>

            <!-- Central Transport Controls -->
            <div class="flex flex-col items-center gap-1 flex-[1.5]">
                <div class="flex items-center gap-7">
                    <button @click="emit('prev')" class="text-white/30 hover:text-white transition transform active:scale-90 hidden sm:block">
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6L19 18V6z"/></svg>
                    </button>
                    <button @click="togglePlay" class="w-13 h-13 rounded-full flex items-center justify-center transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:shadow-white/30 hover:scale-105 active:scale-95 bg-white text-black border-4 border-white/5">
                        <svg v-if="!isPlaying" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" class="ml-1"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                        <svg v-else xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                    </button>
                    <button @click="emit('next')" class="text-white/30 hover:text-white transition transform active:scale-90">
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
                    </button>
                </div>
                <!-- Mini Progress Bar -->
                <div class="hidden md:flex w-full items-center gap-3 px-4">
                    <span class="text-[9px] font-black font-mono text-white/50 min-w-[35px] text-right">{{ formatTime(currentTime) }}</span>
                    <div class="flex-1 h-1 relative group bg-white/10 rounded-full overflow-hidden">
                        <input type="range" :min="0" :max="duration || 100" :value="currentTime" @input="seek" class="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer" />
                        <div class="h-full bg-emerald-400 rounded-full shadow-[0_0_12px_rgba(52,211,153,0.4)]" :style="{ width: `${(currentTime/(duration || 1))*100}%` }"></div>
                    </div>
                    <span class="text-[9px] font-black font-mono text-white/50 min-w-[35px]">{{ formatTime(duration) }}</span>
                </div>
            </div>

            <!-- Action & Volume Area -->
            <div class="flex-1 hidden sm:flex items-center justify-end gap-3">
                <div class="flex items-center gap-1 mr-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/5 group/vol">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-white/30 group-hover/vol:text-emerald-400 transition-colors"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                    <input type="range" min="0" max="1" step="0.01" :value="volume" @input="updateVolume" 
                           class="w-16 h-1 appearance-none bg-transparent cursor-pointer rounded-full overflow-hidden" 
                           :style="`background: linear-gradient(to right, #10b981 ${volume*100}%, rgba(255,255,255,0.1) ${volume*100}%)`" />
                </div>
                
                <div class="flex items-center gap-2 border-l border-white/10 pl-3">
                    <button @click="showLyrics = !showLyrics" class="p-2 transition-all rounded-xl hover:bg-white/10" :class="showLyrics ? 'text-emerald-400' : 'text-white/30 hover:text-white'">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    </button>
                    <button @click="showPlaylist = !showPlaylist" class="p-2 transition-all rounded-xl hover:bg-white/10" :class="showPlaylist ? 'text-emerald-400' : 'text-white/30 hover:text-white'">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                    </button>
                    <button @click="emit('close')" class="p-2 text-rose-500/40 hover:text-rose-500 hover:bg-rose-500/10 transition-all rounded-xl ml-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                </div>
            </div>

            <!-- Compact List/Close for Mobile -->
            <div class="sm:hidden flex items-center gap-2">
                <button @click="showPlaylist = !showPlaylist" class="p-2 text-white/60"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg></button>
                <button @click="emit('close')" class="p-2 text-rose-500/60"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></button>
            </div>
        </div>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: all 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.slide-up-enter-active, .slide-up-leave-active { transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
.slide-up-enter-from, .slide-up-leave-to { transform: translateY(100%); }
.slide-left-enter-active, .slide-left-leave-active { transition: all 0.4s ease; }
.slide-left-enter-from, .slide-left-leave-to { transform: translateX(50px); opacity: 0; }
@keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.animate-spin-slow { animation: spin-slow 25s linear infinite; }
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
.line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-clamp: 2; }
</style>
