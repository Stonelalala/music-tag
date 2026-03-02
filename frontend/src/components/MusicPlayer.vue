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
        lyricsLines.value = [{ time: 0, text: 'Error loading lyrics' }];
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

        <div class="relative z-10 w-full max-w-7xl h-full flex items-center justify-center gap-16">
            <!-- Left Side: Spinning Cover -->
            <div class="hidden lg:flex flex-col items-center flex-1">
                <div class="w-[420px] h-[420px] rounded-full overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.5)] border-8 border-white/5 relative">
                    <img :src="`/api/tracks/${track.id}/cover`" class="w-full h-full object-cover" :class="{ 'animate-spin-slow': isPlaying }" />
                    <div class="absolute inset-0 bg-black/20"></div>
                </div>
                <div class="mt-10 text-center">
                    <h1 class="text-4xl font-black mb-2 tracking-tighter" style="color: var(--text-primary);">{{ track.title }}</h1>
                    <p class="text-xl opacity-60" style="color: var(--text-secondary);">{{ track.artist }}</p>
                </div>
            </div>

            <!-- Middle/Right: Lyrics + Sidebar Toggle -->
            <div class="flex-1 h-full flex flex-col justify-center relative">
                <div ref="fullscreenLyricsContainer" class="h-[60vh] overflow-y-auto px-4 custom-scrollbar scroll-smooth">
                    <div class="flex flex-col items-center py-[25vh]">
                        <p v-for="(line, index) in lyricsLines" :key="index"
                           class="lyric-line text-lg md:text-xl font-bold text-center mb-6 transition-all duration-300"
                           :class="{ 'active-lyric scale-110 opacity-100': index === currentLyricIndex, 'opacity-30': index !== currentLyricIndex }"
                           :style="{ color: index === currentLyricIndex ? 'var(--accent-color)' : 'var(--text-primary)' }">
                            {{ line.text }}
                        </p>
                    </div>
                </div>
            </div>

            <!-- Fullscreen Playlist Sidebar (Optional Peek) -->
            <transition name="slide-left">
                <div v-if="showPlaylist" class="w-80 h-[70vh] bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 p-6 overlow-hidden flex flex-col">
                    <h3 class="text-sm font-bold mb-4 uppercase tracking-widest opacity-50">{{ t('playlist_title') || 'Queue' }}</h3>
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

    <!-- Normal Player Bar -->
    <div class="fixed bottom-0 left-0 right-0 z-[70] transition-all duration-500 shadow-2xl" style="background-color: var(--bg-sidebar); backdrop-filter: blur(12px); border-top: 1px solid var(--border-color);">
        
        <!-- Standard Mini-Lyrics -->
        <transition name="fade">
          <div v-if="showLyrics && !showPlaylist" class="absolute bottom-full left-0 right-0 h-[240px] border-t" style="background-color: var(--bg-primary); opacity: 0.98; border-color: var(--border-color);">
            <div ref="lyricsContainer" class="h-full overflow-y-auto px-6 custom-scrollbar scroll-smooth">
               <div class="flex flex-col items-center py-20">
                    <p v-for="(line, index) in lyricsLines" :key="index"
                       class="lyric-line text-sm text-center mb-4 transition-all duration-300"
                       :class="{ 'active-lyric font-bold opacity-100': index === currentLyricIndex, 'opacity-40': index !== currentLyricIndex }"
                       :style="{ color: index === currentLyricIndex ? 'var(--accent-color)' : 'var(--text-primary)' }">
                        {{ line.text }}
                    </p>
               </div>
            </div>
          </div>
        </transition>

        <!-- Sidebar Playlist (Bottom Bar View) -->
        <transition name="slide-up">
            <div v-if="showPlaylist" class="absolute bottom-full right-4 w-80 h-[400px] mb-4 bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden">
                <div class="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                    <span class="text-xs font-bold uppercase tracking-widest text-slate-400">{{ t('playlist_title') || 'Play Queue' }}</span>
                    <button @click="showPlaylist = false" class="text-slate-500 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                </div>
                <div class="flex-1 overflow-y-auto p-2 custom-scrollbar">
                    <div v-for="(item, idx) in playlist" :key="item.id" 
                         @click="emit('select', idx)"
                         class="flex items-center gap-3 p-2 rounded-lg cursor-pointer transition mb-1"
                         :class="idx === currentIndex ? 'bg-cyan-500/20 text-cyan-400' : 'hover:bg-slate-700/50 text-slate-300'">
                        <img :src="`/api/tracks/${item.id}/cover`" class="w-10 h-10 rounded object-cover border border-slate-700" />
                        <div class="flex-1 min-w-0">
                            <p class="text-xs font-bold truncate">{{ item.title }}</p>
                            <p class="text-[10px] opacity-50 truncate">{{ item.artist }}</p>
                        </div>
                    </div>
                </div>
            </div>
        </transition>



        <div class="max-w-[1400px] mx-auto px-6 py-4 flex items-center gap-6">
          <audio ref="audio" @timeupdate="onTimeUpdate" @loadedmetadata="onLoadedMetadata" @ended="onEnded" @error="onError" preload="auto"></audio>

          <div class="flex items-center gap-4 w-1/4 min-w-0">
            <div class="w-12 h-12 rounded-lg overflow-hidden border shrink-0" style="background-color: var(--bg-muted); border-color: var(--border-color);">
                <img :src="`/api/tracks/${track.id}/cover`" class="w-full h-full object-cover" />
            </div>
            <div class="flex flex-col min-w-0">
              <h3 class="font-bold text-sm truncate" style="color: var(--text-primary);">{{ track.title }}</h3>
              <p class="text-[11px] truncate" style="color: var(--text-secondary);">{{ track.artist }}</p>
            </div>
          </div>

          <div class="flex-1 flex flex-col items-center gap-1.5">
            <div class="flex items-center gap-8">
              <button @click="emit('prev')" class="transition hover:scale-110 active:scale-95" style="color: var(--text-secondary);">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6L19 18V6z"/></svg>
              </button>
              <button @click="togglePlay" class="w-11 h-11 rounded-full flex items-center justify-center transition shadow-lg active:scale-95" style="background-color: var(--accent-button); color: white;">
                <svg v-if="!isPlaying" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
              </button>
              <button @click="emit('next')" class="transition hover:scale-110 active:scale-95" style="color: var(--text-secondary);">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
              </button>
            </div>
            <div class="w-full flex items-center gap-3">
              <span class="text-[10px] font-mono min-w-[40px] text-right" style="color: var(--text-muted);">{{ formatTime(currentTime) }}</span>
              <div class="flex-1 h-1.5 relative group">
                <input type="range" :min="0" :max="duration || 100" :value="currentTime" @input="seek" class="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer" />
                <div class="absolute inset-0 rounded-full overflow-hidden" style="background-color: var(--border-color);">
                  <div class="h-full" :style="{ width: `${(currentTime/(duration || 1))*100}%`, backgroundColor: 'var(--accent-color)' }"></div>
                </div>
              </div>
              <span class="text-[10px] font-mono min-w-[40px]" style="color: var(--text-muted);">{{ formatTime(duration) }}</span>
            </div>
          </div>

          <div class="w-1/4 flex items-center justify-end gap-4">
            <button @click="showLyrics = !showLyrics" 
                    class="text-[10px] px-3 py-1 rounded-full border transition-all font-bold"
                    :style="showLyrics ? { backgroundColor: 'var(--accent-color)', borderColor: 'var(--accent-color)', color: 'white' } : { borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }">
              LYRICS
            </button>

            <div class="flex items-center gap-2 w-24 group/volume">
              <input type="range" min="0" max="1" step="0.01" :value="volume" @input="updateVolume" 
                     class="w-full h-1 appearance-none rounded-full cursor-pointer bg-slate-700" 
                     :style="`background: linear-gradient(to right, var(--accent-color) ${volume*100}%, var(--border-color) ${volume*100}%)`" />
            </div>
            
            <div class="flex items-center gap-1.5 border-l border-slate-700/50 pl-4 ml-1">
                <button @click="showPlaylist = !showPlaylist" 
                        class="p-1.5 transition-colors rounded hover:bg-white/5"
                        :class="showPlaylist ? 'text-cyan-400' : 'text-slate-400 hover:text-white'"
                        title="Playlist">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                </button>
                <button @click="isFullscreen = !isFullscreen" 
                        class="p-1.5 text-slate-400 hover:text-cyan-400 transition-colors rounded hover:bg-white/5"
                        title="Fullscreen">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
                </button>
                <button @click="emit('close')" class="p-1.5 text-slate-500 hover:text-rose-500 transition-colors rounded hover:bg-white/5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
            </div>
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
