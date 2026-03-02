<template>
  <div v-if="isOpen" class="fixed inset-0 z-[100] flex items-center justify-center">
    <div class="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" @click="close"></div>
    <div class="relative w-full max-w-lg bg-slate-800 rounded-lg shadow-2xl shadow-black border border-slate-700 flex flex-col">
      <!-- Header -->
      <div class="p-5 border-b border-slate-700 flex justify-between items-center">
        <h3 class="text-lg font-semibold text-slate-100">{{ t('ui.organize.title') }}</h3>
        <button @click="close" class="text-slate-400 hover:text-white text-xl">✕</button>
      </div>
      
      <!-- Body -->
      <div class="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
        <div class="bg-indigo-50 border border-slate-700/30 rounded p-4 text-sm text-slate-400 shadow-inner">
          {{ t('ui.organize.desc') }}
        </div>
        
        <!-- Base Dir -->
        <div>
          <label class="block text-sm text-slate-300 mb-2">{{ t('ui.organize.base_dir_lbl') }}</label>
          <input type="text" v-model="baseDir" class="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none" />
          <p class="text-xs text-slate-500 mt-1">{{ t('ui.organize.base_dir_hint') }}</p>
        </div>
        
        <!-- Levels -->
        <div>
          <label class="block text-sm text-slate-300 mb-2">{{ t('ui.organize.level_lbl') }}</label>
          
          <transition-group name="list" tag="div">
            <div v-for="(level, index) in levels" :key="level.id" class="border border-slate-700 rounded p-4 mb-3 bg-slate-900/50 shadow-inner">
              <div class="flex justify-between items-center mb-2">
                <span class="text-xs font-semibold text-slate-400">{{ t('ui.organize.level_name', { index: index + 1 }) }}</span>
                <button @click="removeLevel(index)" class="text-red-400 hover:text-red-300 text-lg leading-none p-1">{{ t('ui.organize.remove_btn') }}</button>
              </div>
              
              <select v-model="level.field" class="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 mb-2">
                <option value="">{{ t('ui.organize.select_hint') }}</option>
                <option value="artist">{{ t('ui.organize.artist') }}</option>
                <option value="album">{{ t('ui.organize.album') }}</option>
                <option value="title">{{ t('ui.organize.track_title') }}</option>
                <option value="custom">{{ t('ui.organize.custom') }}</option>
              </select>
              
              <div v-if="level.field === 'custom'">
                 <input v-model="level.customValue" type="text" :placeholder="t('ui.organize.custom_placeholder')" class="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500" />
              </div>
            </div>
          </transition-group>
          
          <button @click="addLevel" class="w-full py-2.5 border border-dashed border-slate-600 rounded text-slate-400 hover:text-slate-200 hover:border-slate-500 transition text-sm flex items-center justify-center gap-2 bg-slate-800/50 hover:bg-slate-800 mt-1">
            <span class="text-lg leading-none">+</span> {{ t('ui.organize.add_level') }}
          </button>
        </div>
      </div>
      
      <!-- Footer -->
      <div class="p-4 border-t border-slate-700 bg-slate-800/80 flex justify-end gap-3 rounded-b-lg">
        <button @click="close" class="px-5 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white transition text-sm font-medium">
          {{ t('ui.organize.cancel_btn') }}
        </button>
        <button @click="confirm" :disabled="processing" class="px-5 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition text-sm font-medium disabled:opacity-50">
          {{ processing ? t('ui.organize.processing') : t('ui.organize.confirm_btn') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import axios from 'axios';
import { useToast } from '../composables/useToast';

const { t } = useI18n();
const { showToast } = useToast();

const props = defineProps({
  isOpen: Boolean
});

const emit = defineEmits(['close', 'organized']);

const baseDir = ref('/app/media/');
const levels = ref([
    { id: 1, field: 'artist', customValue: '' },
    { id: 2, field: 'album', customValue: '' }
]);
const processing = ref(false);

const close = () => {
    emit('close');
};

const addLevel = () => {
    levels.value.push({ id: Date.now(), field: '', customValue: '' });
};

const removeLevel = (index: number) => {
    levels.value.splice(index, 1);
};

const confirm = async () => {
    const validLevels = levels.value.filter(l => l.field && (l.field !== 'custom' || l.customValue.trim() !== ''));
    if (validLevels.length === 0) {
        showToast(t('ui.organize.valid_error'));
        return;
    }
    
    // Request format: ["artist", "album", "custom:MyFavs"]
    const backendLevels = validLevels.map(l => l.field === 'custom' ? `custom:${l.customValue.trim()}` : l.field);
    
    processing.value = true;
    try {
        const res = await axios.post('/api/tracks/organize', {
            levels: backendLevels,
            baseDir: baseDir.value
        });
        if (res.data.success) {
            showToast(t('ui.organize.success_msg', { count: res.data.count }));
            emit('organized');
            close();
        }
    } catch (e: any) {
        showToast(t('ui.organize.fail_msg', { error: (e.response?.data?.error || e.message) }));
    } finally {
        processing.value = false;
    }
};
</script>

<style scoped>
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
