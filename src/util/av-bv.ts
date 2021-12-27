// Modified From: https://mrhso.github.io/IshisashiWebsite/
const table = [...'fZodR9XQDSUm21yCkr6zBqiveYah8bt4xsWpHnJE7jL5VG3guMTKNPAwcF'];
const s = [11, 10, 3, 8, 4, 6];
const xor = 177451812;
const add = 8728348608;

export const isBv = (str: string) => str.match(/[Bb][Vv][fZodR9XQDSUm21yCkr6zBqiveYah8bt4xsWpHnJE7jL5VG3guMTKNPAwcF]{10}/gu);
export const extractBv = (str: string) => str.match(/([Bb][Vv][\w+\d]+)/i)?.[1];
export const extractAvNumber = (av: string) => av.match(/av(\d+)/i)?.[1];

export const bv2av = (bv: string) => {
  let str = '';
  if (bv.length === 12) {
    str = bv;
  } else if (bv.length === 10) {
    str = `BV${bv}`;
    // 根据官方 API，BV 号开头的 BV1 其实可以省略
    // 不过单独省略个 B 又不行（
  } else if (bv.length === 9) {
    str = `BV1${bv}`;
  } else {
    throw new Error('¿你在想桃子？');
  }

  if (!isBv(str)) {
    throw new Error('¿你在想桃子？');
  }

  let result = 0;
  let i = 0;
  while (i < 6) {
    result += table.indexOf(str[s[i]]) * 58 ** i;
    i += 1;
  }

  return `av${result - add ^ xor}`;
};