const axios = require('axios');

async function debugTencentSearch() {
    const songName = "我对缘分小心翼翼";
    const singerName = "林俊杰";
    const rawSinger = (singerName || '').split(/[,、&]+/)[0].trim();
    const keyword = encodeURIComponent(`${rawSinger} ${songName}`);
    const url = `https://api.injahow.cn/meting/?server=tencent&type=search&name=${keyword}`;
    
    try {
        console.log('Searching Tencent:', url);
        const res = await axios.get(url, { timeout: 10000 });
        console.log('Result Status:', res.status);
        console.log('Result Body:', JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.error('Search failed:', e.message);
    }
}

debugTencentSearch();
