<template>
  <div class="flex-1 flex flex-col min-w-0 bg-app-primary overflow-hidden">
    <!-- Header Section -->
    <div class="px-8 py-5 flex items-center justify-between border-b border-app shrink-0 bg-app-secondary/30 relative z-20">
      <div class="flex items-center gap-4">
        <div class="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="m17 17-5 5-5-5"/><path d="m7 7 5-5 5 5"/></svg>
        </div>
         <div>
            <h2 class="text-xl font-black text-app-primary tracking-tight leading-none">{{ t('tasks.title') }}</h2>
            <div class="flex items-center gap-2 mt-1.5">
               <div v-if="activeCount > 0" class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
               <p class="text-[10px] text-app-secondary font-black uppercase tracking-[0.2em]">{{ activeCount }} {{ t('tasks.active_tasks') }}</p>
            </div>
         </div>
      </div>
      <div class="flex items-center gap-2">
        <button @click="cleanupTasks" class="flex items-center gap-2 px-5 py-2.5 rounded-full bg-rose-500/10 text-rose-500 text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all transform hover:-translate-y-0.5 active:scale-95 border border-rose-500/20">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          {{ t('tasks.cleanup') }}
        </button>
      </div>
    </div>

    <!-- Layout Body -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Left: Task List (Compact) -->
      <div class="w-full md:w-[480px] border-r border-app overflow-y-auto bg-app-sidebar/20 custom-scrollbar flex-shrink-0">
        <div v-if="tasks.length === 0" class="flex flex-col items-center justify-center h-full gap-4 opacity-40">
           <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/></svg>
           <p class="text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap">{{ t('tasks.no_tasks') }}</p>
        </div>
        <div v-else class="divide-y divide-app">
           <div v-for="task in topLevelTasks" :key="task.id">
              <div 
                   @click="toggleExpand(task.id)"
                   :class="[
                      'px-6 py-5 cursor-pointer transition-all hover:bg-app-accent/5 relative group',
                      selectedTaskId === task.id ? 'bg-app-accent/10 shadow-[inset_3px_0_0_0_var(--accent-color)]' : ''
                   ]"
              >
                 <div class="flex items-center gap-4">
                    <!-- Expand/Collapse Icon if has children -->
                    <div v-if="hasChildren(task.id)" class="w-4 flex items-center justify-center transition-transform" :class="expandedTasks[task.id] ? 'rotate-90' : ''">
                       <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="9 18 15 12 9 6"/></svg>
                    </div>
                    <div v-else class="w-4"></div>

                    <!-- Status Icon -->
                    <div :class="[
                      'w-10 h-10 rounded-xl flex items-center justify-center border transition-all shrink-0 shadow-lg',
                      task.status === 'running' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                      task.status === 'completed' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                      task.status === 'cancelled' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                      task.status === 'failed' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-app-muted text-app-muted border-app'
                    ]">
                       <svg v-if="task.type === 'playlist_import'" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
                       <svg v-else-if="task.type === 'scan'" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
                       <svg v-else-if="task.type === 'scrape'" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                       <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                    </div>
                    <div class="min-w-0 flex-1">
                       <div class="flex items-center justify-between gap-2">
                          <h4 class="text-xs font-black text-app-primary truncate uppercase tracking-widest">{{ t('tasks.type_' + task.type) }}</h4>
                          <span v-if="task.status === 'running'" class="text-[10px] font-black text-emerald-500 tabular-nums">{{ task.progress }}%</span>
                       </div>
                       <div class="flex items-center gap-2 mt-1.5 font-mono">
                          <span class="text-[10px] text-app-secondary font-bold">{{ formatTime(task.created_at) }}</span>
                          <span class="w-1 h-3 bg-app-accent/20"></span>
                          <span class="text-[9px] text-app-muted truncate uppercase tracking-tighter">{{ task.id.substring(0,8) }}</span>
                       </div>
                    </div>
                 </div>
              </div>

              <!-- Children Tasks (Indented) -->
              <div v-if="expandedTasks[task.id] && hasChildren(task.id)" class="bg-black/10 border-b border-app">
                  <div v-for="child in getChildren(task.id)" :key="child.id"
                       @click="selectedTaskId = child.id"
                       :class="[
                          'px-12 py-3.5 cursor-pointer transition-all hover:bg-app-accent/10 border-l-4 border-transparent flex items-center justify-between',
                          selectedTaskId === child.id ? 'bg-app-accent/20 border-emerald-500' : 'opacity-70'
                       ]"
                  >
                     <div class="flex items-center gap-3 min-w-0">
                        <div :class="[
                          'w-6 h-6 rounded-lg flex items-center justify-center border text-[10px] shrink-0',
                          child.status === 'running' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                          child.status === 'completed' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                          child.status === 'cancelled' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                          'bg-rose-500/10 text-rose-500 border-rose-500/20'
                        ]">
                           <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                        <span class="text-[11px] font-bold text-app-primary truncate">{{ child.message }}</span>
                     </div>
                     <span v-if="child.status === 'running'" class="text-[10px] font-black text-emerald-500 tabular-nums ml-2">{{ child.progress }}%</span>
                     <span v-else class="text-[9px] text-app-secondary font-black ml-2 uppercase tracking-tighter">{{ t('tasks.status_' + child.status) }}</span>
                  </div>
              </div>
           </div>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto bg-app-primary p-6 md:p-10 custom-scrollbar flex flex-col">
        <div class="max-w-5xl w-full mx-auto flex-1 flex flex-col">
          <template v-if="selectedTask">
             <!-- Header Info -->
             <div class="flex flex-col md:flex-row items-start justify-between gap-8">
                <div class="space-y-4 flex-1 w-full">
                   <span :class="[
                      'px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border shadow-sm transition-all inline-block',
                      selectedTask.status === 'running' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                      selectedTask.status === 'completed' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                      selectedTask.status === 'cancelled' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                      'bg-rose-500/10 text-rose-500 border-rose-500/20'
                   ]">{{ t('tasks.status_' + (selectedTask.status || 'unknown')) }}</span>

                   <div v-if="selectedTask.parent_id" class="flex items-center gap-2 text-[11px] font-black text-emerald-400 uppercase tracking-widest mt-2 bg-emerald-500/10 px-3 py-1.5 rounded-lg w-fit">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m3 21 1.9-1.9a6 6 0 0 0 0-8.5L3 8.7"/><path d="M7 21h10"/><path d="M19 21h2"/><path d="M21 3h-2"/><path d="m21 21-1.9-1.9a6 6 0 0 1 0-8.5L21 8.7"/><path d="M17 3H7"/><path d="M3 3h2"/></svg>
                      {{ t('tasks.child_task_hint', '子任务流程项目') }}
                   </div>
                   <h3 class="text-3xl md:text-4xl font-black text-app-primary tracking-tighter leading-tight">{{ selectedTask.message }}</h3>
                   <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-app-secondary font-bold tracking-widest uppercase">
                      <span class="px-2 py-0.5 bg-app-muted/30 rounded">ID: {{ selectedTask.id }}</span>
                      <span class="px-2 py-0.5 bg-app-muted/30 rounded">发起时间: {{ formatDetailTime(selectedTask.created_at) }}</span>
                   </div>
                </div>
                
                <button v-if="selectedTask.status === 'running' || selectedTask.status === 'pending'"
                        @click="cancelTask(selectedTask.id)"
                        class="px-8 py-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-500 text-xs font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all transform hover:-translate-y-1 active:scale-95 shrink-0 flex items-center gap-3 shadow-xl shadow-rose-500/5">
                   <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                   {{ t('tasks.cancel') }}
                </button>
             </div>

             <!-- Progress Stats -->
             <div v-if="selectedTask.status === 'running' || selectedTask.status === 'completed'" class="mt-12 space-y-6">
                <div class="flex justify-between items-end">
                   <div>
                      <p class="text-[11px] font-black text-app-secondary uppercase tracking-[0.3em]">{{ t('tasks.progress') }}</p>
                      <p class="text-[11px] text-app-muted font-bold mt-2 tracking-tight">当前核心任务管道流转百分比</p>
                   </div>
                   <span class="text-6xl font-black text-emerald-500 tabular-nums tracking-tighter">{{ selectedTask.progress }}<span class="text-2xl ml-1 font-black opacity-50">%</span></span>
                </div>
                <div class="h-4 w-full bg-app-muted/20 rounded-full overflow-hidden border border-app shadow-inner p-1">
                   <div class="h-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-blue-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(16,185,129,0.3)]" 
                        :style="{ width: selectedTask.progress + '%' }">
                   </div>
                </div>
             </div>

             <!-- Terminal-style Log Viewer -->
             <div class="mt-12 flex-1 flex flex-col min-h-[400px]">
                <div class="flex items-center justify-between px-1 mb-5">
                   <p class="text-[11px] font-black text-app-secondary uppercase tracking-[0.3em]">{{ t('tasks.logs') }}</p>
                   <span class="text-[10px] text-app-accent font-bold italic tracking-wider">REAL-TIME STREAM PIPELINE</span>
                </div>
                <div class="flex-1 bg-black rounded-[40px] border border-app overflow-hidden flex flex-col shadow-2xl shadow-black/80 ring-1 ring-white/5">
                   <div class="flex items-center gap-2 px-8 py-5 bg-white/[0.04] border-b border-white/[0.08] shrink-0">
                      <div class="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]"></div>
                      <div class="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]"></div>
                      <div class="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]"></div>
                      <span class="ml-6 text-[10px] font-mono text-white/60 tracking-widest uppercase font-black">task_streaming_output_{{ selectedTask.id.substring(0,8) }}.log</span>
                   </div>
                   <div class="flex-1 p-10 font-mono text-xs text-emerald-500/90 overflow-y-auto custom-scrollbar leading-[1.8] whitespace-pre-wrap selection:bg-emerald-500/30 selection:text-white">
                      {{ selectedTask.logs || 'Waiting for stream initialization...\nInitializing download pipeline...\n' }}
                      <div v-if="selectedTask.status === 'running'" class="inline-block w-2.5 h-4.5 bg-emerald-500 animate-pulse ml-1 align-middle"></div>
                   </div>
                </div>
             </div>
          </template>
          <div v-else class="flex-1 flex flex-col items-center justify-center text-center p-20 gap-10">
             <div class="relative">
                <div class="absolute inset-0 bg-emerald-500/10 blur-[80px] rounded-full animate-pulse"></div>
                <div class="w-40 h-40 rounded-[50px] bg-app-muted/10 border-2 border-dashed border-app flex items-center justify-center opacity-30 relative z-10">
                   <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M12 2v20"/><path d="m17 17-5 5-5-5"/><path d="m7 7 5-5 5 5"/></svg>
                </div>
             </div>
             <div class="space-y-5">
                <h4 class="text-2xl font-black text-app-primary tracking-tighter">{{ t('tasks.select_hint') }}</h4>
                <p class="text-sm text-app-muted font-bold opacity-40 leading-relaxed uppercase tracking-[0.1em]">从左侧任务流水线记录中选择项目<br/>以启动深度行为审计与日志追踪</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import axios from 'axios';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const tasks = ref<any[]>([]);
const selectedTaskId = ref<string | null>(null);
let pollInterval: any = null;

const activeCount = computed(() => tasks.value.filter(t => t.status === 'running' || t.status === 'pending').length);
const selectedTask = computed(() => tasks.value.find(t => t.id === selectedTaskId.value));

// Hierarchical helpers
const topLevelTasks = computed(() => tasks.value.filter(t => !t.parent_id).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
const expandedTasks = ref<Record<string, boolean>>({});

const toggleExpand = (taskId: string) => {
   expandedTasks.value[taskId] = !expandedTasks.value[taskId];
   selectedTaskId.value = taskId;
};

const hasChildren = (taskId: string) => tasks.value.some(t => t.parent_id === taskId);
const getChildren = (taskId: string) => tasks.value.filter(t => t.parent_id === taskId);

const fetchTasks = async () => {
    try {
        const res = await axios.get('/api/tasks');
        if (res.data.success) {
            tasks.value = res.data.data;
            // Auto-select first top-level task if none selected
            if (!selectedTaskId.value && topLevelTasks.value.length > 0) {
              selectedTaskId.value = topLevelTasks.value[0].id;
            }
        }
    } catch (e) {
        console.error('Failed to fetch tasks', e);
    }
};

const cancelTask = async (id: string) => {
    if (!confirm(t('tasks.cancel_confirm') || '确定要中止并销毁此任务进程吗？')) return;
    try {
        await axios.post(`/api/tasks/${id}/cancel`);
        fetchTasks();
    } catch (e) {}
};

const cleanupTasks = async () => {
    if (!confirm(t('tasks.cleanup_confirm') || '确定清理所有非运行中的任务记录吗？')) return;
    try {
        await axios.post('/api/tasks/cleanup');
        selectedTaskId.value = null;
        fetchTasks();
    } catch (e) {}
};

const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const formatDetailTime = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString();
};

onMounted(() => {
    fetchTasks();
    pollInterval = setInterval(fetchTasks, 3000); // 3s polling for status
});

onUnmounted(() => {
    if (pollInterval) clearInterval(pollInterval);
});
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--accent-color, #10b981);
}
</style>
