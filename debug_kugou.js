const axios = require('axios');

async function debugKugouSearch() {
    const keyword = encodeURIComponent("林俊杰 我对缘分小心翼翼");
    const url = `http://mobilecdn.kugou.com/api/v3/search/song?format=json&keyword=${keyword}&page=1&pagesize=1&showtype=1`;
    try {
        console.log('Searching Kugou:', url);
        const res = await axios.get(url, { timeout: 10000 });
        console.log('Result Body (first 200 chars):', JSON.stringify(res.data).substring(0, 200));
    } catch (e) {
        console.error('Kugou check failed:', e.message);
    }
}

debugKugouSearch();
