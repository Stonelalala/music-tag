const axios = require('axios');

async function debugKugouPlayInfo() {
    const hash = "6313d42b509af011af8251398e19aa53";
    const playUrl = `http://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${hash}`;
    try {
        console.log('Fetching Kugou Play Info:', playUrl);
        const res = await axios.get(playUrl, { timeout: 10000 });
        console.log('Result Status:', res.status);
        console.log('Result Body:', JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.error('Play info check failed:', e.message);
    }
}

debugKugouPlayInfo();
