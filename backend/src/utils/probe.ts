import axios from 'axios';

export interface ProbeResult {
    valid: boolean;
    size: number;
    bitrate: number;
    mime: string;
    url: string;
}

/**
 * 探测音频质量 (Sonar Probing)
 * 通过 Range 请求获取 HTTP 头的 Content-Length 来估算码率和验证链接有效性
 */
export async function probeAudioQuality(url: string, source: string, duration: number = 0): Promise<ProbeResult> {
    try {
        const headers: any = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
            'Range': 'bytes=0-1023' // Request first KB for better compatibility
        };

        if (source === 'netease') {
            headers['Referer'] = 'https://music.163.com/';
        } else if (source === 'qq' || source === 'tencent') {
            headers['Referer'] = 'https://y.qq.com/';
        }

        // Use stream to avoid full download if server ignores Range header
        const response = await axios.get(url, {
            headers,
            timeout: 8000,
            responseType: 'stream',
            validateStatus: (status) => status >= 200 && status < 300
        });

        // Abort immediately after getting headers
        response.data.destroy();

        let size = 0;
        const contentRange = response.headers['content-range'];
        if (contentRange) {
            const parts = contentRange.split('/');
            if (parts.length === 2) {
                size = parseInt(parts[1], 10);
            }
        }

        if (size === 0) {
            // Some servers return full length in content-length for 200 OK
            size = parseInt(response.headers['content-length'] || '0', 10);
        }

        let bitrate = 0;
        if (size > 0 && duration > 0) {
            bitrate = Math.floor((size * 8) / duration / 1000);
        }

        const mime = (response.headers['content-type'] || 'audio/mpeg').toLowerCase();

        // Validation logic
        // 1. MUST NOT be HTML or JSON (these are error pages from proxies)
        // 2. Size must be reasonable (> 1MB)
        // 3. Must be an audio type
        const isHtmlOrJson = mime.includes('text/html') || mime.includes('application/json') || mime.includes('text/plain');
        const isAudio = mime.includes('audio') || mime.includes('octet-stream') || mime.includes('mpeg') || mime.includes('flac');

        const isValid = !isHtmlOrJson && isAudio && size > 1024 * 1024;

        if (!isValid && isHtmlOrJson) {
            console.warn(`[Probe: Guard] 拦截到伪装成音频的 HTML/JSON 错误页面: ${mime}`);
        }

        return {
            valid: isValid,
            size,
            bitrate,
            mime,
            url
        };
    } catch (e: any) {
        console.error(`[Probe Error] ${url}: ${e.message}`);
        return {
            valid: false,
            size: 0,
            bitrate: 0,
            mime: 'unknown',
            url
        };
    }
}
