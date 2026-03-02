const axios = require('axios');

async function debugMetoSearch() {
    const keyword = encodeURIComponent("林俊杰 我对缘分小心翼翼");
    const url = `https://api.i-meto.com/meting/api?server=tencent&type=search&id=${keyword}`;
    try {
        console.log('Searching Meto:', url);
        const res = await axios.get(url, { timeout: 10000 });
        console.log('Result Body (first 500 chars):', JSON.stringify(res.data).substring(0, 500));
    } catch (e) {
        console.error('Meto check failed:', e.message);
    }
}

debugMetoSearch();
