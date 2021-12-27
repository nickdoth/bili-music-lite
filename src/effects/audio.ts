export const videoElm = document.getElementById('video-elm') as HTMLAudioElement;

const SERVER = 'https://bili-music.hk.cn2.nickdoth.cc';

export async function playMain(avid: string) {
  let res = await fetch(`${SERVER}/playurl/av${avid}`).then(res => res.json());
  const { vurl, aurl } = res;
  // vurl = `${SERVER}/proxy/?vurl=${encodeURIComponent(vurl)}&avid=${avid}`;
  // aurl = `${SERVER}/proxy/?vurl=${encodeURIComponent(aurl)}&avid=${avid}`;

  videoElm.src = aurl;

  return res;

  // let md = new MediaSource();
  // md.addEventListener('sourceopen', () => {
  //   // let sbVideo = md.addSourceBuffer('video/mp4; codecs="avc1.64001E"');
  //   let sbAudio = md.addSourceBuffer('video/mp4; codecs="mp4a.40.2"');

  //   // fetchPartialContent(vurl, sbVideo, () => md.endOfStream());
  //   fetchPartialContent(aurl, sbAudio, cleanup);
  //   // sbVideo.mode = 'segments';
  // });

  // const cleanup = () => {
  //   md.endOfStream();
  //   videoElm.removeEventListener('change', cleanup);
  // };

  // videoElm.addEventListener('change', cleanup);
  

  // videoElm!.src = URL.createObjectURL(md);
  
}


function fetchPartialContent(url: string, sb: SourceBuffer, finish: Function | null = null) {
  let last = -1;
  let totalLen = Infinity;
  const defaultChunkLen = 100000;
  async function pull() {
    let isLast = false;
    try {
      let chunkLen = defaultChunkLen;
      if (last + chunkLen > totalLen) {
        chunkLen = totalLen - last + 1;
        if (chunkLen <= 0) {
          finish && finish();
          return;
        }
        isLast = true;
      }
      let res = await fetch(url, {
        headers: {
          'Range': `bytes=${last + 1}-${last + (chunkLen)}`
        }
      });
      let chunk = await res.arrayBuffer();
      console.log('chunkLen', chunkLen);
      console.log('res.headers.get(content-range)', res.headers.get('content-range'));
      totalLen = Number(res?.headers.get('content-range')?.split('/')[1]);

      console.log(`sb.appendBuffer(chunk[${chunk.byteLength}])`)
      await appendBufferAsync(sb, chunk);
      last += chunkLen;
    } catch (e) {
      console.error(e);
    } finally {
      if(!isLast) {
        pull();
      } else {
        finish && finish();
      }
    }

  }
  pull();
}

function appendBufferAsync(sb: SourceBuffer, chunk: ArrayBuffer) {
  return new Promise<void>(resolve => {
    sb.appendBuffer(chunk);
    function onUpdateEnd() {
      resolve();
      sb.removeEventListener('updateend', onUpdateEnd);
    }

    sb.addEventListener('updateend', onUpdateEnd);
  });
}