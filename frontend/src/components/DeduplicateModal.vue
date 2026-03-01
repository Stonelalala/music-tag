<template>
  <div v-if="isOpen" class="fixed inset-0 z-[60] flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" @click="$emit('close')"></div>
    <div class="relative w-full max-w-4xl bg-slate-800 rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-700">
      
      <!-- Header -->
      <div class="p-5 border-b border-slate-700 flex justify-between items-center bg-slate-900/40">
        <h3 class="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-rose-400"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path><path d="m14 9-4 4"></path><path d="m10 9 4 4"></path></svg>
          智能清理重复文件
        </h3>
        <button @click="$emit('close')" class="text-slate-400 hover:text-white transition cursor-pointer">✕</button>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto p-6 bg-slate-800/50">
        <div v-if="loading" class="flex flex-col items-center justify-center py-20 text-indigo-400 gap-4">
           <svg class="animate-spin h-8 w-8 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
           <span>正在全库扫描重复文件...</span>
        </div>
        
        <div v-else-if="duplicates.length === 0" class="flex flex-col items-center justify-center py-20 text-emerald-400 gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="opacity-80"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
          <p class="text-lg">恭喜，暂未发现任何重复痕迹！</p>
          <span class="text-xs text-slate-500">（基于标题和艺术家进行全局比对）</span>
        </div>

        <div v-else class="space-y-6">
          <div class="bg-indigo-900/20 text-indigo-200 border border-indigo-500/30 p-4 rounded text-sm leading-relaxed">
            探测到 <strong>{{ duplicates.length }}</strong> 首歌曲在仓库中有重复文件。系统已经按照文件大小(由高到低)进行了排序。由于同名且体积最大的通常意味着更好的音质 (如 FLAC>MP3)，系统已经帮您自动默认勾选了其余的次要版本供直接销毁。
          </div>

          <div v-for="(group, idx) in duplicates" :key="idx" class="bg-slate-900 p-4 rounded-xl border border-slate-700 shadow-inner">
            <h4 class="font-medium text-slate-100 flex justify-between items-center mb-4 border-b border-slate-700/50 pb-2">
              <span class="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-indigo-400"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                {{ group.title }} <span class="text-slate-500 text-sm font-normal ml-2"> - {{ group.artist }}</span>
              </span>
              <span class="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-600">共 {{ group.files.length }} 份</span>
            </h4>
            
            <div class="space-y-2">
               <label v-for="(file, findex) in group.files" :key="file.id" 
                 class="flex items-center p-3 rounded hover:bg-slate-800/80 transition border border-transparent hover:border-slate-700/60 cursor-pointer gap-3"
                 :class="{ 'opacity-50 grayscale': file.deleted }">
                 <input type="checkbox" v-model="selectedIds" :value="file.id" :disabled="file.deleted" class="w-4 h-4 text-rose-500 bg-slate-900 border-slate-600 rounded focus:ring-rose-600 focus:ring-1 cursor-pointer">
                 <div class="flex-1 min-w-0">
                    <p class="text-sm font-mono text-slate-300 truncate" :title="file.filepath">
                      <span v-if="findex === 0 && !file.deleted" class="px-1.5 py-0.5 rounded bg-emerald-900/30 text-emerald-400 text-[10px] border border-emerald-700/40 mr-2 uppercase tracking-wider">最佳版本</span>
                      {{ file.filename }}
                    </p>
                    <p class="text-xs text-slate-500 mt-1 flex gap-4">
                      <span>格式: <strong class="text-slate-400 uppercase">{{ file.extension.replace('.','') }}</strong></span>
                      <span>大小: <strong class="text-slate-400">{{ formatBytes(file.size) }}</strong></span>
                      <span v-if="file.status === 1" class="text-emerald-500">已刮削 ✓</span>
                      <span v-else class="text-amber-500/70">未刮削</span>
                    </p>
                 </div>
                 <span v-if="file.deleted" class="text-xs bg-rose-900/50 text-rose-400 px-2 py-1 rounded">已物理粉碎</span>
               </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="p-5 border-t border-slate-700 bg-slate-900/80 flex justify-between items-center rounded-b-xl">
        <span class="text-sm text-slate-400">已勾选待删: <strong class="text-rose-400 text-base ml-1">{{ selectedIds.length }}</strong> 项</span>
        <div class="flex gap-3">
          <button @click="$emit('close')" class="px-5 py-2.5 rounded bg-slate-700 hover:bg-slate-600 text-white transition text-sm font-medium">关闭</button>
          <button @click="deleteSelected" :disabled="selectedIds.length === 0 || deleting" class="px-5 py-2.5 rounded bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-2 transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-rose-900/20">
            <svg v-if="!deleting" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
            <svg v-else class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            {{ deleting ? '正在擦除...' : '销毁选中文件' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Confirm Action Modal (Internal) -->
    <div v-if="confirmDialog.isOpen" class="fixed inset-0 z-[70] flex items-center justify-center p-4 backdrop-blur-sm bg-slate-900/60 transition-all">
        <div class="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl p-6 max-w-sm w-full">
            <h3 class="text-xl font-bold text-white mb-2 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-rose-500"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                高危操作警告
            </h3>
            <p class="text-slate-300 text-sm mb-6">{{ confirmDialog.message }}</p>
            <div class="flex justify-end gap-3 flex-wrap">
                <button @click="confirmDialog.isOpen = false" class="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 transition text-white text-sm font-medium">取消</button>
                <button @click="proceedDeletion" :disabled="deleting" class="px-4 py-2 rounded bg-rose-600 hover:bg-rose-500 transition text-white text-sm font-medium flex items-center gap-2">
                    <svg v-if="deleting" class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    确认粉碎
                </button>
            </div>
        </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useToast } from '../composables/useToast';

const props = defineProps({
  isOpen: Boolean
});

const emit = defineEmits(['close', 'deleted']);

const loading = ref(false);
const duplicates = ref([]);
const selectedIds = ref([]);
const deleting = ref(false);
const confirmDialog = ref({ isOpen: false, message: '' });
const { showToast } = useToast();

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'], i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const fetchDuplicates = async () => {
  if (!props.isOpen) return;
  
  loading.value = true;
  selectedIds.value = [];
  try {
    const res = await fetch('/api/tracks/duplicates');
    const result = await res.json();
    if (result.success) {
      duplicates.value = result.data;
      // Pre-select duplicates except the first (largest) one
      result.data.forEach(group => {
         group.files.forEach((f, idx) => {
            if (idx > 0) {
               selectedIds.value.push(f.id);
            }
         });
      });
    }
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
};

const deleteSelected = async () => {
    if (selectedIds.value.length === 0) return;
    confirmDialog.value = {
        isOpen: true,
        message: `这将会把 ${selectedIds.value.length} 个重复文件及其占用的空间从硬盘上彻底清除。一旦执行将无法在回收站找回该文件。是否确认抹除全部勾选对象？`
    };
};

const proceedDeletion = async () => {
    confirmDialog.value.isOpen = false;
    deleting.value = true;
    try {
        const res = await fetch('/api/tracks/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: selectedIds.value })
        });
        const result = await res.json();
        
        if (result.success) {
            duplicates.value.forEach(group => {
                group.files.forEach(f => {
                    if (selectedIds.value.includes(f.id)) {
                        f.deleted = true;
                    }
                });
            });
            selectedIds.value = [];
            showToast('已成功清理所选歌曲，您的硬盘变得更轻松了！', 'success');
            emit('deleted');
        } else {
            showToast('删除失败: ' + result.error, 'error');
        }
    } catch (e) {
        showToast('网络请求错误', 'error');
    } finally {
        deleting.value = false;
    }
};

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    fetchDuplicates();
  }
});
</script>
