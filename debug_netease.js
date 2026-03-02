const { song_url_v1, song_detail } = require('NeteaseCloudMusicApi');

async function check() {
    try {
        const id = '3353437817';
        const detail = await song_detail({ ids: id });
        console.log('--- Detail ---');
        console.log(JSON.stringify(detail.body, null, 2));

        const url = await song_url_v1({ id, level: 'exhigh' });
        console.log('--- URL ---');
        console.log(JSON.stringify(url.body, null, 2));
    } catch (e) {
        console.error(e);
    }
}

check();
