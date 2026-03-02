const axios = require('axios');

async function checkMeting() {
    const id = '3353437817';
    const url = `https://api.injahow.cn/meting/?server=netease&type=url&id=${id}&br=320`;
    try {
        console.log('Probing Meting URL:', url);
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
                'Range': 'bytes=0-1023'
            },
            timeout: 10000,
            validateStatus: () => true
        });
        console.log('Status:', res.status);
        console.log('Headers:', JSON.stringify(res.headers, null, 2));
    } catch (e) {
        console.error(e.message);
    }
}

checkMeting();
