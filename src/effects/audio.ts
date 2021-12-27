export const videoElm = document.getElementById('video-elm') as HTMLAudioElement;

const SERVER = 'https://bili-music.hk.cn2.nickdoth.cc';

export async function playMain(avid: string) {
  let res = await fetch(`${SERVER}/playurl/av${avid}`).then(res => res.json());
  const { aurl } = res;
  videoElm.src = aurl;

  return res;
}