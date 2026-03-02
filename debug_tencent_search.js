const axios = require('axios');

async function debugTencentSearchVariations() {
    const songName = "我对缘分小心翼翼";
    const singerName = "林俊杰";
    const keyword = `${singerName} ${songName}`;
    
    const variations = [
        `https://api.injahow.cn/meting/?server=tencent&type=search&name=${encodeURIComponent(keyword)}`,
        `https://api.injahow.cn/meting/?server=tencent&type=name&id=${encodeURIComponent(keyword)}`,
        `https://api.injahow.cn/meting/?server=tencent&type=search&id=${encodeURIComponent(keyword)}`
    ];
    
    for (const url of variations) {
        console.log('\n--- Trying Variation:', url);
        try {
            const res = await axios.get(url, { timeout: 10000 });
            console.log('Result Body (first 200 chars):', JSON.stringify(res.data).substring(0, 200));
            if (Array.isArray(res.data)) {
                console.log('SUCCESS! Got array of length:', res.data.length);
                break;
            }
        } catch (e) {
            console.error('Failed:', e.message);
        }
    }
}

debugTencentSearchVariations();
